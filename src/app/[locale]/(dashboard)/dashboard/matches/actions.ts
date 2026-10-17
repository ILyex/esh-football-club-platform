"use server";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { matchSchema, matchEventSchema, matchLineupEntrySchema, matchShootoutKickSchema } from "@/lib/validations/match";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { getMatchClockState, isShootoutDecided } from "@/lib/matches/clock";
import { resolveShootoutWinner } from "@/lib/matches/result";
import { getFAFConfig } from "@/lib/integrations/faf/config";
import { importUpcomingFafMatches } from "@/lib/integrations/faf/scheduled-match-import";
import { enqueueFAFMatchSyncJob } from "@/lib/integrations/faf/job-handler";
import { enqueueJob } from "@/lib/jobs/queue";
import { processQueuedJobAfterResponse } from "@/lib/jobs/after-response";
import { enqueueRefereeReportAnalysis } from "@/lib/ai/referee-report-job";
import { applyMatchSheetLineup } from "@/lib/matches/lineup-from-sheet";
import { createMatchPushOutbox, enqueueMatchPushOutbox } from "@/lib/push/match-push";
import { estimateShotXg } from "@/lib/matches/xg";

function revalidatePath(...args: Parameters<typeof nextRevalidatePath>) {
  try {
    nextRevalidatePath(...args);
  } catch (error) {
    console.error("Match saved, but cache refresh failed:", error instanceof Error ? error.message : "unknown error");
  }
}

async function enqueueAutomaticFafMatchSync(matchId: string, userId: string) {
  const config = getFAFConfig();
  if (!config.enabled || !config.hasCredentials) return;
  try {
    await enqueueFAFMatchSyncJob(db, { matchId, userId });
  } catch (error) {
    console.error("Could not queue the FAF EMS match import:", error instanceof Error ? error.message : "unknown error");
  }
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
async function syncCalendarEvent(tx: Pick<Prisma.TransactionClient, "calendarEvent">, matchId: string, title: string, matchDate: Date, teamId: string | null, location: string | null) {
  const endDateTime = new Date(matchDate.getTime() + 2 * 3600 * 1000);
  await tx.calendarEvent.upsert({
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
  const validation = matchSchema.safeParse(raw);
  if (!validation.success) {
    const locale = formData.get("locale") === "fr" ? "fr" : "ar";
    const field = String(validation.error.issues[0]?.path[0] ?? "");
    const fieldMessages: Record<string, { ar: string; fr: string }> = {
      teamId: { ar: "اختر فئة الفريق قبل حفظ المباراة.", fr: "Choisissez la catégorie de l’équipe avant d’enregistrer." },
      competitionId: { ar: "اختر المسابقة قبل حفظ المباراة.", fr: "Choisissez une compétition avant d’enregistrer." },
      opponent: { ar: "أدخل اسم الفريق الخصم.", fr: "Saisissez le nom de l’équipe adverse." },
      matchDate: { ar: "أدخل تاريخاً ووقتاً صالحين للمباراة.", fr: "Saisissez une date et une heure valides." },
      refereeName: { ar: "أدخل أربعة أسماء حكام كحد أقصى.", fr: "Saisissez au maximum quatre noms d’arbitres." },
      refereeNameAr: { ar: "أدخل أربعة أسماء حكام كحد أقصى.", fr: "Saisissez au maximum quatre noms d’arbitres." },
      refereeNameFr: { ar: "أدخل أربعة أسماء حكام كحد أقصى.", fr: "Saisissez au maximum quatre noms d’arbitres." }
    };
    const message = fieldMessages[field]?.[locale] ?? (locale === "fr"
      ? "Certaines données du match sont invalides. Vérifiez les champs puis réessayez."
      : "بعض بيانات المباراة غير صالحة. راجع الحقول ثم أعد المحاولة.");
    return { formError: { field, message } };
  }
  const parsed = validation.data;
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
    const [lineupPlayers, targetTeam] = await Promise.all([
      db.player.findMany({
        where: { id: { in: [...uniqueEntries.keys()] }, status: { not: "ARCHIVED" } },
        select: { id: true, teamId: true, team: { select: { category: true } } }
      }),
      db.team.findUniqueOrThrow({ where: { id: parsed.teamId }, select: { category: true } })
    ]);
    const eligibleIds = new Set(lineupPlayers.filter((player) =>
      player.teamId === parsed.teamId || (targetTeam.category === "SENIOR" && player.team?.category === "U20")
    ).map((player) => player.id));
    if (eligibleIds.size !== uniqueEntries.size) throw new Error("invalidLineupPlayer");
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

export async function importUpcomingFafMatchesAction() {
  const user = await requirePermission("matches.create");
  const scopeContext = await getMutationScopeContext();
  const result = await importUpcomingFafMatches({
    actorId: user.id,
    allowedTeamIds: scopeContext.isUnrestricted ? null : scopeContext.authorizedTeamIds,
    lookAheadDays: 14
  });
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  return result;
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

  const { match, outbox } = await db.$transaction(async (tx) => {
    const updated = await tx.match.update({
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
    await syncCalendarEvent(tx, updated.id, `${homeTeamName} vs ${awayTeamName}`, updated.matchDate, updated.teamId, updated.stadium || null);
    let notification = null;
    if (updated.teamId && before.status !== updated.status && (updated.status === "LIVE" || updated.status === "FINISHED")) {
      const team = await tx.team.findUnique({ where: { id: updated.teamId }, select: { category: true } });
      if (team) {
        notification = await createMatchPushOutbox(tx, {
          dedupKey: `${updated.status === "LIVE" ? "MATCH_STARTED" : "MATCH_FINISHED"}:${updated.id}:${updated.matchDate.getTime()}`,
          matchId: updated.id,
          kind: updated.status === "LIVE" ? "MATCH_STARTED" : "MATCH_FINISHED",
          payload: {
            matchId: updated.id,
            category: team.category,
            homeTeamName,
            awayTeamName,
            homeScore: updated.homeScore,
            awayScore: updated.awayScore
          }
        });
      }
    }
    await writeAuditLog({
      userId: user.id,
      action: "match.update",
      entityType: "Match",
      entityId: updated.id,
      changes: { before, after: parsed }
    }, tx);
    return { match: updated, outbox: notification };
  });
  if (outbox) await enqueueMatchPushOutbox(outbox.id);

  if (parsed.status === "FINISHED" && before.status !== "FINISHED") {
    await enqueueAutomaticFafMatchSync(match.id, user.id);
  }

  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  revalidatePath(`/[locale]/matches/${match.id}`, "page");
  revalidatePath(`/[locale]/dashboard/matches/${match.id}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  return { success: true, id: match.id, matchDate: match.matchDate.toISOString() };
}

export async function updateMatchStatusAction(matchId: string, status: string) {
  const user = await requirePermission("matches.update");
  const allowedStatuses = ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"] as const;
  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) throw new Error("invalidMatchStatus");

  const scopeContext = await getMutationScopeContext();
  const before = await db.match.findUniqueOrThrow({ where: { id: matchId }, include: { team: { select: { category: true } } } });
  assertTeamScope(scopeContext, before.teamId, "Match");

  const nextStatus = status as (typeof allowedStatuses)[number];
  if (nextStatus === "FINISHED" && before.hasExtraTime && before.hasPenaltyShootout && before.homeScore != null && before.homeScore === before.awayScore) {
    const kicks = await db.matchShootoutKick.findMany({ where: { matchId }, select: { side: true, result: true } });
    if (!resolveShootoutWinner(kicks)) throw new Error("shootoutWinnerRequired");
  }
  const { match, outbox } = await db.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: nextStatus,
        ...(nextStatus === "LIVE" && before.status !== "LIVE" ? { matchDate: new Date() } : {})
      }
    });
    await syncCalendarEvent(tx, updated.id, `${updated.homeTeamName} vs ${updated.awayTeamName}`, updated.matchDate, updated.teamId, updated.stadium || null);
    const shouldNotify = before.status !== nextStatus && (nextStatus === "LIVE" || nextStatus === "FINISHED") && before.teamId && before.team?.category;
    const notification = shouldNotify
      ? await createMatchPushOutbox(tx, {
          dedupKey: `${nextStatus === "LIVE" ? "MATCH_STARTED" : "MATCH_FINISHED"}:${updated.id}:${updated.matchDate.getTime()}`,
          matchId: updated.id,
          kind: nextStatus === "LIVE" ? "MATCH_STARTED" : "MATCH_FINISHED",
          payload: {
            matchId: updated.id,
            category: before.team?.category ?? null,
            homeTeamName: updated.homeTeamName,
            awayTeamName: updated.awayTeamName,
            homeScore: updated.homeScore,
            awayScore: updated.awayScore
          }
        })
      : null;
    await writeAuditLog({
      userId: user.id,
      action: "match.update",
      entityType: "Match",
      entityId: updated.id,
      changes: { before: { status: before.status }, after: { status: nextStatus, matchDate: updated.matchDate } }
    }, tx);
    return { match: updated, outbox: notification };
  });
  if (outbox) await enqueueMatchPushOutbox(outbox.id);

  if (nextStatus === "FINISHED" && before.status !== "FINISHED") {
    await enqueueAutomaticFafMatchSync(match.id, user.id);
  }

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
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
    await writeAuditLog({ userId: user.id, action: "match.delete", entityType: "Match", entityId: matchId, changes: { before } }, tx);
  }); // MatchEvent and MatchLineup cascade with the match.
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
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, include: { team: { select: { category: true } } } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  // The official report can be completed after the final whistle.
  if (match.status !== "LIVE" && match.status !== "FINISHED") throw new Error("matchMustBeLive");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchEventSchema.parse(raw);
  const clubSide = match.isHomeFixture ? "HOME" : "AWAY";
  const isOpponentEvent = parsed.side !== clubSide;
  const playerId = parsed.entityType === "PLAYER" ? parsed.playerId || null : null;
  const assistPlayerId = parsed.assistPlayerId || null;
  const staffId = parsed.entityType === "STAFF" && !isOpponentEvent ? parsed.staffId || null : null;
  let playerName = parsed.entityType === "PLAYER" || isOpponentEvent ? parsed.playerName || parsed.playerNameFr || null : null;
  let playerNameFr = parsed.entityType === "PLAYER" || isOpponentEvent ? parsed.playerNameFr || null : null;

  // A club player's card must be tied to the canonical Player row so that it
  // appears in their profile and season statistics. Free-text names are only
  // acceptable for opponent events, which do not belong to our player records.
  if (parsed.entityType === "PLAYER" && !isOpponentEvent && !playerId && (parsed.type === "YELLOW_CARD" || parsed.type === "RED_CARD")) {
    throw new Error("matchEventPlayerRequired");
  }

  if (parsed.entityType === "STAFF" && !isOpponentEvent && !staffId) throw new Error("staffMemberRequired");
  if (parsed.entityType === "STAFF" && isOpponentEvent && !playerName) throw new Error("opponentStaffNameRequired");

  if (playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: { select: { category: true } } } });
    const isMatchPlayer = player.teamId === match.teamId || (match.team?.category === "SENIOR" && player.team?.category === "U20");
    // SECURITY FIX: Keep event player selection bound to the match roster for every role.
    const isSelectedForMatch = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId } }, select: { playerId: true } });
    if (!isMatchPlayer || (player.teamId !== match.teamId && !isSelectedForMatch) || parsed.side !== (match.isHomeFixture ? "HOME" : "AWAY")) {
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

  const isShotRecord = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED"].includes(parsed.type);
  if (isShotRecord && parsed.entityType !== "PLAYER") throw new Error("shotRequiresPlayerEvent");
  if (assistPlayerId) {
    if (!playerId || parsed.side !== clubSide || assistPlayerId === playerId || !["GOAL", "PENALTY_GOAL"].includes(parsed.type)) {
      throw new Error("invalidGoalAssist");
    }
    const assist = await db.player.findUniqueOrThrow({ where: { id: assistPlayerId }, select: { id: true, teamId: true, team: { select: { category: true } } } });
    const isMatchPlayer = assist.teamId === match.teamId || (match.team?.category === "SENIOR" && assist.team?.category === "U20");
    const isSelectedForMatch = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId: assistPlayerId } }, select: { playerId: true } });
    if (!isMatchPlayer || (assist.teamId !== match.teamId && !isSelectedForMatch)) throw new Error("matchAssistPlayerMismatch");
  }

  const shotSituation = parsed.type === "PENALTY_GOAL" || parsed.type === "PENALTY_MISSED"
    ? "PENALTY"
    : parsed.shotSituation ?? "OPEN_PLAY";
  const shotOutcome = parsed.type === "PENALTY_MISSED"
    ? "PENALTY_MISSED"
    : parsed.type === "GOAL" || parsed.type === "PENALTY_GOAL"
      ? "GOAL"
      : parsed.shotOutcome ?? "SAVED";
  const shotXg = isShotRecord ? estimateShotXg({ x: parsed.shotX, y: parsed.shotY, bodyPart: parsed.bodyPart, situation: shotSituation }) : null;

  const { event, outbox } = await db.$transaction(async (tx) => {
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
    if (isShotRecord) {
      await tx.playerShot.create({
        data: {
          matchId,
          matchEventId: created.id,
          playerId,
          assistPlayerId,
          side: parsed.side,
          minute: parsed.minute,
          bodyPart: parsed.bodyPart ?? "UNKNOWN",
          situation: shotSituation,
          outcome: shotOutcome,
          x: parsed.shotX,
          y: parsed.shotY,
          xG: shotXg,
          xgModelVersion: "esh-xg-v1"
        }
      });
    }
    const isGoal = parsed.type === "GOAL" || parsed.type === "PENALTY_GOAL" || parsed.type === "OWN_GOAL";
    let homeScore = match.homeScore ?? 0;
    let awayScore = match.awayScore ?? 0;
    if (isGoal) {
      await tx.match.update({
        where: { id: matchId },
        data: parsed.side === "HOME"
          ? { homeScore: { increment: 1 } }
          : { awayScore: { increment: 1 } }
      });
      if (parsed.side === "HOME") homeScore++;
      else awayScore++;
    }
    const notification = isGoal && match.status === "LIVE" && match.team?.category
      ? await createMatchPushOutbox(tx, {
          dedupKey: `GOAL:${created.id}`,
          matchId,
          matchEventId: created.id,
          kind: "GOAL",
          payload: {
            matchId,
            category: match.team.category,
            homeTeamName: match.homeTeamName,
            awayTeamName: match.awayTeamName,
            homeScore,
            awayScore,
            minute: parsed.minute,
            side: parsed.side
          }
        })
      : null;
    await writeAuditLog({
      userId: user.id,
      action: "match.event.create",
      entityType: "MatchEvent",
      entityId: created.id,
      changes: { after: parsed }
    }, tx);
    return { event: created, outbox: notification };
  });

  if (outbox) await enqueueMatchPushOutbox(outbox.id);

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
}

/** The field-operations screen records detailed shot metadata for player stats. */
export async function addFieldMatchEventAction(matchId: string, formData: FormData) {
  await requirePermission("matches.report");
  const fieldFormData = new FormData();
  formData.forEach((value, key) => fieldFormData.append(key, value));
  fieldFormData.set("shotDetailsRequired", "true");
  await addMatchEventAction(matchId, fieldFormData);
}

export async function updateMatchEventAction(matchId: string, eventId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const event = await db.matchEvent.findUniqueOrThrow({ where: { id: eventId }, include: { match: { include: { team: { select: { category: true } } } }, shot: true } });
  if (event.matchId !== matchId) throw new Error("eventMatchMismatch");
  assertTeamScope(scopeContext, event.match.teamId, "Match");
  if (event.match.status !== "LIVE" && event.match.status !== "FINISHED") throw new Error("matchEventNotEditable");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchEventSchema.parse({
    ...raw,
    shotOutcome: raw.shotOutcome || (event.shot && ["SAVED", "OFF_TARGET", "BLOCKED", "WOODWORK"].includes(event.shot.outcome) ? event.shot.outcome : "SAVED"),
    shotSituation: raw.shotSituation || event.shot?.situation || "OPEN_PLAY",
    bodyPart: raw.bodyPart || event.shot?.bodyPart || "UNKNOWN"
  });
  const clubSide = event.match.isHomeFixture ? "HOME" : "AWAY";
  const isOpponentEvent = parsed.side !== clubSide;
  let playerId: string | null = parsed.entityType === "PLAYER" && !isOpponentEvent ? parsed.playerId || null : null;
  let staffId: string | null = parsed.entityType === "STAFF" && !isOpponentEvent ? parsed.staffId || null : null;
  let playerName = parsed.playerName?.trim() || null;
  let playerNameFr = parsed.playerNameFr?.trim() || null;
  if (playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: { select: { category: true } } } });
    const isMatchPlayer = player.teamId === event.match.teamId || (event.match.team?.category === "SENIOR" && player.team?.category === "U20");
    const isSelectedForMatch = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId } }, select: { playerId: true } });
    if (!isMatchPlayer || (player.teamId !== event.match.teamId && !isSelectedForMatch) || parsed.side !== clubSide) throw new Error("matchEventPlayerSideMismatch");
    playerName = `${player.firstName} ${player.lastName}`;
    playerNameFr = [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ").trim() || null;
  }
  if (parsed.entityType === "PLAYER" && !isOpponentEvent && !playerId && ["YELLOW_CARD", "RED_CARD"].includes(parsed.type)) throw new Error("matchEventPlayerRequired");
  if (staffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
    if (staff.teamId !== event.match.teamId || parsed.side !== clubSide) throw new Error("matchEventStaffSideMismatch");
    playerName = null;
    playerNameFr = null;
  }
  if (parsed.entityType === "STAFF" && !isOpponentEvent && !staffId) throw new Error("staffMemberRequired");
  if (parsed.entityType === "STAFF" && isOpponentEvent && !playerName) throw new Error("opponentStaffNameRequired");
  if (parsed.entityType === "PLAYER" && !isOpponentEvent && !playerId) playerName = playerName || event.playerName;
  if (isOpponentEvent && !playerName) throw new Error("opponentEventNameRequired");
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
        playerNameFr,
        playerId,
        staffId
      }
    });
    if (event.shot) {
      if (["GOAL", "PENALTY_GOAL", "PENALTY_MISSED", "SHOT"].includes(parsed.type)) {
        const situation = parsed.type === "PENALTY_GOAL" || parsed.type === "PENALTY_MISSED" ? "PENALTY" : event.shot.situation;
        await tx.playerShot.update({
          where: { id: event.shot.id },
          data: {
            side: parsed.side,
            minute: parsed.minute,
            playerId,
            assistPlayerId: parsed.type === "GOAL" || parsed.type === "PENALTY_GOAL" ? event.shot.assistPlayerId : null,
            outcome: parsed.type === "PENALTY_MISSED" ? "PENALTY_MISSED" : parsed.type === "SHOT" ? (parsed.shotOutcome || "SAVED") : "GOAL",
            situation,
            xG: event.shot.x != null && event.shot.y != null
              ? estimateShotXg({ x: event.shot.x, y: event.shot.y, bodyPart: event.shot.bodyPart, situation })
              : null
          }
        });
      } else {
        await tx.playerShot.delete({ where: { id: event.shot.id } });
      }
    } else if (["GOAL", "PENALTY_GOAL", "PENALTY_MISSED", "SHOT"].includes(parsed.type)) {
      const situation = parsed.type === "PENALTY_GOAL" || parsed.type === "PENALTY_MISSED" ? "PENALTY" : parsed.shotSituation || "OPEN_PLAY";
      await tx.playerShot.create({
        data: {
          matchId,
          matchEventId: eventId,
          playerId,
          side: parsed.side,
          minute: parsed.minute,
          bodyPart: parsed.bodyPart || "UNKNOWN",
          situation,
          outcome: parsed.type === "PENALTY_MISSED" ? "PENALTY_MISSED" : parsed.type === "SHOT" ? (parsed.shotOutcome || "SAVED") : "GOAL",
          x: null,
          y: null,
          xG: null,
          xgModelVersion: "esh-xg-v1"
        }
      });
    }
    if (homeDelta || awayDelta) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          ...(homeDelta ? { homeScore: Math.max(0, (event.match.homeScore ?? 0) + homeDelta) } : {}),
          ...(awayDelta ? { awayScore: Math.max(0, (event.match.awayScore ?? 0) + awayDelta) } : {})
        }
      });
    }
    await writeAuditLog({
      userId: user.id,
      action: "match.event.update",
      entityType: "MatchEvent",
      entityId: eventId,
      changes: { before: { type: event.type, side: event.side, minute: event.minute, playerName: event.playerName, playerId: event.playerId, staffId: event.staffId }, after: { ...parsed, playerId, staffId, playerName, playerNameFr } }
    }, tx);
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
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
    await writeAuditLog({ userId: user.id, action: "match.event.delete", entityType: "MatchEvent", entityId: eventId, changes: { before: event } }, tx);
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
}

export async function addShootoutKickAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, include: { team: { select: { category: true } } } });
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
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: { select: { category: true } } } });
    const clubSide = match.isHomeFixture ? "HOME" : "AWAY";
    const isMatchPlayer = player.teamId === match.teamId || (match.team?.category === "SENIOR" && player.team?.category === "U20");
    const selectedForMatch = player.teamId === match.teamId || await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId } }, select: { playerId: true } });
    if (!isMatchPlayer || !selectedForMatch || parsed.side !== clubSide || player.status !== "ACTIVE") {
      throw new Error("shootoutPlayerMismatch");
    }
    playerName = `${player.firstName} ${player.lastName}`;
  } else if (parsed.side === (match.isHomeFixture ? "HOME" : "AWAY")) {
    throw new Error("shootoutPlayerRequired");
  }

  await db.$transaction(async (tx) => {
    const existingSideKicks = await tx.matchShootoutKick.count({ where: { matchId, side: parsed.side } });
    const kick = await tx.matchShootoutKick.create({
      data: {
        matchId,
        playerId,
        playerName,
        side: parsed.side,
        attemptNumber: existingSideKicks + 1,
        result: parsed.result
      }
    });
    const allKicks = await tx.matchShootoutKick.findMany({ where: { matchId }, select: { side: true, attemptNumber: true, result: true } });
    await writeAuditLog({
      userId: user.id,
      action: "match.shootout_kick.create",
      entityType: "MatchShootoutKick",
      entityId: kick.id,
      changes: { after: { ...parsed, playerId, playerName, attemptNumber: kick.attemptNumber }, shootoutDecided: isShootoutDecided(allKicks) }
    }, tx);
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
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
    const remainingKicks = await tx.matchShootoutKick.findMany({
      where: { matchId },
      select: { side: true, attemptNumber: true, result: true }
    });
    const finished = isShootoutDecided(remainingKicks);
    if (match.status === "LIVE" || match.status === "FINISHED") {
      await tx.match.update({ where: { id: matchId }, data: { status: finished ? "FINISHED" : "LIVE" } });
    }
    await writeAuditLog({
      userId: user.id,
      action: "match.shootout_kick.delete",
      entityType: "MatchShootoutKick",
      entityId: kickId,
      changes: { before: kick, matchFinished: finished }
    }, tx);
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
}

export async function upsertLineupEntryAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, include: { team: { select: { category: true } } } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (match.status !== "LIVE" && match.status !== "SCHEDULED") throw new Error("lineupNotAvailable");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchLineupEntrySchema.parse(raw);

  const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId }, include: { team: { select: { category: true } } } });
  const sameTeam = player.teamId === match.teamId;
  const eligibleU20ForSenior = match.team?.category === "SENIOR" && player.team?.category === "U20";
  if (!sameTeam && !eligibleU20ForSenior) throw new Error("invalidLineupPlayer");

  if (player.status === "INJURED" && parsed.selectionStatus !== "INJURED") throw new Error("lineupPlayerInjured");

  if (parsed.selectionStatus === "STARTING") {
    const currentStarters = await db.matchLineup.count({
      where: { matchId, selectionStatus: "STARTING", playerId: { not: parsed.playerId } }
    });
    if (currentStarters >= 11) throw new Error("lineupStartingLimit");
  }

  const automaticallySuspended = await wasRedCardedInPreviousMatch(match, parsed.playerId);
  if (automaticallySuspended && parsed.selectionStatus !== "SUSPENDED") throw new Error("lineupPlayerSuspended");

  const isStarting = parsed.selectionStatus === "STARTING";
  await db.$transaction(async (tx) => {
    await tx.matchLineup.upsert({
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
    }, tx);
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

  const matchTeam = await db.team.findUnique({ where: { id: match.teamId }, select: { category: true } });
  const eligiblePlayers = await db.player.findMany({
    where: {
      id: { in: playerIds },
      status: { not: "ARCHIVED" },
      OR: [
        { teamId: match.teamId },
        ...(matchTeam?.category === "SENIOR"
          ? [{ team: { category: "U20" as const } }]
          : [])
      ]
    },
    select: { id: true, position: true }
  });
  if (eligiblePlayers.length > 0) {
    await db.$transaction(async (tx) => {
      for (const player of eligiblePlayers) {
        await tx.matchLineup.upsert({
          where: { matchId_playerId: { matchId, playerId: player.id } },
          update: { isStarting: false, selectionStatus: "SUSPENDED" },
          create: { matchId, playerId: player.id, isStarting: false, selectionStatus: "SUSPENDED", position: player.position }
        });
      }
      await writeAuditLog({
        userId: user.id,
        action: "match.lineup.auto_suspend",
        entityType: "Match",
        entityId: matchId,
        changes: { playerIds: eligiblePlayers.map((player) => player.id), source: "previous_match_red_cards" }
      }, tx);
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
  if (await wasRedCardedInPreviousMatch(match, playerId)) throw new Error("lineupPlayerSuspended");

  await db.$transaction(async (tx) => {
    await tx.matchLineup.delete({ where: { matchId_playerId: { matchId, playerId } } });
    await writeAuditLog({
      userId: user.id,
      action: "match.lineup.remove",
      entityType: "MatchLineup",
      entityId: `${matchId}:${playerId}`
    }, tx);
  });
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
}

/** Re-apply the already saved FAF starting sheet without fetching all match documents again. */
export async function importSavedFafLineupAction(matchId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { id: true, teamId: true, status: true } });
  if (!match.teamId) throw new Error("matchTeamMissing");
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (match.status !== "SCHEDULED" && match.status !== "LIVE") throw new Error("lineupNotAvailable");

  const document = await db.document.findFirst({
    where: { relatedMatchId: matchId, teamId: match.teamId, matchDocumentType: "PRE_MATCH_SHEET" },
    orderBy: { createdAt: "desc" },
    select: { storageKey: true, mimeType: true }
  });
  if (!document) throw new Error("lineupSheetMissing");

  const [{ getPrivateFileBuffer }, { extractDocumentText }] = await Promise.all([
    import("@/lib/storage"),
    import("@/lib/ai/document-verifier")
  ]);
  const bytes = await getPrivateFileBuffer(document.storageKey);
  const text = await extractDocumentText(bytes, document.mimeType);
  if (!text?.trim()) throw new Error("lineupSheetUnreadable");

  const result = await applyMatchSheetLineup(matchId, match.teamId, text);
  if (result.applied) {
    await writeAuditLog({
      userId: user.id,
      action: "match.lineup.import_faf_sheet",
      entityType: "Match",
      entityId: matchId,
      changes: { starters: result.starters, substitutes: result.substitutes, source: "saved_faf_pre_match_sheet" }
    });
    revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
    revalidatePath(`/[locale]/matches/${matchId}`, "page");
  }
  return result;
}

export async function attachMatchSheetAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
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
    if (match.status !== "LIVE" && match.status !== "SCHEDULED") {
      throw new Error("preMatchSheetUploadUnavailable");
    }
  }

  const { validateUploadedFile, uploadPrivateFile, deletePrivateFile, generateStorageKey } = await import("@/lib/storage");
  if (file.size > 25 * 1024 * 1024) throw new Error("حجم الملف يتجاوز الحد المسموح (25 MB).");
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
  let doc;
  try {
    doc = await db.$transaction(async (tx) => {
      const created = await tx.document.create({
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
      await writeAuditLog({
        userId: user.id,
        action: "match.sheet_attached",
        entityType: "Match",
        entityId: match.id,
        changes: { documentId: created.id, filename: file.name, sheetType, reviewStatus: created.status }
      }, tx);
      return created;
    });
  } catch (error) {
    try {
      await deletePrivateFile(storageKey);
    } catch (cleanupError) {
      console.error("Could not clean up an unlinked match sheet upload:", cleanupError instanceof Error ? cleanupError.message : "unknown error");
    }
    throw error;
  }

  let lineupsAdded = 0;
  let lineupSummary: Awaited<ReturnType<typeof applyMatchSheetLineup>> | undefined;
  let aiFallback: "quota" | "unavailable" | undefined;
  let refereeAnalysisWarning: string | undefined;
  const shouldExtractLineup = sheetType === "PRE_MATCH_SHEET" && formData.getAll("autoLineup").includes("true");
  if (shouldExtractLineup && match.teamId) {
    try {
      const { extractDocumentText } = await import("@/lib/ai/document-verifier");
      const extractedText = await extractDocumentText(buffer, validated.mime, (reason) => { aiFallback = reason; });
      if (extractedText) {
        lineupSummary = await applyMatchSheetLineup(match.id, match.teamId, extractedText);
        lineupsAdded = lineupSummary.applied ? lineupSummary.starters + lineupSummary.substitutes + lineupSummary.notCalled + lineupSummary.injured + lineupSummary.suspended : 0;
      }
    } catch (error) {
      // Uploading the official sheet must still succeed when OCR/text
      // extraction is unavailable; the user can add the lineup manually.
      console.warn("[MatchSheet] Automatic lineup extraction skipped", error);
    }
  }

  // A referee report should be analyzed as soon as it is uploaded. The
  // document stays saved if OCR/AI is unavailable; no synthetic text from the
  // filename is passed to the analyzer.
  if (sheetType === "REFEREE_REPORT") {
    try {
      await enqueueRefereeReportAnalysis(db, { matchId: match.id, documentId: doc.id, userId: user.id });
      refereeAnalysisWarning = locale === "ar"
        ? "حُفظ التقرير وبدأ تحليله في الخلفية؛ ستظهر الأحداث عند تحديث الصفحة."
        : "Rapport enregistré ; l’analyse continue en arrière-plan. Actualisez la page pour voir les événements.";
    } catch (error) {
      console.error("[MatchSheet] Could not queue referee report analysis", error);
      refereeAnalysisWarning = locale === "ar"
        ? "حُفظ التقرير، لكن تعذر وضع التحليل في قائمة المهام. يمكنك تشغيل التحليل من صفحة المباراة."
        : "Rapport enregistré, mais l’analyse n’a pas pu être mise en file. Vous pouvez la relancer depuis la page du match.";
    }
  }

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  const aiFallbackWarning = aiFallback
    ? locale === "ar"
      ? aiFallback === "quota" ? "انتهت حصة الذكاء الاصطناعي؛ استُخدم التحليل الاحتياطي عند الإمكان." : "الذكاء الاصطناعي غير متاح؛ استُخدم التحليل الاحتياطي عند الإمكان."
      : aiFallback === "quota" ? "Quota IA épuisé ; le moteur de secours a été utilisé si possible." : "IA indisponible ; le moteur de secours a été utilisé si possible."
    : undefined;
  const warning = [refereeAnalysisWarning, aiFallbackWarning].filter(Boolean).join(" ");
  return {
    success: true,
    documentId: doc.id,
    lineupsAdded,
    ...(warning ? { warning } : {})
  };
}

export async function syncFAFMatchDocumentsAction(matchId: string, locale = "ar") {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const baseKey = `faf-match-sync-manual-${matchId}`;
  const previousJob = await db.backgroundJob.findUnique({ where: { idempotencyKey: baseKey }, select: { id: true, status: true } });
  const hasActiveJob = previousJob && ["QUEUED", "RUNNING", "RETRYING"].includes(previousJob.status);
  const job = hasActiveJob ? previousJob : await enqueueJob(db, {
    type: "faf.match_sync",
    payload: { matchId, userId: user.id },
    idempotencyKey: previousJob ? `${baseKey}-retry-${Date.now()}` : baseKey,
    createdById: user.id,
    priority: "HIGH",
    maxAttempts: 2
  });
  processQueuedJobAfterResponse("faf.match_sync");
  return {
    success: true,
    matchId,
    jobId: job.id,
    message: locale === "fr"
      ? "L’import FAF EMS est en file d’attente. Les documents et événements seront traités en arrière-plan."
      : "تمت إضافة استيراد FAF EMS إلى قائمة المهام. سيُحفظ التقرير وتُحلل أحداثه في الخلفية."
  };
}

export async function analyzeRefereeReportWithAIAction(matchId: string, formData?: FormData, locale = "ar") {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const reportText = String(formData?.get("reportText") ?? "").trim();
  if (reportText.length > 5000) {
    throw new Error(locale === "fr" ? "Le rapport ne peut pas dépasser 5 000 caractères." : "نص التقرير يتجاوز الحد المسموح (5000 حرف). قلّص النص ثم أعد المحاولة.");
  }

  const reportDocument = reportText ? null : await db.document.findFirst({
    where: { relatedMatchId: matchId, matchDocumentType: "REFEREE_REPORT" },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (!reportText && !reportDocument) {
    throw new Error(locale === "fr" ? "Joignez d’abord le rapport final de l’arbitre ou collez son texte." : "أرفق التقرير النهائي للحكم أو الصق نصه قبل بدء التحليل.");
  }

  const job = await enqueueRefereeReportAnalysis(db, {
    matchId,
    ...(reportText ? { reportText } : { documentId: reportDocument!.id }),
    userId: user.id
  }, { allowRerun: true });
  processQueuedJobAfterResponse("match.referee_report_analysis");
  return {
    success: true,
    jobId: job.id,
    message: locale === "fr"
      ? "L’analyse a été mise en file d’attente. Vous verrez son état ici sans garder la page bloquée."
      : "أُضيف التحليل إلى قائمة التنفيذ. ستظهر حالته هنا دون تجميد الصفحة."
  };
}

export async function getMatchBackgroundJobStatusAction(jobId: string, matchId: string, locale = "ar") {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { id: true, teamId: true } });
  assertTeamScope(scopeContext, match.teamId, "Match");

  const job = await db.backgroundJob.findUnique({
    where: { id: jobId },
    select: { id: true, type: true, status: true, payload: true, createdById: true, createdAt: true, startedAt: true, lastError: true }
  });
  if (!job || !["faf.match_sync", "match.referee_report_analysis"].includes(job.type)) {
    throw new Error(locale === "fr" ? "Tâche introuvable." : "لم يتم العثور على المهمة.");
  }
  const payload = job.payload as { matchId?: unknown };
  if (payload.matchId !== match.id) {
    throw new Error(locale === "fr" ? "Vous n’avez pas accès à cette tâche." : "لا تملك صلاحية متابعة هذه المهمة.");
  }

  const labels = locale === "fr"
    ? { QUEUED: "En attente de traitement…", RUNNING: "Traitement en cours…", RETRYING: "Nouvelle tentative en cours…", SUCCEEDED: "Terminé avec succès.", FAILED: "Échec du traitement.", CANCELLED: "Tâche annulée." }
    : { QUEUED: "بانتظار بدء التنفيذ…", RUNNING: "يجري تنفيذ الطلب…", RETRYING: "تعاد المحاولة تلقائيًا…", SUCCEEDED: "اكتملت العملية بنجاح.", FAILED: "تعذر إكمال العملية.", CANCELLED: "أُلغيت المهمة." };
  const status = job.status as keyof typeof labels;
  const result: {
    jobId: string;
    type: string;
    status: string;
    message: string;
    error?: string;
    warning?: string;
    followUpJobId?: string;
    analysis?: { eventsCreated: number; events: Array<{ playerName: string; type: string; minute: number }>; aiProviderUsed: "CLOUDFLARE_WORKERS_AI" | "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE"; aiFallback?: "quota" | "unavailable" | null; summary: string };
  } = {
    jobId: job.id,
    type: job.type,
    status: job.status,
    message: labels[status] ?? labels.FAILED
  };

  if (job.status === "FAILED") {
    result.error = (job.lastError || labels.FAILED).replace(/[\r\n]+/g, " ").slice(0, 240);
  }

  if (job.type === "faf.match_sync" && job.status === "SUCCEEDED") {
    const syncLog = await db.auditLog.findFirst({
      where: {
        action: "FAF_MATCH_SYNC_COMPLETED",
        entityType: "Match",
        entityId: match.id,
        userId: job.createdById ?? user.id,
        createdAt: { gte: job.startedAt ?? job.createdAt }
      },
      orderBy: { createdAt: "desc" },
      select: { changes: true }
    });
    const syncChanges = syncLog?.changes as { warnings?: string[] } | null;
    if (syncChanges?.warnings?.length) result.warning = syncChanges.warnings.join(" ").slice(0, 400);

    const analysisJobs = await db.backgroundJob.findMany({
      where: {
        type: "match.referee_report_analysis",
        createdById: job.createdById ?? user.id,
        createdAt: { gte: job.createdAt }
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, payload: true }
    });
    const analysisJob = analysisJobs.find((candidate) => (candidate.payload as { matchId?: unknown }).matchId === match.id);
    if (analysisJob) result.followUpJobId = analysisJob.id;
  }

  if (job.type === "match.referee_report_analysis" && job.status === "SUCCEEDED") {
    const audit = await db.auditLog.findFirst({
      where: {
        action: "match.referee_report_ai_analyzed",
        entityType: "Match",
        entityId: match.id,
        userId: job.createdById ?? user.id,
        createdAt: { gte: job.startedAt ?? job.createdAt }
      },
      orderBy: { createdAt: "desc" },
      select: { changes: true }
    });
    const changes = audit?.changes as {
      eventsCreatedCount?: number;
      aiProviderUsed?: "CLOUDFLARE_WORKERS_AI" | "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE";
      aiFallback?: "quota" | "unavailable" | null;
      events?: Array<{ playerName?: string | null; type?: string; minute?: number }>;
    } | null;
    result.analysis = {
      eventsCreated: changes?.eventsCreatedCount ?? 0,
      events: (changes?.events ?? []).map((event) => ({ playerName: event.playerName || "لاعب", type: event.type || "GOAL", minute: event.minute ?? 0 })),
      aiProviderUsed: changes?.aiProviderUsed ?? "INTELLIGENT_NLP_ENGINE",
      aiFallback: changes?.aiFallback ?? null,
      summary: (changes?.eventsCreatedCount ?? 0) > 0
        ? locale === "fr"
          ? `${changes?.eventsCreatedCount} événement(s) ont été ajoutés au match et aux dossiers des joueurs.`
          : `تمت إضافة ${changes?.eventsCreatedCount} حدث إلى المباراة وملفات اللاعبين.`
        : locale === "fr"
          ? "L’analyse est terminée. Aucun nouvel événement attribuable n’a été ajouté."
          : "اكتمل التحليل ولم يُضف حدث جديد منسوب للاعب؛ راجع الأحداث المسجلة لتجنب التكرار."
    };
  }

  return result;
}
