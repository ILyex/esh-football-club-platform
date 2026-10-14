import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { registerJobHandler, hasJobHandler } from "@/lib/jobs/registry";
import { enqueueJob, type DbOrTx } from "@/lib/jobs/queue";

export const refereeReportAnalysisSchema = z.object({
  matchId: z.string(),
  documentId: z.string(),
  userId: z.string()
});

export async function enqueueRefereeReportAnalysis(
  client: DbOrTx,
  input: z.infer<typeof refereeReportAnalysisSchema>
) {
  const baseKey = `referee-report-analysis-${input.documentId}`;
  const prior = await client.backgroundJob.findUnique({ where: { idempotencyKey: baseKey }, select: { status: true } });
  const idempotencyKey = prior && (prior.status === "FAILED" || prior.status === "CANCELLED")
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
    handler: async ({ matchId, documentId, userId }) => {
      const doc = await db.document.findFirst({
        where: { id: documentId, relatedMatchId: matchId, matchDocumentType: "REFEREE_REPORT" },
        select: { storageKey: true, mimeType: true }
      });
      if (!doc) throw new Error("Referee report document not found");

      const { getPrivateFileBuffer } = await import("@/lib/storage");
      const { extractDocumentText } = await import("@/lib/ai/document-verifier");
      const buffer = await getPrivateFileBuffer(doc.storageKey);
      const reportText = await extractDocumentText(buffer, doc.mimeType || "application/pdf");
      if (!reportText?.trim()) throw new Error("Could not extract readable text from referee report");

      const { parseAndApplyRefereeReportWithAI } = await import("@/lib/ai/referee-report-ai-service");
      const result = await parseAndApplyRefereeReportWithAI({ matchId, reportText, userId });
      if (!result.success) throw new Error(result.summary || "Referee report analysis failed");
      return { eventsCreated: result.eventsCreated, provider: result.aiProviderUsed };
    }
  });
}
