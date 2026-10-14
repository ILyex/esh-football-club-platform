import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export interface OpponentClub {
  name: string;
  logoUrl: string;
  stadium?: string;
  updatedAt: string;
}

const LEGACY_OPPONENTS_FILE = path.resolve(process.cwd(), ".storage", "opponents.json");
const OPPONENT_MAP_CACHE_MS = 30_000;
let legacyImport: Promise<void> | undefined;
let opponentsMapCache: { promise: Promise<Record<string, OpponentClub>>; expiresAt: number } | undefined;
const opponentIndexes = new WeakMap<object, Map<string, string>>();

export function normalizeOpponentName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function opponentNameVariants(value: string): Set<string> {
  const result = new Set<string>();
  const add = (part: string) => {
    const normalized = normalizeOpponentName(part);
    if (normalized) result.add(normalized);
  };
  add(value);
  for (const part of value.split(/[\/|]/u)) add(part);
  for (const part of value.match(/^(.*?)\s*\(([^()]*)\)\s*$/u)?.slice(1) ?? []) add(part);
  return result;
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
export async function getOpponentsMap(): Promise<Record<string, OpponentClub>> {
  await importLegacyOpponentCache();
  if (opponentsMapCache && opponentsMapCache.expiresAt > Date.now()) return opponentsMapCache.promise;
  const promise = db.opponentClub.findMany().then((opponents) => Object.fromEntries(opponents.map((opponent) => [opponent.normalizedName, {
    name: opponent.name,
    logoUrl: normalizePublicMediaUrl(opponent.logoUrl) ?? opponent.logoUrl,
    stadium: opponent.stadium ?? undefined,
    updatedAt: opponent.updatedAt.toISOString()
  }])));
  opponentsMapCache = { promise, expiresAt: Date.now() + OPPONENT_MAP_CACHE_MS };
  try {
    return await promise;
  } catch (error) {
    if (opponentsMapCache?.promise === promise) opponentsMapCache = undefined;
    throw error;
  }
}

/** Saves or replaces an opponent crest for reuse in all later fixtures. */
export async function saveOpponentClub(name: string, logoUrl: string, stadium?: string): Promise<void> {
  const trimmedName = name.trim();
  const normalizedName = normalizeOpponentName(trimmedName);
  if (!normalizedName || !logoUrl.trim()) return;
  await importLegacyOpponentCache();

  await db.opponentClub.upsert({
    where: { normalizedName },
    create: {
      name: trimmedName,
      normalizedName,
      logoUrl,
      stadium: stadium?.trim() || null
    },
    update: {
      name: trimmedName,
      logoUrl,
      ...(stadium?.trim() ? { stadium: stadium.trim() } : {})
    }
  });
  opponentsMapCache = undefined;
}

/** Returns cached opponents in display order for fast selection in match forms. */
export async function getAllOpponentsList(): Promise<OpponentClub[]> {
  await importLegacyOpponentCache();
  const opponents = await db.opponentClub.findMany({ orderBy: { name: "asc" } });
  return opponents.map((opponent) => ({
    name: opponent.name,
    logoUrl: normalizePublicMediaUrl(opponent.logoUrl) ?? opponent.logoUrl,
    stadium: opponent.stadium ?? undefined,
    updatedAt: opponent.updatedAt.toISOString()
  }));
}
