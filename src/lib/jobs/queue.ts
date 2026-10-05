import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getJobDefinition, validateJobPayload } from "./registry";
import type { EnqueueInput, JobRecord } from "./types";

// ============================================================================
// P5 — TRANSACTIONAL BACKGROUND JOB ENQUEUE
// ----------------------------------------------------------------------------
// Enables transactional outbox patterns by accepting an optional Prisma
// TransactionClient (`tx`). When called inside an existing `db.$transaction`,
// the job record commits or rolls back atomically with the business mutation.
// Idempotency keys prevent duplicate enqueues even under concurrent requests.
// ============================================================================

export type DbOrTx = Prisma.TransactionClient | typeof db;

/**
 * Enqueues a background job transactionally.
 * If caller provides `tx`, the job is committed as part of the caller's transaction.
 * If an `idempotencyKey` is provided and already exists, the existing job is returned.
 */
export async function enqueueJob<TPayload = unknown>(
  client: DbOrTx,
  input: EnqueueInput<TPayload>
): Promise<JobRecord<TPayload>> {
  // 1. Validate payload against registered schema before enqueueing
  const def = getJobDefinition(input.type);
  if (def) {
    validateJobPayload(input.type, input.payload);
  }

  const priority = input.priority ?? def?.defaultPriority ?? "DEFAULT";
  const maxAttempts = input.maxAttempts ?? def?.defaultMaxAttempts ?? 3;
  const scheduledAt = input.scheduledAt ?? new Date();

  // 2. Check for existing job if idempotencyKey is provided
  if (input.idempotencyKey) {
    const existing = await client.backgroundJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return existing as unknown as JobRecord<TPayload>;
    }
  }

  // 3. Insert job record (handling race conditions on idempotencyKey)
  try {
    const created = await client.backgroundJob.create({
      data: {
        type: input.type,
        payload: input.payload as any,
        priority,
        maxAttempts,
        scheduledAt,
        idempotencyKey: input.idempotencyKey ?? null,
        correlationId: input.correlationId ?? null,
        createdById: input.createdById ?? null,
        status: "QUEUED"
      }
    });
    return created as unknown as JobRecord<TPayload>;
  } catch (error: any) {
    // If concurrent insert raced on the same idempotency key, retrieve the winning record
    if (input.idempotencyKey && (error?.code === "P2002" || error?.message?.includes("Unique constraint"))) {
      const existing = await client.backgroundJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey }
      });
      if (existing) {
        return existing as unknown as JobRecord<TPayload>;
      }
    }
    throw error;
  }
}

/**
 * Convenience helper to cancel a queued or retrying job.
 */
export async function cancelJob(
  client: DbOrTx,
  jobId: string,
  reason: string
): Promise<boolean> {
  const job = await client.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) return false;

  if (job.status === "QUEUED" || job.status === "RETRYING") {
    await client.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        lastError: `Cancelled: ${reason}`,
        completedAt: new Date()
      }
    });
    return true;
  }

  return false;
}
