import "server-only";
import { z } from "zod";
import { registerJobHandler, hasJobHandler } from "@/lib/jobs/registry";
import { enqueueJob, type DbOrTx } from "@/lib/jobs/queue";
import { syncGmailInbox } from "./service";
import { GmailAuthRevokedError, GmailRateLimitError } from "./client";
import { NonRetryableError, RetryableError, type JobContext } from "@/lib/jobs/types";

// ============================================================================
// PHASE 11 — GMAIL BACKGROUND SYNCHRONIZATION VIA P5 QUEUE
// ============================================================================

export const gmailSyncPayloadSchema = z.object({
  userId: z.string().optional()
});

export type GmailSyncJobPayload = z.infer<typeof gmailSyncPayloadSchema>;

export async function enqueueGmailSyncJob(
  client: DbOrTx,
  input: { userId?: string } = {}
) {
  // Idempotency: bounded to 1 automated sync job per 10-minute window
  const tenMinuteWindow = new Date().toISOString().slice(0, 15);
  const idempotencyKey = `gmail-sync-${tenMinuteWindow}`;

  return enqueueJob(client, {
    type: "gmail.sync",
    payload: input,
    idempotencyKey,
    createdById: input.userId || null,
    priority: "DEFAULT",
    maxAttempts: 3
  });
}

/**
 * Registers the Gmail background synchronization job handler with the P5 worker registry.
 */
export function registerGmailJobHandlers(): void {
  if (hasJobHandler("gmail.sync")) return;

  registerJobHandler<GmailSyncJobPayload, any>({
    type: "gmail.sync",
    schema: gmailSyncPayloadSchema,
    defaultPriority: "DEFAULT",
    defaultMaxAttempts: 3,
    handler: async (payload: GmailSyncJobPayload, _context: JobContext) => {
      try {
        const result = await syncGmailInbox(payload.userId);
        return result;
      } catch (err: any) {
        if (err instanceof GmailAuthRevokedError) {
          throw new NonRetryableError("Gmail OAuth authorization revoked or expired", {
            error: err.message
          });
        }
        if (err instanceof GmailRateLimitError) {
          throw new RetryableError("Gmail API rate limit encountered, backing off", {
            error: err.message
          });
        }
        // General network / transient errors are retryable by default
        throw err;
      }
    }
  });
}

// Auto-register on module load
registerGmailJobHandlers();
