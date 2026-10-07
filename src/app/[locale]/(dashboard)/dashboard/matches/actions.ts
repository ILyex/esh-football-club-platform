"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { matchSchema, matchEventSchema, matchLineupEntrySchema } from "@/lib/validations/match";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

// Resolves the club's own name from ClubSettings (spec section 60 — the
// club's identity must come from Settings, never be hardcoded in code) so
// the two free-text team names on Match can be derived from a single
// "opponent" input + an isHomeFixture toggle in the form.
async function getClubName(): Promise<string> {
  const settings = await db.clubSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.name && /[\u0600-\u06FF]/.test(settings.name)) {
    return settings.name;
  }
  return "أمل سيدي حسني";
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
  const homeTeamName = parsed.isHomeFixture ? clubName : parsed.opponent;
  const awayTeamName = parsed.isHomeFixture ? parsed.opponent : clubName;

  const match = await db.match.create({
    data: {
      competitionId: parsed.competitionId,
      teamId: parsed.teamId,
      homeTeamName,
      awayTeamName,
      isHomeFixture: parsed.isHomeFixture,
      matchDate: parsed.matchDate,
      stadium: parsed.stadium,
      refereeName: parsed.refereeName,
      status: parsed.status,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      matchReport: parsed.matchReport
    }
  });

  await syncCalendarEvent(match.id, `${homeTeamName} vs ${awayTeamName}`, parsed.matchDate, parsed.teamId, parsed.stadium || null);

  await writeAuditLog({ userId: user.id, action: "match.create", entityType: "Match", entityId: match.id, changes: { after: parsed, opponentLogoUrl } });
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  revalidatePath("/[locale]/dashboard/website", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page"); // homepage next match / latest result
  return { id: match.id };
}

export async function updateMatchAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.match.findUniqueOrThrow({ where: { id: matchId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchSchema.parse(raw);
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
  const homeTeamName = parsed.isHomeFixture ? clubName : parsed.opponent;
  const awayTeamName = parsed.isHomeFixture ? parsed.opponent : clubName;

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
      refereeName: parsed.refereeName,
      status: parsed.status,
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
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  return { id: match.id };
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
  if (match.status !== "LIVE") throw new Error("matchMustBeLive");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchEventSchema.parse(raw);
  const playerId = parsed.entityType === "PLAYER" ? parsed.playerId || null : null;
  const staffId = parsed.entityType === "STAFF" ? parsed.staffId || null : null;

  if (playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (staffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }

  const event = await db.$transaction(async (tx) => {
    const created = await tx.matchEvent.create({
      data: { matchId, playerId, staffId, type: parsed.type, side: parsed.side, source: "MANUAL", minute: parsed.minute, notes: parsed.notes }
    });
    if (parsed.type === "GOAL" || parsed.type === "OWN_GOAL") {
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
    if (event.type === "GOAL" || event.type === "OWN_GOAL") {
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
}

export async function upsertLineupEntryAction(matchId: string, formData: FormData) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");
  if (match.status !== "LIVE") throw new Error("matchMustBeLive");

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchLineupEntrySchema.parse(raw);

  const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId } });
  assertTeamScope(scopeContext, player.teamId, "Player");

  await db.matchLineup.upsert({
    where: { matchId_playerId: { matchId, playerId: parsed.playerId } },
    update: { isStarting: parsed.isStarting, position: parsed.position },
    create: { matchId, playerId: parsed.playerId, isStarting: parsed.isStarting, position: parsed.position }
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

export async function removeLineupEntryAction(matchId: string, playerId: string) {
  const user = await requirePermission("matches.report");
  const scopeContext = await getMutationScopeContext();
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  assertTeamScope(scopeContext, match.teamId, "Match");

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

  await writeAuditLog({
    userId: user.id,
    action: "match.sheet_attached",
    entityType: "Match",
    entityId: match.id,
    changes: { documentId: doc.id, filename: file.name, sheetType, reviewStatus: doc.status }
  });

  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  return { success: true, documentId: doc.id };
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


