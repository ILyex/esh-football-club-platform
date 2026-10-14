import "server-only";

import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getFAFConfig } from "./config";
import { getFafEmsClient } from "./ems-client";
import { enqueueRefereeReportAnalysis } from "@/lib/ai/referee-report-job";

export interface FafMatchSyncResult {
  success: boolean;
  matchId: string;
  message: string;
  refereeName?: string;
  matchSheetDocId?: string;
  refereeReportDocId?: string;
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
  if (!config.enabled || !config.hasCredentials) throw new Error("FAF EMS credentials are not configured on the server.");
  const { local, remote } = await resolveLocalMatch(matchId, config.clubCode);
  if (!remote) throw new Error("No matching FAF EMS record was found.");
  const actorId = userId || (await db.user.findFirst({ where: { role: { key: "ADMIN" } }, select: { id: true } }))?.id;
  if (!actorId) throw new Error("A platform user is required to attach imported FAF documents.");
  const externalId = Number(remote.id);
  const api = getFafEmsClient();
  const [details, firstReport, finalReport] = await Promise.all([
    api.matchInfo(externalId),
    api.report(externalId, "first-report-ar"),
    api.report(externalId, "final-report-ar")
  ]);
  const official = details.match;
  const category = await db.documentCategory.findUnique({ where: { key: "report" } });
  if (!category) throw new Error("Document category 'Reports' is missing; run the platform seed/migration first.");

  const { validateUploadedFile, uploadPrivateFile, generateStorageKey } = await import("@/lib/storage");
  const documentSpecs = [
    { kind: "PRE_MATCH_SHEET" as const, label: "first-report-ar", title: "وثيقة بداية المباراة", bytes: firstReport },
    { kind: "REFEREE_REPORT" as const, label: "final-report-ar", title: "تقرير المباراة النهائي", bytes: finalReport }
  ];
  const documentIds: string[] = [];
  let importedDocuments = 0;
  for (const item of documentSpecs) {
    const originalName = `FAF-EMS-${externalId}-${item.label}.pdf`;
    const existing = await db.document.findFirst({ where: { relatedMatchId: local.id, originalName }, select: { id: true } });
    if (existing) { documentIds.push(existing.id); continue; }
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
    documentIds.push(created.id);
    importedDocuments++;
  }

  let analysisMessage = "";
  if (finalReport.byteLength > 0 && documentIds[1]) {
    await enqueueRefereeReportAnalysis(db, { matchId: local.id, documentId: documentIds[1], userId: actorId });
    analysisMessage = " أُضيف تحليل أحداث التقرير إلى قائمة المهام الخلفية.";
  }

  const isLocalHome = String((local.isHomeFixture ? official.clubLoc : official.clubVis)?.fifaId || "").toUpperCase() === config.clubCode.toUpperCase();
  const report = String(official.refereeReport || "").trim();
  const events = eventSummary(official);
  const reportText = [report, events.length ? `مجريات المباراة من FAF EMS:\n${events.join("\n")}` : ""].filter(Boolean).join("\n\n");
  const referee = [official.arbitre?.prenomArbitre, official.arbitre?.nomArbitre].filter(Boolean).join(" ") || null;
  await db.match.update({
    where: { id: local.id },
    data: {
      homeScore: isLocalHome ? official.scoreLoc : official.scoreVis,
      awayScore: isLocalHome ? official.scoreVis : official.scoreLoc,
      stadium: official.stade?.nomAr || official.stade?.nomStade || local.stadium,
      refereeNameAr: referee || local.refereeNameAr,
      matchReport: reportText || local.matchReport,
      status: "FINISHED"
    }
  });
  await db.integrationState.upsert({
    where: { key: `faf-ems-match-${externalId}` },
    create: { key: `faf-ems-match-${externalId}`, value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) }
  });
  await writeAuditLog({ userId: actorId, action: "FAF_MATCH_SYNC_COMPLETED", entityType: "Match", entityId: local.id, changes: { externalId, importedDocuments, eventCount: events.length } });
  return {
    success: true,
    matchId: local.id,
    message: `تمت مزامنة تفاصيل المباراة من FAF EMS وحفظ ${importedDocuments} مستندات جديدة في المنصة.${analysisMessage}`,
    refereeName: referee || undefined,
    matchSheetDocId: documentIds[0],
    refereeReportDocId: documentIds[1]
  };
}
