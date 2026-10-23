import "server-only";
import { db } from "@/lib/db";
import { rankStandings } from "./standings";
import type { StandingTeamEntry } from "./types";
import { getOfficialRoundTwoSeniorStandings, OFFICIAL_ROUND_TWO_BASELINE_AT } from "./round-two-seniors";
import { findOpponentLogo, getAllOpponentsList, getOpponentsMap, saveOpponentClub } from "@/lib/opponents";
import { CLUB_DEFAULT_CREST } from "./types";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

function isDefaultOpponentCrest(value: string | null | undefined): boolean {
  if (!value) return false;
  let normalized = value.toLocaleLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original value when a legacy URL has malformed encoding.
  }
  return normalized.includes("opponent-crest-default.svg");
}

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

type CompetitionSnapshot = {
  id: string;
  type: "LEAGUE" | "CUP";
  name: string;
  teamId: string | null;
  standingsData: unknown;
  team: { category: string } | null;
  season: { isCurrent: boolean };
};

async function isRoundTwoSeniorCompetition(competition: CompetitionSnapshot): Promise<boolean> {
  if (competition.type !== "LEAGUE" || competition.team?.category !== "SENIOR" || !competition.season.isCurrent) return false;
  if (/(honneur|القسم\s*الشرفي)/iu.test(competition.name)) return true;
  const currentSeniorLeagueCount = await db.competition.count({
    where: { type: "LEAGUE", team: { category: "SENIOR" }, season: { isCurrent: true } }
  });
  return currentSeniorLeagueCount === 1;
}

async function persistOpponentTeams(standings: StandingTeamEntry[]): Promise<void> {
  const existing = await getAllOpponentsList();
  const known = new Map(existing.map((team) => [normalizeClubName(team.name), team.logoUrl]));
  for (const row of standings) {
    if (row.isOurClub) continue;
    const key = normalizeClubName(row.teamName);
    const logo = row.teamLogo?.trim();
    // Baseline tables commonly carry a placeholder. Never persist it into the
    // shared opponent registry, where it would mask a subsequently uploaded crest.
    if (!key || !logo || isDefaultOpponentCrest(logo)) continue;
    const savedLogo = known.get(key);
    if (savedLogo && !isDefaultOpponentCrest(savedLogo)) continue;
    await saveOpponentClub(row.teamName, logo);
    known.set(key, logo);
  }
}

async function resolveStandingsLogos(competitionId: string, rows: StandingTeamEntry[]): Promise<StandingTeamEntry[]> {
  const [opponents, matches, competition, clubSettings] = await Promise.all([
    getOpponentsMap(),
    db.match.findMany({
      where: { competitionId },
      select: { teamId: true, isHomeFixture: true, homeTeamName: true, awayTeamName: true }
    }),
    db.competition.findUnique({ where: { id: competitionId }, select: { teamId: true } }),
    db.clubSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } })
  ]);
  const clubLogo = normalizePublicMediaUrl(clubSettings?.logoUrl) || CLUB_DEFAULT_CREST;
  const opponentNames = matches.map((match) =>
    competition?.teamId && match.teamId === competition.teamId
      ? (match.isHomeFixture ? match.awayTeamName : match.homeTeamName)
      : ""
  ).filter(Boolean);

  return Promise.all(rows.map(async (row) => {
    if (row.isOurClub || row.id === "official-r2-esh") return { ...row, teamLogo: clubLogo };

    const savedLogo = findOpponentLogo(opponents, row.teamName);
    const usableSavedLogo = savedLogo && !isDefaultOpponentCrest(savedLogo) ? savedLogo : null;
    const snapshotLogo = row.teamLogo && !isDefaultOpponentCrest(row.teamLogo) ? row.teamLogo : null;
    if (usableSavedLogo || snapshotLogo) return { ...row, teamLogo: usableSavedLogo || snapshotLogo };

    // Match forms retain both the entered Arabic name and its optional French
    // label. Resolve that combined name back to a French-only standings row.
    const normalizedTeam = normalizeClubName(row.teamName);
    for (const matchOpponentName of opponentNames) {
      const normalizedMatchName = normalizeClubName(matchOpponentName);
      if (!normalizedMatchName.includes(normalizedTeam) && !normalizedTeam.includes(normalizedMatchName)) continue;
      const aliasLogo = findOpponentLogo(opponents, matchOpponentName);
      if (aliasLogo && !isDefaultOpponentCrest(aliasLogo)) return { ...row, teamLogo: aliasLogo };
    }
    // Let OpponentCrest render the same shield fallback used elsewhere in the
    // platform; passing the old decorative SVG made placeholders look like logos.
    return { ...row, teamLogo: null };
  }));
}

/** Initialize the official round-two baseline once, when a match is added or points are adjusted. */
export async function ensureCompetitionStandingsBaseline(competitionId: string): Promise<StandingTeamEntry[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    include: { team: { select: { category: true } }, season: { select: { isCurrent: true } } }
  });
  if (!competition) return [];
  const snapshot = competition as unknown as CompetitionSnapshot;
  const stored = Array.isArray(competition.standingsData) ? competition.standingsData as unknown as StandingTeamEntry[] : [];
  let baseline = stored;

  if (!baseline.length && await isRoundTwoSeniorCompetition(snapshot)) {
    baseline = getOfficialRoundTwoSeniorStandings();
    await db.competition.update({ where: { id: competitionId }, data: { standingsData: baseline as any } });
  } else if (baseline.length) {
    baseline = baseline.map((row) => ({ ...row, baselineAt: row.baselineAt || OFFICIAL_ROUND_TWO_BASELINE_AT }));
    if (stored.some((row) => !row.baselineAt)) {
      await db.competition.update({ where: { id: competitionId }, data: { standingsData: baseline as any } });
    }
  }

  await persistOpponentTeams(baseline);
  return baseline;
}

/** Adds finished match results entered after the saved official standings snapshot. */
export async function getLiveCompetitionStandings(competitionId: string, value: unknown): Promise<StandingTeamEntry[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    include: { team: { select: { category: true } }, season: { select: { isCurrent: true } } }
  });
  if (!competition) return [];
  let baselineRows = Array.isArray(value) ? value as StandingTeamEntry[] : [];
  if (!baselineRows.length && await isRoundTwoSeniorCompetition(competition as unknown as CompetitionSnapshot)) {
    baselineRows = getOfficialRoundTwoSeniorStandings();
  }
  if (!baselineRows.length) return [];
  baselineRows = baselineRows.map((row) => ({ ...row, baselineAt: row.baselineAt || OFFICIAL_ROUND_TWO_BASELINE_AT, pointsAdjustment: row.pointsAdjustment ?? 0 }));
  const baselineAt = baselineRows.find((row) => row.baselineAt)?.baselineAt || OFFICIAL_ROUND_TWO_BASELINE_AT;
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

  if (matches.length === 0) return resolveStandingsLogos(competitionId, baselineRows);

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

  return resolveStandingsLogos(competitionId, rankStandings(rows));
}

/** Apply manual points without baking match results into the round-two baseline. */
export async function setCompetitionManualPoints(
  competitionId: string,
  changes: Array<{ id: string; points: number }>
): Promise<StandingTeamEntry[]> {
  const baseline = await ensureCompetitionStandingsBaseline(competitionId);
  if (!baseline.length) throw new Error("لا يوجد خط أساس ترتيب لهذا الدوري.");
  const live = await getLiveCompetitionStandings(competitionId, baseline);
  const liveById = new Map(live.map((row) => [row.id, row]));
  const changeById = new Map(changes.map((change) => [change.id, change.points]));
  if (changeById.size !== changes.length || changes.some((change) => !liveById.has(change.id))) throw new Error("ترتيب الفرق المرسل غير صالح.");

  const adjusted = baseline.map((row) => {
    const target = changeById.get(row.id);
    if (target === undefined) return row;
    const current = liveById.get(row.id)!;
    const oldAdjustment = row.pointsAdjustment ?? 0;
    const pointsAdjustment = target - current.points + oldAdjustment;
    return { ...row, pointsAdjustment, points: row.won * 3 + row.drawn + pointsAdjustment };
  });
  const ordered = rankStandings(adjusted);
  await db.competition.update({ where: { id: competitionId }, data: { standingsData: ordered as any } });
  return getLiveCompetitionStandings(competitionId, ordered);
}
