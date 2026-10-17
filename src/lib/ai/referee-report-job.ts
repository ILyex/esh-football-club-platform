import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { registerJobHandler, hasJobHandler } from "@/lib/jobs/registry";
import { enqueueJob, type DbOrTx } from "@/lib/jobs/queue";

export const refereeReportAnalysisSchema = z.object({
  matchId: z.string(),
  documentId: z.string().optional(),
  reportText: z.string().trim().max(5000).optional(),
  reportTextIsSection: z.boolean().optional(),
  preserveExistingMatchData: z.boolean().optional(),
  userId: z.string()
}).refine((value) => Boolean(value.documentId || value.reportText), {
  message: "A report document or report text is required."
});

export async function enqueueRefereeReportAnalysis(
  client: DbOrTx,
  input: z.infer<typeof refereeReportAnalysisSchema>,
  options?: { allowRerun?: boolean }
) {
  const reportHash = input.reportText
    ? createHash("sha256").update(input.reportText.trim()).digest("hex").slice(0, 24)
    : null;
  const documentKey = input.documentId || `text-${input.matchId}-${reportHash}`;
  const baseKey = `referee-report-analysis-${documentKey}`;
  const prior = await client.backgroundJob.findUnique({ where: { idempotencyKey: baseKey }, select: { status: true } });
  const shouldRetry = prior && (
    prior.status === "FAILED" ||
    prior.status === "CANCELLED" ||
    (options?.allowRerun && prior.status === "SUCCEEDED")
  );
  const idempotencyKey = shouldRetry
    ? `${baseKey}-retry-${Date.now()}`
    : baseKey;
  return enqueueJob(client, {
    type: "match.referee_report_analysis",
    payload: input,
    idempotencyKey,
    createdById: input.userId,
    priority: "HIGH",
    maxAttempts: 2
  });
}

export function registerRefereeReportAnalysisJob(): void {
  if (hasJobHandler("match.referee_report_analysis")) return;
  registerJobHandler({
    type: "match.referee_report_analysis",
    schema: refereeReportAnalysisSchema,
    defaultPriority: "HIGH",
    defaultMaxAttempts: 2,
    handler: async ({ matchId, documentId, reportText, reportTextIsSection, preserveExistingMatchData, userId }) => {
      let sourceText = reportText?.trim() || "";
      if (documentId && !reportTextIsSection) {
        const doc = await db.document.findFirst({
          where: { id: documentId, relatedMatchId: matchId, matchDocumentType: "REFEREE_REPORT" },
          select: { storageKey: true, mimeType: true }
        });
        if (!doc) throw new Error("Referee report document not found");

        const { getPrivateFileBuffer } = await import("@/lib/storage");
        const { extractDocumentText } = await import("@/lib/ai/document-verifier");
        const buffer = await getPrivateFileBuffer(doc.storageKey);
        const { extractFinalMatchReportSection } = await import("@/lib/matches/referee-report-section");
        const extractedDocument = (await extractDocumentText(buffer, doc.mimeType || "application/pdf"))?.trim() || "";
        sourceText = extractFinalMatchReportSection(extractedDocument) || "";
      } else if (sourceText && !reportTextIsSection) {
        const { extractFinalMatchReportSection } = await import("@/lib/matches/referee-report-section");
        sourceText = extractFinalMatchReportSection(sourceText) || sourceText;
      }
      if (!sourceText) throw new Error("Could not find the final match report section in the referee report document");

      const { parseAndApplyRefereeReportWithAI } = await import("@/lib/ai/referee-report-ai-service");
      const result = await parseAndApplyRefereeReportWithAI({ matchId, reportText: sourceText, preserveExistingMatchData, userId });
      if (!result.success) throw new Error(result.summary || "Referee report analysis failed");
      return { eventsCreated: result.eventsCreated, provider: result.aiProviderUsed };
    }
  });
}
