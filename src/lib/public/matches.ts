import "server-only";
import { db } from "@/lib/db";
import { MatchStatus, TeamCategory } from "@prisma/client";
import { getOpponentsMap } from "@/lib/opponents";
import { promoteDueMatchesToLive } from "@/lib/matches/lifecycle";

// ============================================================================
// PUBLIC MATCHES & FIXTURES DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly projects public fixture, result, lineup, and event data.
// Excludes internal expenses, private documents, referee reports, and notes.
// ============================================================================

export interface PublicMatchItem {
  id: string;
  matchDate: Date;
  homeTeamName: string;
  awayTeamName: string;
  isHomeFixture: boolean;
  homeScore: number | null;
  awayScore: number | null;
  stadium: string | null;
  status: MatchStatus;
  competitionName: string;
  teamCategory: TeamCategory | null;
  teamName: string | null;
  opponentLogo?: string | null;
}

export interface PublicMatchEventItem {
  id: string;
  minute: number;
  type: string;
  source: "MANUAL" | "REFEREE_REPORT";
  side: "HOME" | "AWAY";
  notes: string | null;
  playerName: string;
  playerId: string | null;
  staffName?: string | null;
  staffId?: string | null;
}

export interface PublicLineupItem {
  playerId: string;
  playerName: string;
  playerSlug: string;
  shirtNumber: number | null;
  position: string | null;
  isStarting: boolean;
}

export interface PublicMatchDetail extends PublicMatchItem {
  refereeName: string | null;
  matchReport: string | null;
  events: PublicMatchEventItem[];
  startingLineup: PublicLineupItem[];
  substitutes: PublicLineupItem[];
}

/** Fetches the single next scheduled upcoming match for the club (senior team preferred). */
export async function getPublicNextMatch(): Promise<PublicMatchItem | null> {
  await promoteDueMatchesToLive();
  const match = await db.match.findFirst({
    where: {
      status: "SCHEDULED",
      matchDate: { gte: new Date() }
    },
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      isHomeFixture: true,
      homeScore: true,
      awayScore: true,
      stadium: true,
      status: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "asc" }
  });

  if (!match) return null;

  const opponents = await getOpponentsMap();
  const opponentName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentLogo = opponents[opponentName.toLowerCase()]?.logoUrl || null;

  return {
    id: match.id,
    matchDate: match.matchDate,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    isHomeFixture: match.isHomeFixture,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    stadium: match.stadium,
    status: match.status,
    competitionName: match.competition.name,
    teamCategory: match.team?.category ?? null,
    teamName: match.team?.name ?? null,
    opponentLogo
  };
}

/** Fetches upcoming scheduled matches across categories (seniors, U20, U17, etc.) */
export async function getPublicUpcomingMatches(limit: number = 6): Promise<PublicMatchItem[]> {
  await promoteDueMatchesToLive();
  const matches = await db.match.findMany({
    where: {
      status: "SCHEDULED",
      matchDate: { gte: new Date() }
    },
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      isHomeFixture: true,
      homeScore: true,
      awayScore: true,
      stadium: true,
      status: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "asc" },
    take: limit
  });

  const opponents = await getOpponentsMap();

  return matches.map((m) => {
    const opponentName = m.isHomeFixture ? m.awayTeamName : m.homeTeamName;
    const opponentLogo = opponents[opponentName.toLowerCase()]?.logoUrl || null;
    return {
      id: m.id,
      matchDate: m.matchDate,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      isHomeFixture: m.isHomeFixture,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stadium: m.stadium,
      status: m.status,
      competitionName: m.competition.name,
      teamCategory: m.team?.category ?? null,
      teamName: m.team?.name ?? null,
      opponentLogo
    };
  });
}

/** Fetches the most recent completed match result for the club. */
export async function getPublicLatestResult(): Promise<PublicMatchItem | null> {
  const match = await db.match.findFirst({
    where: {
      status: "FINISHED"
    },
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      isHomeFixture: true,
      homeScore: true,
      awayScore: true,
      stadium: true,
      status: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "desc" }
  });

  if (!match) return null;

  const opponents = await getOpponentsMap();
  const opponentName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentLogo = opponents[opponentName.toLowerCase()]?.logoUrl || null;

  return {
    id: match.id,
    matchDate: match.matchDate,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    isHomeFixture: match.isHomeFixture,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    stadium: match.stadium,
    status: match.status,
    competitionName: match.competition.name,
    teamCategory: match.team?.category ?? null,
    teamName: match.team?.name ?? null,
    opponentLogo
  };
}

/** Fetches public matches list with optional teamCategory or status filter. */
export async function getPublicMatches(options?: {
  teamCategory?: TeamCategory;
  mode?: "UPCOMING" | "RESULTS" | "ALL";
  limit?: number;
}): Promise<PublicMatchItem[]> {
  await promoteDueMatchesToLive();
  const mode = options?.mode ?? "ALL";
  const where: any = {};

  if (options?.teamCategory) {
    where.team = { category: options.teamCategory };
  }

  if (mode === "UPCOMING") {
    where.status = { in: ["SCHEDULED", "LIVE"] };
  } else if (mode === "RESULTS") {
    where.status = { in: ["FINISHED", "POSTPONED", "CANCELLED"] };
  }

  const matches = await db.match.findMany({
    where,
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      isHomeFixture: true,
      homeScore: true,
      awayScore: true,
      stadium: true,
      status: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: mode === "UPCOMING" ? { matchDate: "asc" } : { matchDate: "desc" },
    take: options?.limit ?? 50
  });

  return matches.map((m) => ({
    id: m.id,
    matchDate: m.matchDate,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    isHomeFixture: m.isHomeFixture,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    stadium: m.stadium,
    status: m.status,
    competitionName: m.competition.name,
    teamCategory: m.team?.category ?? null,
    teamName: m.team?.name ?? null
  }));
}

/** Fetches full public match center details including authorized lineups and events. */
export async function getPublicMatchDetail(id: string): Promise<PublicMatchDetail | null> {
  await promoteDueMatchesToLive();
  const match = await db.match.findUnique({
    where: { id },
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      isHomeFixture: true,
      homeScore: true,
      awayScore: true,
      stadium: true,
      refereeName: true,
      status: true,
      matchReport: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } },
      events: {
        select: {
          id: true,
          minute: true,
          type: true,
          source: true,
          side: true,
          notes: true,
          playerId: true,
          staffId: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
          ,staff: { select: { firstName: true, lastName: true } }
        },
        orderBy: { minute: "asc" }
      },
      lineups: {
        select: {
          playerId: true,
          position: true,
          isStarting: true,
          player: {
            select: {
              id: true,
              slug: true,
              shirtNumber: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { isStarting: "desc" }
      }
    }
  });

  if (!match) return null;

  const startingLineup: PublicLineupItem[] = match.lineups
    .filter((l) => l.isStarting)
    .map((l) => ({
      playerId: l.player.id,
      playerName: `${l.player.firstName} ${l.player.lastName}`,
      playerSlug: l.player.slug,
      shirtNumber: l.player.shirtNumber,
      position: l.position,
      isStarting: true
    }));

  const substitutes: PublicLineupItem[] = match.lineups
    .filter((l) => !l.isStarting)
    .map((l) => ({
      playerId: l.player.id,
      playerName: `${l.player.firstName} ${l.player.lastName}`,
      playerSlug: l.player.slug,
      shirtNumber: l.player.shirtNumber,
      position: l.position,
      isStarting: false
    }));

  const events: PublicMatchEventItem[] = match.events.map((e) => ({
    id: e.id,
    minute: e.minute,
    type: e.type,
    source: e.source,
    side: e.side,
    notes: e.notes,
    playerName: e.player ? `${e.player.firstName} ${e.player.lastName}` : "—",
    playerId: e.playerId,
    staffName: e.staff ? `${e.staff.firstName} ${e.staff.lastName}` : null,
    staffId: e.staffId
  }));

  return {
    id: match.id,
    matchDate: match.matchDate,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    isHomeFixture: match.isHomeFixture,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    stadium: match.stadium,
    refereeName: match.refereeName,
    status: match.status,
    matchReport: match.matchReport,
    competitionName: match.competition.name,
    teamCategory: match.team?.category ?? null,
    teamName: match.team?.name ?? null,
    events,
    startingLineup,
    substitutes
  };
}
