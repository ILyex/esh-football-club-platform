"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { matchSchema, matchEventSchema, matchLineupEntrySchema, matchShootoutKickSchema } from "@/lib/validations/match";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";
import { getMatchClockState, isShootoutDecided } from "@/lib/matches/clock";
import { resolveShootoutWinner } from "@/lib/matches/result";
import { promoteDueMatchesToLive } from "@/lib/matches/lifecycle";

function normalizeSheetText(value: string): string {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}

function detectLineupFromSheet(text: string, players: Array<{ id: string; firstName: string; lastName: string; shirtNumber: number | null }>) {
  const lines = text.split(/[\r\n]+/).map((line) => normalizeSheetText(line)).filter(Boolean);
  const startingTerms = /اساسي|التشكيله الاساسيه|starting|titulaire|onze de depart/;
  const substituteTerms = /احتياط|بديل|دكه|substitut|remplacant|remplaçant|banc/;
  const found = new Map<string, boolean>();

  for (const player of players) {
    const first = normalizeSheetText(player.firstName);
    const last = normalizeSheetText(player.lastName);
    const number = player.shirtNumber == null ? null : String(player.shirtNumber);
    const line = lines.find((candidate) =>
      (last.length > 2 && candidate.includes(last)) ||
      (first.length > 2 && candidate.includes(first)) ||
      (number && new RegExp(`(?:رقم|n°|#)\\s*${number}(?:\\D|$)`, "i").test(candidate))
    );
    if (!line) continue;
    if (substituteTerms.test(line)) found.set(player.id, false);
    else if (startingTerms.test(line)) found.set(player.id, true);
  }

  return Array.from(found, ([playerId, isStarting]) => ({ playerId, isStarting }));
}

async function wasRedCardedInPreviousMatch(
  match: { teamId: string | null; competitionId: string | null; matchDate: Date },
  playerId: string
) {
  if (!match.teamId || !match.competitionId) return false;
  const previousMatch = await db.match.findFirst({
    where: {
      competitionId: match.competitionId,
      teamId: match.teamId,
      matchDate: { lt: match.matchDate },
      status: "FINISHED"
    },
    orderBy: { matchDate: "desc" },
    select: { events: { where: { type: "RED_CARD", playerId }, select: { id: true }, take: 1 } }
  });
  return Boolean(previousMatch?.events.length);
}

// Match displays use the club's short sporting name; the formal legal name
// remains available in ClubSettings for documents and other official pages.
async function getClubName(): Promise<string> {
  return "نادي أمل سيدي حسني";
}

// Every match write keeps its linked CalendarEvent in sync (spec section
// 65: "عند تعديل Match... يجب أن يظهر التغيير" — including on the Calendar).
async function syncCalendarEvent(matchId: string, title: string, matchDate: Date, teamId: string | null, location: string | null) {
  const endDateTime = new Date(matchDate.getTime() + 2 * 3600 * 1000);
  await db.calendarEvent.upsert({
    where: { relatedMatchId: matchId },
    update: { title, startDateTime: matchDate, endDateTime, teamId, location },
    create: { title, type: "MATCH", startDateTime: matchDate, endDateTime, teamId, location, relatedMatchId: matchId }
  });
}

// Team-scope integrity check: a competition that belongs to a specific team
// (teamId not null) must never be attached to a match for a DIFFERENT team —
// otherwise a match's own team assignment and its competition's team
// assignment could silently disagree, which is exactly the kind of
// team-scope inconsistency a mutation must never be able to create. A
// club-wide competition (teamId null) can be used by any team's match.
async function assertMatchCompetitionTeamConsistency(competitionId: string, matchTeamId: string) {
  const competition = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  if (competition.teamId && competition.teamId !== matchTeamId) {
    throw new Error("competitionTeamMismatch");
  }
}

export async function createMatchAction(formData: FormData) {
  const user = await requirePermission("matches.create");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId, "Match");
  await assertMatchCompetitionTeamConsistency(parsed.competitionId, parsed.teamId);

  // Trust only a validated upload or the server-side logo library lookup;
  // a client-provided URL is never treated as the saved source of truth.
  const opponentLogoFile = formData.get("opponentLogoFile") as File | null;
  let opponentLogoUrl: string | null = null;

  if (opponentLogoFile && opponentLogoFile.size > 0 && opponentLogoFile.name) {
    const { uploadPublicFile, generatePublicStorageKey, validateUploadedImage } = await import("@/lib/storage");
    const buffer = Buffer.from(await opponentLogoFile.arrayBuffer());
    const validated = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("opponents", validated.ext);
    opponentLogoUrl = await uploadPublicFile({ key, buffer, mimeType: validated.mime });
    if (parsed.opponent) {
      const { saveOpponentClub } = await import("@/lib/opponents");
      await saveOpponentClub(parsed.opponent, opponentLogoUrl, parsed.stadium);
    }
  } else if (parsed.opponent) {
    const { getOpponentLogo } = await import("@/lib/opponents");
    opponentLogoUrl = await getOpponentLogo(parsed.opponent);
  }

  const clubName = await getClubName();
  const opponentName = parsed.opponentNameFr?.trim()
    ? `${parsed.opponent.trim()} (${parsed.opponentNameFr.trim()})`
    : parsed.opponent.trim();
  const homeTeamName = parsed.isHomeFixture ? clubName : opponentName;
  const awayTeamName = parsed.isHomeFixture ? opponentName : clubName;
  const lineupEntriesRaw = formData.get("lineupEntries");
  let lineupEntries: ReturnType<typeof matchLineupEntrySchema.parse>[] = [];
  if (typeof lineupEntriesRaw === "string" && lineupEntriesRaw.trim()) {
    let submittedEntries: unknown;
    try {
      submittedEntries = JSON.parse(lineupEntriesRaw);
    } catch {
      throw new Error("invalidLineupEntries");
    }
    if (!Array.isArray(submittedEntries)) throw new Error("invalidLineupEntries");
    const uniqueEntries = new Map(submittedEntries.map((entry) => {
      const parsedEntry = matchLineupEntrySchema.parse(entry);
      return [parsedEntry.playerId, parsedEntry] as const;
    }));
    const lineupPlayers = await db.player.findMany({
      where: { id: { in: [...uniqueEntries.keys()] }, teamId: parsed.teamId, status: { not: "ARCHIVED" } },
      select: { id: true }
    });
    if (lineupPlayers.length !== uniqueEntries.size) throw new Error("invalidLineupPlayer");
    lineupEntries = [...uniqueEntries.values()];
  }

  const match = await db.$transaction(async (tx) => {
    const createdMatch = await tx.match.create({
      data: {
        competitionId: parsed.competitionId,
        teamId: parsed.teamId,
        homeTeamName,
        awayTeamName,
        isHomeFixture: parsed.isHomeFixture,
        matchDate: parsed.matchDate,
        stadium: parsed.stadium,
        refereeName: parsed.refereeNameAr || parsed.refereeName || parsed.refereeNameFr,
        refereeNameAr: parsed.refereeNameAr,
        refereeNameFr: parsed.refereeNameFr,
        status: parsed.status,
        hasExtraTime: parsed.hasExtraTime,
        hasPenaltyShootout: parsed.hasPenaltyShootout,
        firstHalfAddedTime: parsed.firstHalfAddedTime,
        secondHalfAddedTime: parsed.secondHalfAddedTime,
        extraTimeFirstHalfAddedTime: parsed.extraTimeFirstHalfAddedTime,
        extraTimeSecondHalfAddedTime: parsed.extraTimeSecondHalfAddedTime,
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        matchReport: parsed.matchReport
      }
    });

    if (lineupEntries.length > 0) {
      await tx.matchLineup.createMany({
        data: lineupEntries.map((entry) => ({
          matchId: createdMatch.id,
          playerId: entry.playerId,
          isStarting: entry.selectionStatus === "STARTING",
          selectionStatus: entry.selectionStatus,
          position: entry.position || null
        }))
      });
    }

    const endDateTime = new Date(parsed.matchDate.getTime() + 2 * 3600 * 1000);
    await tx.calendarEvent.upsert({
      where: { relatedMatchId: createdMatch.id },
      update: { title: `${homeTeamName} vs ${awayTeamName}`, startDateTime: parsed.matchDate, endDateTime, teamId: parsed.teamId, location: parsed.stadium || null },
      create: { title: `${homeTeamName} vs ${awayTeamName}`, type: "MATCH", startDateTime: parsed.matchDate, endDateTime, teamId: parsed.teamId, location: parsed.stadium || null, relatedMatchId: createdMatch.id }
    });

    await writeAuditLog({ userId: user.id, action: "match.create", entityType: "Match", entityId: createdMatch.id, changes: { after: parsed, opponentLogoUrl } }, tx);
    return createdMatch;
  });

  try {
    revalidatePath("/[locale]/dashboard/matches", "page");
    revalidatePath(`/[locale]/dashboard/matches/${match.id}`, "page");
    revalidatePath("/[locale]/dashboard/calendar", "page");
    revalidatePath("/[locale]/dashboard/competitions", "page");
    revalidatePath("/[locale]/competitions", "page");
    revalidatePath("/[locale]/dashboard/website/analytics", "page");
    revalidatePath("/[locale]/matches", "page");
    revalidatePath("/[locale]", "page"); // homepage next match / latest result
  } catch (error) {
    // Cache refresh must never report a persisted match as a failed save.
    console.error("Match was saved, but cache refresh failed:", error);
  }
  return { id: match.id };
}

export async function updateMatchAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.match.findUniqueOrThrow({ where: { id: matchId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchSchema.parse(raw);
  const homeScore = parsed.homeScore ?? before.homeScore;
  const awayScore = parsed.awayScore ?? before.awayScore;
  if (parsed.status === "FINISHED" && parsed.hasExtraTime && parsed.hasPenaltyShootout && homeScore != null && homeScore === awayScore) {
    const kicks = await db.matchShootoutKick.findMany({ where: { matchId }, select: { side: true, result: true } });
    if (!resolveShootoutWinner(kicks)) throw new Error("shootoutWinnerRequired");
  }
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId, "Match");
  await assertMatchCompetitionTeamConsistency(parsed.competitionId, parsed.teamId);

  // Trust only a validated upload or the server-side logo library lookup.
  const opponentLogoFile = formData.get("opponentLogoFile") as File | null;
  let opponentLogoUrl: string | null = null;

  if (opponentLogoFile && opponentLogoFile.size > 0 && opponentLogoFile.name) {
    const { uploadPublicFile, generatePublicStorageKey, validateUploadedImage } = await import("@/lib/storage");
    const buffer = Buffer.from(await opponentLogoFile.arrayBuffer());
    const validated = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("opponents", validated.ext);
    opponentLogoUrl = await uploadPublicFile({ key, buffer, mimeType: validated.mime });
    if (parsed.opponent) {
      const { saveOpponentClub } = await import("@/lib/opponents");
      await saveOpponentClub(parsed.opponent, opponentLogoUrl, parsed.stadium);
    }
  } else if (parsed.opponent) {
    const { getOpponentLogo } = await import("@/lib/opponents");
    opponentLogoUrl = await getOpponentLogo(parsed.opponent);
  }

  const clubName = await getClubName();
  const opponentName = parsed.opponentNameFr?.trim()
    ? `${parsed.opponent.trim()} (${parsed.opponentNameFr.trim()})`
    : parsed.opponent.trim();
  const homeTeamName = parsed.isHomeFixture ? clubName : opponentName;
  const awayTeamName = parsed.isHomeFixture ? opponentName : clubName;

  const match = await db.match.update({
    where: { id: matchId },
    data: {
      competitionId: parsed.competitionId,
      teamId: parsed.teamId,
      homeTeamName,
      awayTeamName,
      isHomeFixture: parsed.isHomeFixture,
      matchDate: parsed.matchDate,
      stadium: parsed.stadium,
      refereeName: parsed.refereeNameAr || parsed.refereeName || parsed.refereeNameFr,
      refereeNameAr: parsed.refereeNameAr,
      refereeNameFr: parsed.refereeNameFr,
      status: parsed.status,
      hasExtraTime: parsed.hasExtraTime,
      hasPenaltyShootout: parsed.hasPenaltyShootout,
      firstHalfAddedTime: parsed.firstHalfAddedTime,
      secondHalfAddedTime: parsed.secondHalfAddedTime,
      extraTimeFirstHalfAddedTime: parsed.extraTimeFirstHalfAddedTime,
      extraTimeSecondHalfAddedTime: parsed.extraTimeSecondHalfAddedTime,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      matchReport: parsed.matchReport
    }
  });

  await syncCalendarEvent(match.id, `${homeTeamName} vs ${awayTeamName}`, parsed.matchDate, parsed.teamId, parsed.stadium || null);

  await writeAuditLog({
    userId: user.id,
    action: "match.update",
    entityType: "Match",
    entityId: match.id,
    changes: { before, after: parsed }
  });

  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  revalidatePath(`/[locale]/matches/${match.id}`, "page");
  revalidatePath(`/[locale]/dashboard/matches/${match.id}`, "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  return { id: match.id };
}

export async function updateMatchStatusAction(matchId: string, status: string) {
  const user = await requirePermission("matches.update");
  const allowedStatuses = ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"] as const;
  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) throw new Error("invalidMatchStatus");

  const scopeContext = await getMutationScopeContext();
  const before = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, before.teamId, "Match");

  const nextStatus = status as (typeof allowedStatuses)[number];
  if (nextStatus === "FINISHED" && before.hasExtraTime && before.hasPenaltyShootout && before.homeScore != null && before.homeScore === before.awayScore) {
    const kicks = await db.matchShootoutKick.findMany({ where: { matchId }, select: { side: true, result: true } });
    if (!resolveShootoutWinner(kicks)) throw new Error("shootoutWinnerRequired");
  }
  const match = await db.match.update({
    where: { id: matchId },
    data: {
      status: nextStatus,
      ...(nextStatus === "LIVE" && before.status !== "LIVE" ? { matchDate: new Date() } : {})
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "match.update",
    entityType: "Match",
    entityId: match.id,
    changes: { before: { status: before.status }, after: { status: nextStatus, matchDate: match.matchDate } }
  });

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  return { status: nextStatus, matchDate: match.matchDate };
}

export async function deleteMatchAction(matchId: string) {
  const user = await requirePermission("matches.delete");
  const scopeContext = await getMutationScopeContext();
  const before = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, before.teamId, "Match");

  await db.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { relatedMatchId: matchId } });
    await tx.match.delete({ where: { id: matchId } });
  }); // MatchEvent and MatchLineup cascade with the match.

  await writeAuditLog({ userId: user.id, action: "match.delete", entityType: "Match", entityId: matchId });
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
}

export async function addMatchEventAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  // The official report can be completed after the final whistle.
  if (match.status !== "LIVE" && match.status !== "FINISHED") throw new Error("matchMustBeLive");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchEventSchema.parse(raw);
  const clubSide = match.isHomeFixture ? "HOME" : "AWAY";
  const isOpponentEvent = parsed.side !== clubSide;
  const playerId = parsed.entityType === "PLAYER" ? parsed.playerId || null : null;
  const staffId = parsed.entityType === "STAFF" && !isOpponentEvent ? parsed.staffId || null : null;
  let playerName = parsed.entityType === "PLAYER" || isOpponentEvent ? parsed.playerName || parsed.playerNameFr || null : null;
  let playerNameFr = parsed.entityType === "PLAYER" || isOpponentEvent ? parsed.playerNameFr || null : null;

  if (parsed.entityType === "STAFF" && !isOpponentEvent && !staffId) throw new Error("staffMemberRequired");
  if (parsed.entityType === "STAFF" && isOpponentEvent && !playerName) throw new Error("opponentStaffNameRequired");

  if (playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
    // SECURITY FIX: Keep event player selection bound to the match roster for every role.
    if (player.teamId !== match.teamId || parsed.side !== (match.isHomeFixture ? "HOME" : "AWAY")) {
      throw new Error("matchEventPlayerSideMismatch");
    }
    playerName = `${player.firstName} ${player.lastName}`;
    playerNameFr = [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ").trim() || null;
  }
  if (staffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
    if (staff.teamId !== match.teamId || parsed.side !== (match.isHomeFixture ? "HOME" : "AWAY")) {
      throw new Error("matchEventStaffSideMismatch");
    }
  }

  const event = await db.$transaction(async (tx) => {
    const created = await tx.matchEvent.create({
      data: {
        matchId,
        playerId,
        staffId,
        playerName,
        playerNameFr,
        type: parsed.type,
        side: parsed.side,
        source: "MANUAL",
        minute: parsed.minute,
        notes: parsed.notes
      }
    });
    if (parsed.type === "GOAL" || parsed.type === "PENALTY_GOAL" || parsed.type === "OWN_GOAL") {
      await tx.match.update({
        where: { id: matchId },
        data: parsed.side === "HOME"
          ? { homeScore: { increment: 1 } }
          : { awayScore: { increment: 1 } }
      });
    }
    return created;
  });

  await writeAuditLog({
    userId: user.id,
    action: "match.event.create",
    entityType: "MatchEvent",
    entityId: event.id,
    changes: { after: parsed }
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

export async function updateMatchEventAction(matchId: string, eventId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const event = await db.matchEvent.findUniqueOrThrow({ where: { id: eventId }, include: { match: true } });
  if (event.matchId !== matchId) throw new Error("eventMatchMismatch");
  assertTeamScope(scopeContext, event.match.teamId, "Match");
  if (event.match.status !== "LIVE" && event.match.status !== "FINISHED") throw new Error("matchEventNotEditable");

  const parsed = matchEventSchema.parse({
    entityType: "PLAYER",
    playerName: formData.get("playerName"),
    type: formData.get("type"),
    side: formData.get("side"),
    minute: formData.get("minute")
  });
  const playerName = parsed.playerName?.trim() || null;
  const keepLinkedPlayer = Boolean(event.playerId && playerName === event.playerName);
  const scores = new Set(["GOAL", "PENALTY_GOAL", "OWN_GOAL"]);
  const oldScored = scores.has(event.type);
  const nextScored = scores.has(parsed.type);
  const homeDelta = (nextScored && parsed.side === "HOME" ? 1 : 0) - (oldScored && event.side === "HOME" ? 1 : 0);
  const awayDelta = (nextScored && parsed.side === "AWAY" ? 1 : 0) - (oldScored && event.side === "AWAY" ? 1 : 0);

  await db.$transaction(async (tx) => {
    await tx.matchEvent.update({
      where: { id: eventId },
      data: {
        type: parsed.type,
        side: parsed.side,
        minute: parsed.minute,
        playerName,
        playerNameFr: keepLinkedPlayer ? event.playerNameFr : null,
        playerId: keepLinkedPlayer ? event.playerId : null,
        staffId: null
      }
    });
    if (homeDelta || awayDelta) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          ...(homeDelta ? { homeScore: Math.max(0, (event.match.homeScore ?? 0) + homeDelta) } : {}),
          ...(awayDelta ? { awayScore: Math.max(0, (event.match.awayScore ?? 0) + awayDelta) } : {})
        }
      });
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "match.event.update",
    entityType: "MatchEvent",
    entityId: eventId,
    changes: { before: { type: event.type, side: event.side, minute: event.minute, playerName: event.playerName }, after: parsed }
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
}

export async function deleteMatchEventAction(matchId: string, eventId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const event = await db.matchEvent.findUniqueOrThrow({ where: { id: eventId }, include: { match: true } });
  if (event.matchId !== matchId) {
    throw new Error("eventMatchMismatch");
  }
  assertTeamScope(scopeContext, event.match.teamId, "Match");

  await db.$transaction(async (tx) => {
    await tx.matchEvent.delete({ where: { id: eventId } });
    if (event.type === "GOAL" || event.type === "PENALTY_GOAL" || event.type === "OWN_GOAL") {
      await tx.match.update({
        where: { id: matchId },
        data: event.side === "HOME"
          ? { homeScore: Math.max(0, (event.match.homeScore ?? 0) - 1) }
          : { awayScore: Math.max(0, (event.match.awayScore ?? 0) - 1) }
      });
    }
  });

  await writeAuditLog({ userId: user.id, action: "match.event.delete", entityType: "MatchEvent", entityId: eventId });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
}

export async function addShootoutKickAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (match.status !== "LIVE" || !match.hasPenaltyShootout) throw new Error("shootoutNotAvailable");
  const clock = getMatchClockState(match.matchDate, new Date(), match.hasExtraTime, match.hasPenaltyShootout, match.homeScore, match.awayScore, {
    firstHalf: match.firstHalfAddedTime,
    secondHalf: match.secondHalfAddedTime,
    extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
    extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
  });
  if (clock.phase !== "PENALTIES") throw new Error("shootoutNotStarted");

  const parsed = matchShootoutKickSchema.parse(Object.fromEntries(formData.entries()));
  const playerId = parsed.playerId || null;
  let playerName = parsed.playerName;
  if (playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
    const clubSide = match.isHomeFixture ? "HOME" : "AWAY";
    if (player.teamId !== match.teamId || parsed.side !== clubSide || player.status !== "ACTIVE") {
      throw new Error("shootoutPlayerMismatch");
    }
    playerName = `${player.firstName} ${player.lastName}`;
  } else if (parsed.side === (match.isHomeFixture ? "HOME" : "AWAY")) {
    throw new Error("shootoutPlayerRequired");
  }

  const existingSideKicks = await db.matchShootoutKick.count({ where: { matchId, side: parsed.side } });
  const kick = await db.matchShootoutKick.create({
    data: {
      matchId,
      playerId,
      playerName,
      side: parsed.side,
      attemptNumber: existingSideKicks + 1,
      result: parsed.result
    }
  });
  const allKicks = await db.matchShootoutKick.findMany({ where: { matchId }, select: { side: true, attemptNumber: true, result: true } });
  const shootoutDecided = isShootoutDecided(allKicks);

  await writeAuditLog({
    userId: user.id,
    action: "match.shootout_kick.create",
    entityType: "MatchShootoutKick",
    entityId: kick.id,
    changes: { after: { ...parsed, playerId, playerName, attemptNumber: kick.attemptNumber }, shootoutDecided }
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

export async function deleteShootoutKickAction(matchId: string, kickId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (!match.hasPenaltyShootout || (match.status !== "LIVE" && match.status !== "FINISHED")) {
    throw new Error("shootoutNotAvailable");
  }

  const kick = await db.matchShootoutKick.findUnique({ where: { id: kickId } });
  if (!kick || kick.matchId !== matchId) throw new Error("shootoutKickNotFound");

  await db.$transaction(async (tx) => {
    await tx.matchShootoutKick.delete({ where: { id: kickId } });
    const remainingSideKicks = await tx.matchShootoutKick.findMany({
      where: { matchId, side: kick.side },
      orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }],
      select: { id: true, attemptNumber: true }
    });
    for (const [index, remainingKick] of remainingSideKicks.entries()) {
      const nextAttemptNumber = index + 1;
      if (remainingKick.attemptNumber !== nextAttemptNumber) {
        await tx.matchShootoutKick.update({
          where: { id: remainingKick.id },
          data: { attemptNumber: nextAttemptNumber }
        });
      }
    }
  });

  const remainingKicks = await db.matchShootoutKick.findMany({
    where: { matchId },
    select: { side: true, attemptNumber: true, result: true }
  });
  const finished = isShootoutDecided(remainingKicks);
  if (match.status === "LIVE" || match.status === "FINISHED") {
    await db.match.update({ where: { id: matchId }, data: { status: finished ? "FINISHED" : "LIVE" } });
  }

  await writeAuditLog({
    userId: user.id,
    action: "match.shootout_kick.delete",
    entityType: "MatchShootoutKick",
    entityId: kickId,
    changes: { before: kick, matchFinished: finished }
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

export async function upsertLineupEntryAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (match.status !== "LIVE" && match.status !== "SCHEDULED") throw new Error("lineupNotAvailable");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchLineupEntrySchema.parse(raw);

  const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId } });
  assertTeamScope(scopeContext, player.teamId, "Player");

  if (player.status === "INJURED" && parsed.selectionStatus !== "INJURED") throw new Error("lineupPlayerInjured");
  if (player.status === "SUSPENDED" && parsed.selectionStatus !== "SUSPENDED") throw new Error("lineupPlayerSuspended");

  if (parsed.selectionStatus === "STARTING") {
    const currentStarters = await db.matchLineup.count({
      where: { matchId, selectionStatus: "STARTING", playerId: { not: parsed.playerId } }
    });
    if (currentStarters >= 11) throw new Error("lineupStartingLimit");
  }

  const automaticallySuspended = await wasRedCardedInPreviousMatch(match, parsed.playerId);
  if (automaticallySuspended && parsed.selectionStatus !== "SUSPENDED") throw new Error("lineupPlayerSuspended");

  const isStarting = parsed.selectionStatus === "STARTING";
  await db.matchLineup.upsert({
    where: { matchId_playerId: { matchId, playerId: parsed.playerId } },
    update: { isStarting, selectionStatus: parsed.selectionStatus, position: parsed.position },
    create: { matchId, playerId: parsed.playerId, isStarting, selectionStatus: parsed.selectionStatus, position: parsed.position }
  });

  await writeAuditLog({
    userId: user.id,
    action: "match.lineup.upsert",
    entityType: "MatchLineup",
    entityId: `${matchId}:${parsed.playerId}`,
    changes: { after: parsed }
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

export async function syncPreviousMatchRedCardSuspensionsAction(matchId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if ((match.status !== "LIVE" && match.status !== "SCHEDULED") || !match.teamId || !match.competitionId) return [];

  const previousMatch = await db.match.findFirst({
    where: {
      competitionId: match.competitionId,
      teamId: match.teamId,
      matchDate: { lt: match.matchDate },
      status: "FINISHED"
    },
    orderBy: { matchDate: "desc" },
    select: {
      events: { where: { type: "RED_CARD", playerId: { not: null } }, select: { playerId: true } }
    }
  });
  const playerIds = Array.from(new Set(previousMatch?.events.flatMap((event) => event.playerId ? [event.playerId] : []) ?? []));
  if (playerIds.length === 0) return [];

  const eligiblePlayers = await db.player.findMany({
    where: { id: { in: playerIds }, teamId: match.teamId, status: { not: "ARCHIVED" } },
    select: { id: true, position: true }
  });
  for (const player of eligiblePlayers) {
    await db.matchLineup.upsert({
      where: { matchId_playerId: { matchId, playerId: player.id } },
      update: { isStarting: false, selectionStatus: "SUSPENDED" },
      create: { matchId, playerId: player.id, isStarting: false, selectionStatus: "SUSPENDED", position: player.position }
    });
  }

  if (eligiblePlayers.length > 0) {
    await writeAuditLog({
      userId: user.id,
      action: "match.lineup.auto_suspend",
      entityType: "Match",
      entityId: matchId,
      changes: { playerIds: eligiblePlayers.map((player) => player.id), source: "previous_match_red_cards" }
    });
    revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
    revalidatePath(`/[locale]/matches/${matchId}`, "page");
  }
  return eligiblePlayers.map((player) => player.id);
}

export async function removeLineupEntryAction(matchId: string, playerId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, select: { status: true } });
  if (player.status === "INJURED") throw new Error("lineupPlayerInjured");
  if (player.status === "SUSPENDED") throw new Error("lineupPlayerSuspended");
  if (await wasRedCardedInPreviousMatch(match, playerId)) throw new Error("lineupPlayerSuspended");

  await db.matchLineup.delete({ where: { matchId_playerId: { matchId, playerId } } });

  await writeAuditLog({
    userId: user.id,
    action: "match.lineup.remove",
    entityType: "MatchLineup",
    entityId: `${matchId}:${playerId}`
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

export async function attachMatchSheetAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  await promoteDueMatchesToLive();
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const file = formData.get("sheetFile") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No sheet file provided");
  }

  const requestedSheetType = formData.get("sheetType");
  if (requestedSheetType !== null && requestedSheetType !== "PRE_MATCH_SHEET" && requestedSheetType !== "PRE_MATCH" && requestedSheetType !== "REFEREE_REPORT") {
    throw new Error("Invalid match document type");
  }
  const sheetType = requestedSheetType === "REFEREE_REPORT" ? "REFEREE_REPORT" : "PRE_MATCH_SHEET";
  const locale = formData.get("locale") === "fr" ? "fr" : "ar";

  if (sheetType === "PRE_MATCH_SHEET") {
    const withinPreMatchWindow = match.status === "SCHEDULED" &&
      match.matchDate.getTime() > Date.now() &&
      match.matchDate.getTime() - Date.now() <= 30 * 60 * 1000;
    if (match.status !== "LIVE" && !withinPreMatchWindow) {
      throw new Error("preMatchSheetUploadUnavailable");
    }
  }

  const { validateUploadedFile, uploadPrivateFile, generateStorageKey } = await import("@/lib/storage");
  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = await validateUploadedFile(buffer);

  let category = await db.documentCategory.findFirst({
    where: {
      OR: [
        { key: "report" },
        { name: "Reports" },
        { key: "administrative" },
        { name: "Administrative Documents" }
      ]
    }
  });
  if (!category) {
    category = await db.documentCategory.findFirst();
  }
  if (!category) {
    throw new Error("No document category found.");
  }

  const storageKey = generateStorageKey("match-sheets", validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const titlePrefix =
    sheetType === "REFEREE_REPORT"
      ? locale === "ar" ? "تقرير حكم اللقاء" : "Rapport d’arbitrage"
      : locale === "ar" ? "ورقة التشكيل قبل المباراة" : "Feuille de composition avant match";

  const title = `${titlePrefix} — ${match.homeTeamName} ${locale === "ar" ? "ضد" : "contre"} ${match.awayTeamName}`;
  const doc = await db.document.create({
    data: {
      name: title,
      categoryId: category.id,
      classification: "INTERNAL",
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      relatedMatchId: match.id,
      matchDocumentType: sheetType,
      teamId: match.teamId,
      status: "PENDING_REVIEW"
    }
  });

  let lineupsAdded = 0;
  let aiFallback: "quota" | "unavailable" | undefined;
  const shouldExtractLineup = sheetType === "PRE_MATCH_SHEET" && formData.getAll("autoLineup").includes("true");
  if (shouldExtractLineup && match.teamId) {
    try {
      const { extractDocumentText } = await import("@/lib/ai/document-verifier");
      const extractedText = await extractDocumentText(buffer, validated.mime, (reason) => { aiFallback = reason; });
      if (extractedText) {
        const roster = await db.player.findMany({
          where: { teamId: match.teamId, status: { not: "ARCHIVED" } },
          select: { id: true, firstName: true, lastName: true, shirtNumber: true }
        });
        const detectedLineups = detectLineupFromSheet(extractedText, roster);
        if (detectedLineups.length > 0) {
          const result = await db.matchLineup.createMany({
            data: detectedLineups.map((entry) => ({ matchId: match.id, ...entry })),
            skipDuplicates: true
          });
          lineupsAdded = result.count;
        }
      }
    } catch (error) {
      // Uploading the official sheet must still succeed when OCR/text
      // extraction is unavailable; the user can add the lineup manually.
      console.warn("[MatchSheet] Automatic lineup extraction skipped", error);
    }
  }

  await writeAuditLog({
    userId: user.id,
    action: "match.sheet_attached",
    entityType: "Match",
    entityId: match.id,
    changes: { documentId: doc.id, filename: file.name, sheetType, reviewStatus: doc.status, lineupsAdded }
  });

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  return {
    success: true,
    documentId: doc.id,
    lineupsAdded,
    ...(aiFallback ? { warning: locale === "ar"
      ? aiFallback === "quota" ? "انتهت حصة الذكاء الاصطناعي اليوم؛ تم حفظ الورقة ويمكن إدخال التشكيلة يدوياً." : "الذكاء الاصطناعي غير متاح؛ تم حفظ الورقة ويمكن إدخال التشكيلة يدوياً."
      : aiFallback === "quota" ? "Quota IA épuisé aujourd’hui ; la feuille est enregistrée et la composition peut être saisie manuellement." : "IA indisponible ; la feuille est enregistrée et la composition peut être saisie manuellement." } : {})
  };
}

export async function syncFAFMatchDocumentsAction(matchId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const { syncFafMatchDocuments } = await import("@/lib/integrations/faf/match-sheet-sync");
  const result = await syncFafMatchDocuments(matchId, user.id);
  return result;
}

export async function analyzeRefereeReportWithAIAction(matchId: string, formData?: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const reportText = formData ? (formData.get("reportText") as string) : undefined;
  const { parseAndApplyRefereeReportWithAI } = await import("@/lib/ai/referee-report-ai-service");

  return await parseAndApplyRefereeReportWithAI({
    matchId,
    reportText,
    userId: user.id
  });
}
