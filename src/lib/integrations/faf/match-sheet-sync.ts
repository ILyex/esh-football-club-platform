import "server-only";

import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getFAFConfig } from "./config";
import { getFafEmsClient } from "./ems-client";
import { enqueueRefereeReportAnalysis } from "@/lib/ai/referee-report-job";
import { RetryableError } from "@/lib/jobs/types";
import { applyMatchSheetLineup } from "@/lib/matches/lineup-from-sheet";
import { extractDocumentText } from "@/lib/ai/document-verifier";

export interface FafMatchSyncResult {
  success: boolean;
  matchId: string;
  message: string;
  refereeName?: string;
  matchSheetDocId?: string;
  refereeReportDocId?: string;
  warnings?: string[];
}

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function dateKey(value: unknown): string {
  const text = String(value ?? "");
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function opponentName(club: any): string {
  return String(club?.nomAr || club?.denomination || club?.nomClub || club?.surnomAr || club?.surnom || "");
}

function namesMatch(local: string, remote: string): boolean {
  const a = normalize(local), b = normalize(remote);
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

function eventSummary(match: any): string[] {
  const lines: string[] = [];
  for (const card of match.cards || []) {
    if (card.staff || card.staffMember || card.coach || card.encadreur) continue;
    const p = card.player?.player?.personne;
    const name = [p?.prenomAr, p?.nomAr, p?.firstName, p?.lastName].filter(Boolean).join(" ") || "لاعب";
    lines.push(`${card.cardColor || "بطاقة"} — ${name} (${card.cardTime || "؟"})`);
  }
  for (const goal of match.goals || []) {
    const p = goal.player?.player?.personne || goal.player?.personne;
    const name = [p?.prenomAr, p?.nomAr, p?.firstName, p?.lastName].filter(Boolean).join(" ") || "لاعب";
    lines.push(`هدف — ${name} (${goal.goalTime || goal.minute || "؟"})`);
  }
  for (const sub of match.substitution || []) {
    const playerName = (entry: any) => {
      const p = entry?.player?.personne;
      return [p?.prenomAr, p?.nomAr, p?.firstName, p?.lastName].filter(Boolean).join(" ") || "لاعب";
    };
    lines.push(`تبديل — ${playerName(sub.outPlayer)} ← ${playerName(sub.inPlayer)} (${sub.substitutionTime || "؟"})`);
  }
  return lines;
}

type ImportedMatchEvent = {
  fafExternalKey: string;
  type: "GOAL" | "PENALTY_GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION_IN" | "SUBSTITUTION_OUT";
  side: "HOME" | "AWAY" | null;
  minute: number;
  playerId: string | null;
  playerName: string;
  playerLicence: string;
  remoteLocSide: boolean | null;
  notes: string | null;
};

function playerFromRemoteEvent(entry: any): { name: string; licence: string } {
  const person = entry?.player?.player?.personne || entry?.player?.personne
    || entry?.personne || entry?.person || entry?.player?.person;
  const name = [person?.prenomAr, person?.nomAr, person?.firstName, person?.lastName]
    .filter(Boolean).join(" ").trim();
  const licence = entry?.licenceNumber || entry?.numeroLicence || entry?.numLicence
    || entry?.player?.licenceNumber || entry?.player?.numeroLicence
    || entry?.player?.player?.licenceNumber || entry?.player?.player?.numeroLicence
    || person?.licenceNumber || person?.numeroLicence || "";
  return { name: name || "لاعب", licence: String(licence).trim() };
}

function eventMinute(value: unknown): number {
  const match = String(value ?? "").match(/\d{1,3}/);
  return match ? Math.min(130, Number(match[0])) : 0;
}

function remoteLocSideOf(entry: any, match: any): boolean | null {
  const clubCode = entry?.club?.fifaId || entry?.team?.fifaId || entry?.player?.club?.fifaId
    || entry?.player?.team?.fifaId || entry?.player?.player?.club?.fifaId
    || entry?.player?.player?.team?.fifaId;
  if (clubCode && match.clubLoc?.fifaId) return String(clubCode).toUpperCase() === String(match.clubLoc.fifaId).toUpperCase();
  const side = String(entry?.teamSide || entry?.side || entry?.teamType || "").toLowerCase();
  if (/loc|home|domicile|محلي|مضيف/.test(side)) return true;
  if (/vis|away|extérieur|ضيف/.test(side)) return false;
  if (typeof entry?.isHome === "boolean") return entry.isHome;
  if (typeof entry?.isLocal === "boolean") return entry.isLocal;
  return null;
}

function remoteMatchEvents(match: any, externalId: number, remoteLocIsOurClub: boolean, localClubIsHome: boolean): ImportedMatchEvent[] {
  const output: ImportedMatchEvent[] = [];
  const keys = new Map<string, number>();
  const sideFor = (isRemoteLocEvent: boolean): "HOME" | "AWAY" =>
    isRemoteLocEvent === (remoteLocIsOurClub === localClubIsHome) ? "HOME" : "AWAY";
  const add = (raw: any, type: ImportedMatchEvent["type"], remoteLocSide: boolean | null, label: string, nameOverride?: string) => {
    // Match staff cards are intentionally excluded from player match events.
    if (raw?.staff || raw?.staffMember || raw?.coach || raw?.encadreur) return;
    const player = playerFromRemoteEvent(raw);
    const playerName = nameOverride || player.name;
    const minute = eventMinute(raw?.minute ?? raw?.goalTime ?? raw?.cardTime ?? raw?.substitutionTime ?? raw?.time);
    const side = remoteLocSide == null ? null : sideFor(remoteLocSide);
    const identity = `${type}|${side || "unknown"}|${minute}|${player.licence || normalize(playerName)}`;
    const occurrence = keys.get(identity) ?? 0;
    keys.set(identity, occurrence + 1);
    output.push({
      fafExternalKey: `faf:${externalId}:${identity}:${occurrence}`,
      type, side, minute, playerId: null, playerName, playerLicence: player.licence, remoteLocSide,
      // Card reasons are intentionally omitted from the public match timeline.
      notes: label
    });
  };

  for (const card of match.cards || []) {
    const color = String(card.cardColor || card.color || "").toLocaleLowerCase("ar");
    const type = /red|rouge|حمراء|حمرا/.test(color) ? "RED_CARD" : "YELLOW_CARD";
    const isLoc = remoteLocSideOf(card, match);
    add(card, type, isLoc, type === "RED_CARD" ? "بطاقة حمراء" : "بطاقة صفراء");
  }
  for (const goal of match.goals || []) {
    const isLoc = remoteLocSideOf(goal, match);
    const ownGoal = Boolean(goal.isOwnGoal || goal.ownGoal || /own|contre son camp|ذاتي/.test(String(goal.type || goal.goalType || "").toLowerCase()));
    const penalty = Boolean(goal.isPenalty || goal.penalty || /penalty|penalty_goal|جزاء/.test(String(goal.type || goal.goalType || "").toLowerCase()));
    add(goal, ownGoal ? "OWN_GOAL" : penalty ? "PENALTY_GOAL" : "GOAL", isLoc, ownGoal ? "هدف عكسي" : penalty ? "هدف من ركلة جزاء" : "هدف");
  }
  for (const substitution of match.substitution || match.substitutions || []) {
    const isLoc = remoteLocSideOf(substitution, match);
    const outPlayer = substitution.outPlayer || substitution.playerOut || substitution.playerSortant;
    const inPlayer = substitution.inPlayer || substitution.playerIn || substitution.playerEntrant;
    if (outPlayer) add(outPlayer, "SUBSTITUTION_OUT", isLoc, "خروج بالتبديل");
    if (inPlayer) add(inPlayer, "SUBSTITUTION_IN", isLoc, "دخول بالتبديل");
  }
  return output;
}

async function reconcilePlayerEvents(matchId: string, teamId: string | null, official: any, externalId: number, localClubIsHome: boolean, clubCode: string): Promise<number> {
  const remoteLocIsOurClub = String(official.clubLoc?.fifaId || "").toUpperCase() === clubCode.toUpperCase();
  const imported = remoteMatchEvents(official, externalId, remoteLocIsOurClub, localClubIsHome);
  if (!imported.length) return 0;

  let eligibleTeamIds = teamId ? [teamId] : [];
  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { category: true } });
    if (team?.category === "SENIOR") {
      const u20 = await db.team.findUnique({ where: { category: "U20" }, select: { id: true } });
      if (u20?.id) eligibleTeamIds.push(u20.id);
    }
  }
  const players = eligibleTeamIds.length ? await db.player.findMany({
    where: { teamId: { in: eligibleTeamIds }, status: { not: "ARCHIVED" } },
    select: { id: true, firstName: true, lastName: true, licenceNumber: true }
  }) : [];
  const byLicence = new Map<string, typeof players>();
  for (const player of players) {
    if (!player.licenceNumber) continue;
    const key = normalize(player.licenceNumber);
    byLicence.set(key, [...(byLicence.get(key) ?? []), player]);
  }
  for (const event of imported) {
    const names = players.filter((player) => normalize(`${player.firstName} ${player.lastName}`) === normalize(event.playerName));
    const licenceCandidates = event.playerLicence ? byLicence.get(normalize(event.playerLicence)) ?? [] : [];
    const player = event.playerLicence
      ? (licenceCandidates.length === 1 ? licenceCandidates[0] : undefined)
      : (names.length === 1 ? names[0] : undefined);
    const localSide = localClubIsHome ? "HOME" : "AWAY";
    if (event.side == null) {
      if (player) event.side = localSide;
      else if (licenceCandidates.length > 1 || names.length > 1) continue;
      else event.side = localSide === "HOME" ? "AWAY" : "HOME";
    }
    event.playerId = event.side === localSide ? player?.id ?? null : null;
  }

  const existing = await db.matchEvent.findMany({
    where: { matchId },
    select: { type: true, side: true, minute: true, playerId: true, playerName: true }
  });
  const fresh = imported.filter((event) => event.side !== null && !existing.some((row) => row.type === event.type && row.side === event.side && row.minute === event.minute
    && ((event.playerId && row.playerId === event.playerId) || normalize(row.playerName || "") === normalize(event.playerName))));
  if (!fresh.length) return 0;
  const localSide = localClubIsHome ? "HOME" : "AWAY";
  const created = await db.matchEvent.createMany({
    data: fresh.map((event) => ({
      matchId,
      fafExternalKey: event.fafExternalKey,
      type: event.type,
      side: event.side ?? localSide,
      minute: event.minute,
      playerId: event.playerId,
      playerName: event.playerName,
      notes: event.notes,
      source: "REFEREE_REPORT" as const
    })),
    skipDuplicates: true
  });
  return created.count;
}

async function resolveLocalMatch(matchId: string, clubCode: string) {
  const local = await db.match.findUnique({ where: { id: matchId }, include: { team: true } });
  if (!local) throw new Error("Match not found");
  const remoteMatches = await getFafEmsClient().history();
  const localDate = dateKey(local.matchDate);
  const candidates = remoteMatches.filter((remote) => {
    if (dateKey(remote.dateRencontre) !== localDate) return false;
    const localClub = local.isHomeFixture ? remote.clubLoc : remote.clubVis;
    const otherClub = local.isHomeFixture ? remote.clubVis : remote.clubLoc;
    if (String(localClub?.fifaId || "").toUpperCase() !== clubCode.toUpperCase()) return false;
    const localOpponent = local.isHomeFixture ? local.awayTeamName : local.homeTeamName;
    return namesMatch(localOpponent, opponentName(otherClub));
  });
  if (candidates.length !== 1) {
    throw new Error(candidates.length
      ? "وجدت أكثر من مباراة محتملة في EMS في نفس التاريخ؛ لم أستورد أي بيانات لتجنب ربط مباراة خاطئة."
      : "لم أجد مباراة مطابقة في Historique. تأكد من تاريخ المباراة واسم المنافس في المنصة.");
  }
  return { local, remote: candidates[0] };
}

export async function syncFafMatchDocuments(matchId: string, userId?: string): Promise<FafMatchSyncResult> {
  const config = getFAFConfig();
  // Do not gate on environment credentials here: FafEmsClient first checks the
  // encrypted, persisted FAF session (PostgreSQL on Vercel). Requiring env vars
  // before that lookup made valid stored sessions unusable in production.
  if (!config.enabled) throw new Error("FAF EMS integration is disabled on the server.");
  const { local, remote } = await resolveLocalMatch(matchId, config.clubCode);
  if (!remote) throw new Error("No matching FAF EMS record was found.");
  const actorId = userId || (await db.user.findFirst({ where: { role: { key: "ADMIN" } }, select: { id: true } }))?.id;
  if (!actorId) throw new Error("A platform user is required to attach imported FAF documents.");
  const externalId = Number(remote.id);
  const api = getFafEmsClient();
  const [detailsResult, firstReportResult, finalReportResult] = await Promise.allSettled([
    api.matchInfo(externalId),
    api.report(externalId, "first-report-ar"),
    api.report(externalId, "final-report-ar")
  ]);
  if (detailsResult.status === "rejected") throw detailsResult.reason;
  const official = detailsResult.value.match;
  const reportResults = [firstReportResult, finalReportResult];
  const temporaryReportFailure = reportResults.find((result) => result.status === "rejected" && result.reason instanceof RetryableError);
  if (temporaryReportFailure?.status === "rejected") {
    throw new RetryableError("FAF EMS temporarily failed to return a report document; the complete import will retry safely.", temporaryReportFailure.reason);
  }

  const { validateUploadedFile, uploadPrivateFile, generateStorageKey, getPrivateFileBuffer, deletePrivateFile } = await import("@/lib/storage");
  const documentSpecs = [
    { kind: "PRE_MATCH_SHEET" as const, label: "first-report-ar", title: "وثيقة بداية المباراة", bytes: firstReportResult.status === "fulfilled" ? firstReportResult.value : null },
    { kind: "REFEREE_REPORT" as const, label: "final-report-ar", title: "تقرير المباراة النهائي", bytes: finalReportResult.status === "fulfilled" ? finalReportResult.value : null }
  ];
  const warnings: string[] = [];
  if (firstReportResult.status === "rejected") warnings.push(`تعذر جلب وثيقة بداية المباراة: ${firstReportResult.reason instanceof Error ? firstReportResult.reason.message : "خطأ غير معروف"}`);
  if (finalReportResult.status === "rejected") warnings.push(`تعذر جلب التقرير النهائي: ${finalReportResult.reason instanceof Error ? finalReportResult.reason.message : "خطأ غير معروف"}`);
  const hasDocumentsToImport = documentSpecs.some((item) => item.bytes);
  const category = hasDocumentsToImport
    ? await db.documentCategory.upsert({
        where: { key: "report" },
        update: {},
        create: { key: "report", name: "Reports" }
      })
    : null;
  const documentIdsByKind = new Map<string, string>();
  let importedDocuments = 0;
  let refreshedDocuments = 0;
  for (const item of documentSpecs) {
    const originalName = `FAF-EMS-${externalId}-${item.label}.pdf`;
    const existing = await db.document.findFirst({ where: { relatedMatchId: local.id, originalName }, select: { id: true, storageKey: true } });
    if (existing && item.bytes) {
      let unchanged = false;
      try { unchanged = (await getPrivateFileBuffer(existing.storageKey)).equals(item.bytes); }
      catch { /* A missing/legacy local object is repaired from the authoritative FAF copy below. */ }
      if (!unchanged) {
        const validation = await validateUploadedFile(item.bytes);
        const storageKey = generateStorageKey("faf-ems", validation.ext);
        await uploadPrivateFile({ key: storageKey, buffer: item.bytes, mimeType: validation.mime });
        await db.document.update({
          where: { id: existing.id },
          data: { storageKey, mimeType: validation.mime, sizeBytes: item.bytes.byteLength }
        });
        await deletePrivateFile(existing.storageKey).catch(() => undefined);
        refreshedDocuments++;
      }
      documentIdsByKind.set(item.kind, existing.id);
      continue;
    }
    if (existing) { documentIdsByKind.set(item.kind, existing.id); continue; }
    if (!item.bytes || !category) continue;
    const validation = await validateUploadedFile(item.bytes);
    const storageKey = generateStorageKey("faf-ems", validation.ext);
    await uploadPrivateFile({ key: storageKey, buffer: item.bytes, mimeType: validation.mime });
    const created = await db.document.create({
      data: {
        name: `${item.title} — ${local.homeTeamName} ضد ${local.awayTeamName}`,
        categoryId: category.id,
        description: `مستوردة مباشرة من FAF EMS للمباراة ${externalId}.`,
        documentDate: local.matchDate,
        classification: "INTERNAL",
        status: "PENDING_REVIEW",
        matchDocumentType: item.kind,
        storageKey,
        mimeType: validation.mime,
        sizeBytes: item.bytes.byteLength,
        originalName,
        ownerId: actorId,
        uploadedById: actorId,
        relatedMatchId: local.id,
        teamId: local.teamId
      }
    });
    documentIdsByKind.set(item.kind, created.id);
    importedDocuments++;
  }

  let lineupSummary: Awaited<ReturnType<typeof applyMatchSheetLineup>> | undefined;
  const matchSheet = documentSpecs.find((item) => item.kind === "PRE_MATCH_SHEET");
  if (matchSheet?.bytes && local.teamId) {
    try {
      const sheetText = await extractDocumentText(matchSheet.bytes, "application/pdf");
      if (sheetText) {
        lineupSummary = await applyMatchSheetLineup(local.id, local.teamId, sheetText);
        if (!lineupSummary.applied) {
          warnings.push("حُفظت وثيقة المباراة، لكن لم تكن بيانات التشكيلة المقروءة كافية لتعديل قائمة اللاعبين.");
        }
      } else {
        warnings.push("حُفظت وثيقة المباراة، لكن تعذرت قراءة الأسماء تلقائياً؛ لم يتم تغيير قائمة اللاعبين.");
      }
    } catch (error) {
      console.warn("[FAF EMS] Match sheet lineup extraction failed", error);
      warnings.push("حُفظت وثيقة المباراة، لكن تعذر استخراج قائمة اللاعبين منها؛ لم يتم تغيير القائمة.");
    }
  }

  const refereeReportDocumentId = documentIdsByKind.get("REFEREE_REPORT");

  const isLocalHome = String((local.isHomeFixture ? official.clubLoc : official.clubVis)?.fifaId || "").toUpperCase() === config.clubCode.toUpperCase();
  const events = eventSummary(official);
  // Do not publish free-form referee prose; it can contain technical-staff
  // card details. The public summary is built from the curated player events.
  const reportText = events.length ? `مجريات المباراة من FAF EMS:\n${events.join("\n")}` : "";
  const referee = [official.arbitre?.prenomArbitre, official.arbitre?.nomArbitre].filter(Boolean).join(" ") || null;
  const importedEventCount = await reconcilePlayerEvents(
    local.id,
    local.teamId,
    official,
    externalId,
    local.isHomeFixture,
    config.clubCode
  );
  const officialStatus = String(official.status || official.matchStatus || official.etatRencontre || "").toLocaleLowerCase("ar");
  const explicitlyFinished = /finished|termin|jouee|joué|clotur|final|انتهت|منتهية|نهائي/.test(officialStatus)
    || finalReportResult.status === "fulfilled";
  const explicitlyLive = /live|en cours|مباشر|جارية/.test(officialStatus);
  await db.match.update({
    where: { id: local.id },
    data: {
      homeScore: isLocalHome ? official.scoreLoc : official.scoreVis,
      awayScore: isLocalHome ? official.scoreVis : official.scoreLoc,
      stadium: official.stade?.nomAr || official.stade?.nomStade || local.stadium,
      refereeNameAr: referee || local.refereeNameAr,
      matchReport: reportText || local.matchReport,
      ...(explicitlyFinished ? { status: "FINISHED" as const } : explicitlyLive ? { status: "LIVE" as const } : {})
    }
  });
  let analysisMessage = "";
  if (refereeReportDocumentId) {
    // Queue report analysis only after imported player events exist, so its
    // duplicate check sees this reconciliation pass before it creates events.
    await enqueueRefereeReportAnalysis(db, { matchId: local.id, documentId: refereeReportDocumentId, userId: actorId });
    analysisMessage = " أُضيف تحليل أحداث التقرير إلى قائمة المهام الخلفية.";
  }
  await db.integrationState.upsert({
    where: { key: `faf-ems-match-${externalId}` },
    create: { key: `faf-ems-match-${externalId}`, value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) }
  });
  await writeAuditLog({ userId: actorId, action: "FAF_MATCH_SYNC_COMPLETED", entityType: "Match", entityId: local.id, changes: { externalId, importedDocuments, eventCount: events.length, importedEventCount, lineupSummary, warnings } });
  const lineupMessage = lineupSummary?.applied
    ? ` تم تحديث قائمة المباراة تلقائياً: ${lineupSummary.starters} أساسي، ${lineupSummary.substitutes} احتياط، ${lineupSummary.notCalled} غير مدعو، ${lineupSummary.injured} مصاب يدوياً، ${lineupSummary.suspended} موقوف.`
    : "";
  return {
    success: true,
    matchId: local.id,
    message: `تمت مزامنة تفاصيل المباراة من FAF EMS وحفظ ${importedDocuments} مستندات جديدة وتحديث ${refreshedDocuments} مستندات وإضافة ${importedEventCount} حدث جديد دون تكرار الموجود.${lineupMessage}${analysisMessage}${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
    refereeName: referee || undefined,
    matchSheetDocId: documentIdsByKind.get("PRE_MATCH_SHEET"),
    refereeReportDocId: refereeReportDocumentId,
    warnings
  };
}
