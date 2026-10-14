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
let legacyImport: Promise<void> | undefined;

export function normalizeOpponentName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Resolve opponent names consistently across Arabic, French, and bilingual fixture names. */
export function findOpponentLogo(
  opponents: Record<string, Pick<OpponentClub, "name" | "logoUrl">>,
  name: string
): string | null {
  const variants = (value: string) => {
    const result = new Set<string>();
    const add = (part: string) => {
      const normalized = normalizeOpponentName(part);
      if (normalized) result.add(normalized);
    };
    add(value);
    for (const part of value.split(/[\/|]/u)) add(part);
    for (const part of value.match(/^(.*?)\s*\(([^()]*)\)\s*$/u)?.slice(1) ?? []) add(part);
    return result;
  };

  const requested = variants(name);
  for (const [key, opponent] of Object.entries(opponents)) {
    const candidate = variants(opponent.name);
    candidate.add(normalizeOpponentName(key));
    if ([...requested].some((variant) => candidate.has(variant))) return opponent.logoUrl || null;
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
  const opponents = await db.opponentClub.findMany();
  return Object.fromEntries(opponents.map((opponent) => [opponent.normalizedName, {
    name: opponent.name,
    logoUrl: normalizePublicMediaUrl(opponent.logoUrl) ?? opponent.logoUrl,
    stadium: opponent.stadium ?? undefined,
    updatedAt: opponent.updatedAt.toISOString()
  }]));
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
