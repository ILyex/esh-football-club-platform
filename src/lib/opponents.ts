import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export interface OpponentClub {
  name: string;
  logoUrl: string;
  stadium?: string;
  updatedAt: string;
  aliases?: string[];
}

const LEGACY_OPPONENTS_FILE = path.resolve(process.cwd(), ".storage", "opponents.json");
let legacyImport: Promise<void> | undefined;
const opponentIndexes = new WeakMap<object, Map<string, string>>();

export function normalizeOpponentName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isPlaceholderOpponentLogo(value: string | null | undefined): boolean {
  if (!value) return true;
  let normalized = value.toLocaleLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep malformed legacy URLs unchanged; they will be handled by the image fallback.
  }
  return normalized.includes("opponent-crest-default.svg");
}

function opponentNameVariants(value: string): Set<string> {
  const result = new Set<string>();
  const add = (part: string) => {
    const normalized = normalizeOpponentName(part);
    if (!normalized) return;
    result.add(normalized);
    // Federation and competition lists vary in accents and punctuation
    // (for example "J.S. Frenda" vs "JS Frenda"). Keep the canonical key
    // unchanged for storage, but index these display variants for lookup.
    const folded = normalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
    if (folded) {
      result.add(folded);
      result.add(folded.replace(/\s+/g, ""));
    }
  };
  add(value);
  for (const part of value.split(/[\/|]/u)) add(part);
  for (const part of value.match(/^(.*?)\s*\(([^()]*)\)\s*$/u)?.slice(1) ?? []) add(part);
  return result;
}

function foldedNameTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

/** Match federation abbreviations such as "JS Frenda" to expanded club names. */
function matchesAbbreviatedClubName(left: string, right: string): boolean {
  const a = foldedNameTokens(left);
  const b = foldedNameTokens(right);
  if (a.length < 2 || b.length < 2 || a.at(-1) !== b.at(-1)) return false;

  const particles = new Set(["de", "del", "da", "do", "dos", "du", "des", "d", "la", "le", "les", "el", "al", "et"]);
  const significantA = a.filter((token) => !particles.has(token));
  const significantB = b.filter((token) => !particles.has(token));
  if (significantA.length < 2 || significantB.length < 2) return false;

  const prefixA = significantA.slice(0, -1);
  const prefixB = significantB.slice(0, -1);
  const initials = (tokens: string[]) => tokens.map((token) => token[0]).join("");
  const shortMatchesLong = (short: string[], long: string[]) => {
    const shortForm = short.join("");
    const longInitials = initials(long);
    return shortForm.length <= longInitials.length && longInitials.startsWith(shortForm);
  };
  return shortMatchesLong(prefixA, prefixB) || shortMatchesLong(prefixB, prefixA);
}

/** Resolve opponent names consistently across Arabic, French, and bilingual fixture names. */
export function findOpponentLogo(
  opponents: Record<string, Pick<OpponentClub, "name" | "logoUrl">>,
  name: string
): string | null {
  let index = opponentIndexes.get(opponents);
  if (!index) {
    index = new Map<string, string>();
    for (const [key, opponent] of Object.entries(opponents)) {
      const logoUrl = opponent.logoUrl;
      if (isPlaceholderOpponentLogo(logoUrl)) continue;
      for (const variant of opponentNameVariants(opponent.name)) {
        if (logoUrl && !index.has(variant)) index.set(variant, logoUrl);
      }
      const normalizedKey = normalizeOpponentName(key);
      if (normalizedKey && logoUrl && !index.has(normalizedKey)) index.set(normalizedKey, logoUrl);
    }
    opponentIndexes.set(opponents, index);
  }

  for (const variant of opponentNameVariants(name)) {
    const logoUrl = index.get(variant);
    if (logoUrl) return logoUrl;
  }

  // Standings often use federation abbreviations while the shared logo
  // library stores the full name entered with the fixture. Resolve that
  // relation here so every consumer (website, calendar, mobile API) gets the
  // same crest lookup instead of each page implementing its own name rules.
  for (const opponent of Object.values(opponents)) {
    if (isPlaceholderOpponentLogo(opponent.logoUrl)) continue;
    if (matchesAbbreviatedClubName(name, opponent.name)) return opponent.logoUrl;
  }
  return null;
}

/** Move logos from older local JSON installs to the shared database once. */
async function importLegacyOpponentCache(): Promise<void> {
  // Cloudflare Workers have no durable project filesystem; on that runtime the
  // shared database is the source of truth and legacy files are intentionally skipped.
  if (process.env.DEPLOY_TARGET === "cloudflare") return;
  if (!legacyImport) {
    legacyImport = (async () => {
      let raw: string;
      try {
        raw = await fs.readFile(LEGACY_OPPONENTS_FILE, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }

      const oldEntries = Object.values(JSON.parse(raw) as Record<string, Partial<OpponentClub>>)
        .filter((item): item is Partial<OpponentClub> & { name: string; logoUrl: string } =>
          typeof item.name === "string" && Boolean(item.name.trim()) &&
          typeof item.logoUrl === "string" && Boolean(item.logoUrl.trim())
        )
        .map((item) => ({
          name: item.name.trim(),
          normalizedName: normalizeOpponentName(item.name),
          logoUrl: item.logoUrl,
          stadium: item.stadium?.trim() || null,
          ...(item.updatedAt && Number.isFinite(Date.parse(item.updatedAt))
            ? { updatedAt: new Date(item.updatedAt) }
            : {})
        }));

      if (oldEntries.length) {
        await db.opponentClub.createMany({ data: oldEntries, skipDuplicates: true });
        const clubs = await db.opponentClub.findMany({
          where: { normalizedName: { in: oldEntries.map((entry) => entry.normalizedName) } },
          select: { id: true, name: true, normalizedName: true }
        });
        await db.$transaction(clubs.map((club) => db.opponentClubAlias.upsert({
          where: { normalizedName: club.normalizedName },
          create: { normalizedName: club.normalizedName, name: club.name, opponentClubId: club.id },
          update: { name: club.name, opponentClubId: club.id }
        })));
      }
    })().catch((error) => {
      legacyImport = undefined;
      throw error;
    });
  }
  await legacyImport;
}

/** Retrieves one previously saved opponent logo from the shared club library. */
export async function getOpponentLogo(name: string): Promise<string | null> {
  if (!normalizeOpponentName(name)) return null;
  return findOpponentLogo(await getOpponentsMap(), name);
}

/** Compatibility map used by public match and competition logo resolvers. */
async function loadOpponentsMap(): Promise<Record<string, OpponentClub>> {
  const opponents = await db.opponentClub.findMany({ include: { aliases: true } });
  const entries: Array<[string, OpponentClub]> = [];
  for (const opponent of opponents) {
    const value = {
      name: opponent.name,
      logoUrl: normalizePublicMediaUrl(opponent.logoUrl) ?? opponent.logoUrl,
      stadium: opponent.stadium ?? undefined,
      updatedAt: opponent.updatedAt.toISOString()
    };
    entries.push([opponent.normalizedName, value]);
    for (const alias of opponent.aliases) {
      entries.push([alias.normalizedName, { ...value, name: alias.name }]);
    }
  }
  return Object.fromEntries(entries);
}

// Public pages often resolve several match lists in parallel. Cache the shared
// opponent registry so a cold homepage render does not query this table once
// for the next fixture, again for the carousel, and again for recent results.
const getCachedOpponentsMap = unstable_cache(
  loadOpponentsMap,
  ["opponent-clubs-map-v1"],
  { revalidate: 60, tags: ["opponent-clubs", "public-home"] }
);

export async function getOpponentsMap(): Promise<Record<string, OpponentClub>> {
  await importLegacyOpponentCache();
  return getCachedOpponentsMap();
}

/** Saves or replaces an opponent crest for reuse in all later fixtures. */
export async function saveOpponentClub(name: string, logoUrl: string, stadium?: string, aliases: string[] = []): Promise<void> {
  const trimmedName = name.trim();
  const normalizedName = normalizeOpponentName(trimmedName);
  if (!normalizedName || !logoUrl.trim()) return;
  await importLegacyOpponentCache();

  await db.$transaction(async (tx) => {
    const aliasNames = new Map<string, string>();
    for (const alias of [trimmedName, ...aliases]) {
      const cleanName = alias.trim();
      const key = normalizeOpponentName(cleanName);
      if (key) aliasNames.set(key, cleanName);
    }
    const exactAlias = await tx.opponentClubAlias.findUnique({ where: { normalizedName } });
    const matchedAlias = exactAlias ?? await tx.opponentClubAlias.findFirst({
      where: { normalizedName: { in: [...aliasNames.keys()].filter((key) => key !== normalizedName) } },
      select: { opponentClubId: true }
    });
    const opponent = matchedAlias
      ? await tx.opponentClub.update({
          where: { id: matchedAlias.opponentClubId },
          data: { name: trimmedName, logoUrl, ...(stadium?.trim() ? { stadium: stadium.trim() } : {}) },
          select: { id: true }
        })
      : await tx.opponentClub.upsert({
          where: { normalizedName },
          create: { name: trimmedName, normalizedName, logoUrl, stadium: stadium?.trim() || null },
          update: { name: trimmedName, logoUrl, ...(stadium?.trim() ? { stadium: stadium.trim() } : {}) },
          select: { id: true }
        });
    for (const [key, aliasName] of aliasNames) {
      await tx.opponentClubAlias.upsert({
        where: { normalizedName: key },
        create: { normalizedName: key, name: aliasName, opponentClubId: opponent.id },
        update: { name: aliasName, opponentClubId: opponent.id }
      });
    }
  });
  // The public homepage is data-cached independently from its route. Expire
  // that cache when a crest changes so the calendar, platform and homepage all
  // read the same updated opponent registry immediately.
  try {
    revalidateTag("opponent-clubs");
    revalidateTag("public-home");
  } catch {
    // Some background import callers do not have a Next.js request context.
    // The short-lived runtime cache and route revalidation still refresh them.
  }
}

/** Returns cached opponents in display order for fast selection in match forms. */
export async function getAllOpponentsList(): Promise<OpponentClub[]> {
  await importLegacyOpponentCache();
  const opponents = await db.opponentClub.findMany({ include: { aliases: true }, orderBy: { name: "asc" } });
  return opponents.map((opponent) => ({
    name: opponent.name,
    logoUrl: normalizePublicMediaUrl(opponent.logoUrl) ?? opponent.logoUrl,
    stadium: opponent.stadium ?? undefined,
    updatedAt: opponent.updatedAt.toISOString(),
    aliases: opponent.aliases.map((alias) => alias.name).filter((alias) => normalizeOpponentName(alias) !== opponent.normalizedName)
  }));
}
