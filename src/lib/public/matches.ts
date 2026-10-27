import "server-only";
import { db } from "@/lib/db";
import { MatchStatus, TeamCategory } from "@prisma/client";
import { findOpponentLogo, getOpponentLogo, getOpponentsMap } from "@/lib/opponents";
import { frenchPublicPersonName, splitClubNameVariants } from "@/lib/public/locale-text";
import { resolveMatchResult, type MatchSide } from "@/lib/matches/result";
import type { MatchAddedTimeSettings } from "@/lib/matches/clock";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

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
  hasExtraTime: boolean;
  hasPenaltyShootout: boolean;
  addedTime: MatchAddedTimeSettings;
  competitionName: string;
  teamCategory: TeamCategory | null;
  teamName: string | null;
  opponentLogo?: string | null;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  winnerSide?: MatchSide | null;
  decidedByPenalties?: boolean;
}

export interface PublicMatchEventItem {
  id: string;
  minute: number;
  type: string;
  source: "MANUAL" | "REFEREE_REPORT";
  side: "HOME" | "AWAY";
  notes: string | null;
  playerName: string;
  playerNameFr: string | null;
  playerId: string | null;
  staffName?: string | null;
  staffNameFr?: string | null;
  staffId?: string | null;
}

export interface PublicLineupItem {
  playerId: string;
  playerName: string;
  playerNameFr: string;
  playerSlug: string;
  photoUrl: string | null;
  shirtNumber: number | null;
  position: string | null;
  isStarting: boolean;
  isCaptain: boolean;
}

export interface PublicMatchDetail extends PublicMatchItem {
  refereeName: string | null;
  refereeNameAr: string | null;
  refereeNameFr: string | null;
  matchReport: string | null;
  events: PublicMatchEventItem[];
  startingLineup: PublicLineupItem[];
  substitutes: PublicLineupItem[];
  shootoutKicks: Array<{ id: string; side: "HOME" | "AWAY"; attemptNumber: number; result: "SCORED" | "MISSED"; playerName: string; playerNameFr: string | null }>;
}

/** Fetches the current live match first, then the next scheduled match. */
export async function getPublicNextMatch(): Promise<PublicMatchItem | null> {
  const now = new Date();
  const match = await db.match.findFirst({
    where: {
      OR: [
        { status: "LIVE" },
        { status: "SCHEDULED", matchDate: { gte: now } }
      ]
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
      hasExtraTime: true,
      hasPenaltyShootout: true,
      firstHalfAddedTime: true,
      secondHalfAddedTime: true,
      extraTimeFirstHalfAddedTime: true,
      extraTimeSecondHalfAddedTime: true,
      shootoutKicks: { select: { side: true, result: true } },
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "asc" }
  });

  if (!match) return null;

  const opponents = await getOpponentsMap();
  const opponentName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentLogo = findOpponentLogo(opponents, opponentName);
  const result = resolveMatchResult({
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    hasPenaltyShootout: match.hasPenaltyShootout,
    shootoutKicks: match.shootoutKicks
  });

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
    hasExtraTime: match.hasExtraTime,
    hasPenaltyShootout: match.hasPenaltyShootout,
    addedTime: {
      firstHalf: match.firstHalfAddedTime,
      secondHalf: match.secondHalfAddedTime,
      extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
      extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
    },
    homePenaltyScore: match.hasPenaltyShootout ? result.homePenaltyScore : 0,
    awayPenaltyScore: match.hasPenaltyShootout ? result.awayPenaltyScore : 0,
    winnerSide: result.winnerSide,
    decidedByPenalties: result.decidedByPenalties,
    competitionName: match.competition.name,
    teamCategory: match.team?.category ?? null,
    teamName: match.team?.name ?? null,
    opponentLogo
  };
}

/** Fetches live and upcoming scheduled matches across categories (seniors, U20, U17, etc.). */
export async function getPublicUpcomingMatches(limit: number = 6): Promise<PublicMatchItem[]> {
  const now = new Date();
  const matches = await db.match.findMany({
    where: {
      OR: [
        { status: "LIVE" },
        { status: "SCHEDULED", matchDate: { gte: now } }
      ]
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
      hasExtraTime: true,
      hasPenaltyShootout: true,
      firstHalfAddedTime: true,
      secondHalfAddedTime: true,
      extraTimeFirstHalfAddedTime: true,
      extraTimeSecondHalfAddedTime: true,
      shootoutKicks: { select: { side: true, result: true } },
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "asc" },
    take: limit
  });

  const opponents = await getOpponentsMap();

  return matches.map((m) => {
    const opponentName = m.isHomeFixture ? m.awayTeamName : m.homeTeamName;
    const opponentLogo = findOpponentLogo(opponents, opponentName);
    const result = resolveMatchResult({
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      hasPenaltyShootout: m.hasPenaltyShootout,
      shootoutKicks: m.shootoutKicks
    });
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
      hasExtraTime: m.hasExtraTime,
      hasPenaltyShootout: m.hasPenaltyShootout,
      addedTime: {
        firstHalf: m.firstHalfAddedTime,
        secondHalf: m.secondHalfAddedTime,
        extraTimeFirstHalf: m.extraTimeFirstHalfAddedTime,
        extraTimeSecondHalf: m.extraTimeSecondHalfAddedTime
      },
      homePenaltyScore: result.homePenaltyScore,
      awayPenaltyScore: result.awayPenaltyScore,
      winnerSide: result.winnerSide,
      decidedByPenalties: result.decidedByPenalties,
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
      hasExtraTime: true,
      hasPenaltyShootout: true,
      firstHalfAddedTime: true,
      secondHalfAddedTime: true,
      extraTimeFirstHalfAddedTime: true,
      extraTimeSecondHalfAddedTime: true,
      shootoutKicks: { select: { side: true, result: true } },
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: { matchDate: "desc" }
  });

  if (!match) return null;

  const opponents = await getOpponentsMap();
  const opponentName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentLogo = findOpponentLogo(opponents, opponentName);
  const result = resolveMatchResult({
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    hasPenaltyShootout: match.hasPenaltyShootout,
    shootoutKicks: match.shootoutKicks
  });

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
    hasExtraTime: match.hasExtraTime,
    hasPenaltyShootout: match.hasPenaltyShootout,
    addedTime: {
      firstHalf: match.firstHalfAddedTime,
      secondHalf: match.secondHalfAddedTime,
      extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
      extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
    },
    homePenaltyScore: match.hasPenaltyShootout ? result.homePenaltyScore : 0,
    awayPenaltyScore: match.hasPenaltyShootout ? result.awayPenaltyScore : 0,
    winnerSide: result.winnerSide,
    decidedByPenalties: result.decidedByPenalties,
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
  const mode = options?.mode ?? "ALL";
  const where: any = {};

  if (options?.teamCategory) {
    where.team = { category: options.teamCategory };
  }

  if (mode === "UPCOMING") {
    const now = new Date();
    // Old scheduled fixtures are data errors from a visitor's point of view:
    // they belong in history once their kickoff time has passed. Keep live
    // games visible regardless of their original kickoff timestamp.
    where.OR = [
      { status: "LIVE" },
      { status: "SCHEDULED", matchDate: { gte: now } }
    ];
  } else if (mode === "RESULTS") {
    // The Results tab is for completed fixtures. Postponed and cancelled
    // games remain available in the complete fixture list without appearing
    // as if a result had been recorded.
    where.status = "FINISHED";
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
      hasExtraTime: true,
      hasPenaltyShootout: true,
      firstHalfAddedTime: true,
      secondHalfAddedTime: true,
      extraTimeFirstHalfAddedTime: true,
      extraTimeSecondHalfAddedTime: true,
      shootoutKicks: { select: { side: true, result: true } },
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } }
    },
    orderBy: mode === "UPCOMING" ? { matchDate: "asc" } : { matchDate: "desc" },
    take: options?.limit ?? 50
  });

  const opponents = await getOpponentsMap();

  return matches.map((m) => {
    const result = resolveMatchResult({
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      hasPenaltyShootout: m.hasPenaltyShootout,
      shootoutKicks: m.shootoutKicks
    });
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
      hasExtraTime: m.hasExtraTime,
      hasPenaltyShootout: m.hasPenaltyShootout,
      addedTime: {
        firstHalf: m.firstHalfAddedTime,
        secondHalf: m.secondHalfAddedTime,
        extraTimeFirstHalf: m.extraTimeFirstHalfAddedTime,
        extraTimeSecondHalf: m.extraTimeSecondHalfAddedTime
      },
      homePenaltyScore: result.homePenaltyScore,
      awayPenaltyScore: result.awayPenaltyScore,
      winnerSide: result.winnerSide,
      decidedByPenalties: result.decidedByPenalties,
      competitionName: m.competition.name,
      teamCategory: m.team?.category ?? null,
      teamName: m.team?.name ?? null,
      opponentLogo: findOpponentLogo(opponents, m.isHomeFixture ? m.awayTeamName : m.homeTeamName)
    };
  });
}

/** Fetches full public match center details including authorized lineups and events. */
export async function getPublicMatchDetail(id: string): Promise<PublicMatchDetail | null> {
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
      refereeNameAr: true,
      refereeNameFr: true,
      status: true,
      hasExtraTime: true,
      hasPenaltyShootout: true,
      firstHalfAddedTime: true,
      secondHalfAddedTime: true,
      extraTimeFirstHalfAddedTime: true,
      extraTimeSecondHalfAddedTime: true,
      matchReport: true,
      competition: { select: { name: true } },
      team: { select: { category: true, name: true } },
      events: {
        // Technical staff discipline stays internal; only player events appear
        // on the public match center.
        where: { staffId: null, type: { not: "SHOT" } },
        select: {
          id: true,
          minute: true,
          type: true,
          source: true,
          side: true,
          notes: true,
          playerId: true,
          playerName: true,
          playerNameFr: true,
          staffId: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              firstNameFr: true,
              lastNameFr: true
            }
          }
          ,staff: { select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true } }
        },
        orderBy: { minute: "asc" }
      },
      lineups: {
        where: { player: { status: "ACTIVE" }, selectionStatus: { not: "NOT_CALLED" } },
        select: {
          playerId: true,
          position: true,
          shirtNumber: true,
          isStarting: true,
          isCaptain: true,
          player: {
            select: {
              id: true,
              slug: true,
              photoUrl: true,
              position: true,
              shirtNumber: true,
              firstName: true,
              lastName: true,
              firstNameFr: true,
              lastNameFr: true
            }
          }
        },
        orderBy: { isStarting: "desc" }
      },
      shootoutKicks: {
        select: {
          id: true,
          side: true,
          attemptNumber: true,
          result: true,
          playerName: true,
          player: { select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true } }
        },
        orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!match) return null;

  const opponentStoredName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentName = splitClubNameVariants(opponentStoredName).ar || opponentStoredName;
  const opponentLogo = await getOpponentLogo(opponentName);
  const result = resolveMatchResult({
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    hasPenaltyShootout: match.hasPenaltyShootout,
    shootoutKicks: match.shootoutKicks
  });

  const startingLineup: PublicLineupItem[] = match.lineups
    .filter((l) => l.isStarting)
    .map((l) => ({
      playerId: l.player.id,
      playerName: `${l.player.firstName} ${l.player.lastName}`,
      playerNameFr: frenchPublicPersonName(l.player, `${l.player.firstName} ${l.player.lastName}`),
      playerSlug: l.player.slug,
      photoUrl: normalizePublicMediaUrl(l.player.photoUrl),
      shirtNumber: l.shirtNumber ?? l.player.shirtNumber,
      position: l.position || l.player.position,
      isStarting: true,
      isCaptain: l.isCaptain
    }));

  const substitutes: PublicLineupItem[] = match.lineups
    .filter((l) => !l.isStarting)
    .map((l) => ({
      playerId: l.player.id,
      playerName: `${l.player.firstName} ${l.player.lastName}`,
      playerNameFr: frenchPublicPersonName(l.player, `${l.player.firstName} ${l.player.lastName}`),
      playerSlug: l.player.slug,
      photoUrl: normalizePublicMediaUrl(l.player.photoUrl),
      shirtNumber: l.shirtNumber ?? l.player.shirtNumber,
      position: l.position || l.player.position,
      isStarting: false,
      isCaptain: l.isCaptain
    }));

  const events: PublicMatchEventItem[] = match.events.map((e) => ({
    id: e.id,
    minute: e.minute,
    type: e.type,
    source: e.source,
    side: e.side,
    // Card explanations are internal disciplinary details. Keep the database
    // note available to dashboard users, but never serialize it into the
    // public match event payload.
    notes: e.type === "YELLOW_CARD" || e.type === "RED_CARD" || e.notes?.startsWith("__SUBSTITUTION_PAIR__:") ? null : e.notes,
    playerName: e.player
      ? `${e.player.firstName} ${e.player.lastName}`
      : e.playerName && e.playerName !== "—" ? e.playerName : e.playerNameFr || "—",
    playerNameFr: e.player
      ? frenchPublicPersonName(e.player, `${e.player.firstName} ${e.player.lastName}`)
      : e.playerNameFr || (e.playerName && e.playerName !== "—" ? e.playerName : null),
    playerId: e.playerId,
    staffName: e.staff ? `${e.staff.firstName} ${e.staff.lastName}` : null,
    staffNameFr: e.staff ? frenchPublicPersonName(e.staff) : null,
    staffId: e.staffId
  }));

  return {
    id: match.id,
    matchDate: match.matchDate,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    isHomeFixture: match.isHomeFixture,
    opponentLogo,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    stadium: match.stadium,
    refereeName: match.refereeName,
    refereeNameAr: match.refereeNameAr,
    refereeNameFr: match.refereeNameFr,
    status: match.status,
    hasExtraTime: match.hasExtraTime,
    hasPenaltyShootout: match.hasPenaltyShootout,
    addedTime: {
      firstHalf: match.firstHalfAddedTime,
      secondHalf: match.secondHalfAddedTime,
      extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
      extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
    },
    homePenaltyScore: match.hasPenaltyShootout ? result.homePenaltyScore : 0,
    awayPenaltyScore: match.hasPenaltyShootout ? result.awayPenaltyScore : 0,
    winnerSide: result.winnerSide,
    decidedByPenalties: result.decidedByPenalties,
    matchReport: match.matchReport,
    competitionName: match.competition.name,
    teamCategory: match.team?.category ?? null,
    teamName: match.team?.name ?? null,
    events,
    startingLineup,
    substitutes,
    shootoutKicks: match.hasPenaltyShootout ? match.shootoutKicks.map((kick) => ({
      id: kick.id,
      side: kick.side,
      attemptNumber: kick.attemptNumber,
      result: kick.result,
      playerName: kick.playerName,
      playerNameFr: kick.player ? frenchPublicPersonName(kick.player, kick.playerName) : kick.playerName
    })) : []
  };
}
