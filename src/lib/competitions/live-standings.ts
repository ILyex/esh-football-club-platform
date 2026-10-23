import "server-only";
import { db } from "@/lib/db";
import { rankStandings } from "./standings";
import type { StandingTeamEntry } from "./types";

function normalizeClubName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function buildNameIndex(standings: StandingTeamEntry[]): Map<string, StandingTeamEntry> {
  const index = new Map<string, StandingTeamEntry>();
  for (const row of standings) {
    index.set(normalizeClubName(row.teamName), row);
    if (row.id === "official-r2-esh") {
      for (const alias of ["Association Sportive Espoir Sidi Hosni", "Espoir Sidi Hosni", "E Sidi Hosni", "ES Sidi Hosni", "Amel Sidi Hosni", "أمل سيدي حسني", "الجمعية الرياضية أمل سيدي حسني"]) {
        index.set(normalizeClubName(alias), row);
      }
    }
  }
  return index;
}

/** Adds finished match results entered after the saved official standings snapshot. */
export async function getLiveCompetitionStandings(competitionId: string, value: unknown): Promise<StandingTeamEntry[]> {
  if (!Array.isArray(value) || value.length === 0) return [];
  const baselineRows = value as StandingTeamEntry[];
  const baselineAt = baselineRows.find((row) => row.baselineAt)?.baselineAt;
  if (!baselineAt || !Number.isFinite(Date.parse(baselineAt))) return rankStandings(baselineRows);

  const competition = await db.competition.findUnique({ where: { id: competitionId }, select: { teamId: true } });
  if (!competition) return baselineRows;
  const matches = await db.match.findMany({
    where: { competitionId, status: "FINISHED", matchDate: { gt: new Date(baselineAt) }, homeScore: { not: null }, awayScore: { not: null } },
    select: { teamId: true, homeTeamName: true, awayTeamName: true, isHomeFixture: true, homeScore: true, awayScore: true, matchDate: true },
    orderBy: { matchDate: "asc" }
  });

  const rows = baselineRows.map((row) => ({ ...row }));
  const index = buildNameIndex(rows);
  const applyResult = (row: StandingTeamEntry | undefined, goalsFor: number, goalsAgainst: number) => {
    if (!row) return;
    row.played += 1;
    row.goalsFor += goalsFor;
    row.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) row.won += 1;
    else if (goalsFor === goalsAgainst) row.drawn += 1;
    else row.lost += 1;
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.points = row.won * 3 + row.drawn + (row.pointsAdjustment ?? 0);
  };

  if (matches.length === 0) return baselineRows;

  for (const match of matches) {
    const homeScore = match.homeScore!;
    const awayScore = match.awayScore!;
    let home = index.get(normalizeClubName(match.homeTeamName));
    let away = index.get(normalizeClubName(match.awayTeamName));
    // Match records in this platform identify our category through teamId and
    // home/away orientation. Use that relation if the configured club name is
    // different from the short name printed in the league table.
    const ourClub = rows.find((row) => row.isOurClub);
    if (ourClub && competition.teamId && match.teamId === competition.teamId) {
      if (match.isHomeFixture) home = ourClub;
      else away = ourClub;
      const opponentName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
      const opponent = index.get(normalizeClubName(opponentName));
      if (match.isHomeFixture) away = opponent;
      else home = opponent;
    }
    if (!home || !away || home.id === away.id) continue;
    applyResult(home, homeScore, awayScore);
    applyResult(away, awayScore, homeScore);
  }

  return rankStandings(rows);
}
