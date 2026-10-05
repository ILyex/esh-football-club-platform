import "server-only";
import { getOpponentsMap } from "@/lib/opponents";
import type { TeamCategory } from "@prisma/client";

export * from "./types";
export * from "./standings";
export * from "./display-data";
import { CLUB_DEFAULT_CREST, normalizeTeamName, type CupBracketData, type StandingTeamEntry } from "./types";

/** Empty state only: standings must come from verified competition records. */
export function getDefaultStandings(_category: TeamCategory, _clubName?: string): StandingTeamEntry[] {
  return [];
}

/** Empty state only: fixtures and results must come from official records. */
export function getDefaultCupBracket(_category: TeamCategory, _clubName?: string): CupBracketData {
  return { rounds: [] };
}

/** Resolve a team logo from the club directory without inventing a fallback opponent logo. */
export async function resolveTeamLogo(
  teamName: string,
  isOurClub?: boolean,
  providedLogo?: string | null
): Promise<string | null> {
  if (isOurClub) return CLUB_DEFAULT_CREST;
  if (providedLogo?.trim()) return providedLogo.trim();
  if (!teamName.trim()) return null;

  const opponents = await getOpponentsMap();
  const normalized = normalizeTeamName(teamName);
  for (const [key, opponent] of Object.entries(opponents)) {
    if (normalizeTeamName(opponent.name) === normalized || normalizeTeamName(key) === normalized) {
      return opponent.logoUrl || null;
    }
  }

  return null;
}
