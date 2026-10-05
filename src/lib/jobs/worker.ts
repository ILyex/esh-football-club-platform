import "server-only";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getJobDefinition, validateJobPayload } from "./registry";
import { claimNextJob, renewJobLease } from "./claim";
import {
  type JobRecord,
  type JobContext,
  isErrorRetryable
} from "./types";
import { nanoid } from "nanoid";

// ============================================================================
// P5 — JOB EXECUTION PIPELINE, RETRIES & OBSERVABILITY
// ----------------------------------------------------------------------------
// Manages the complete lifecycle of job execution:
//   - Handler invocation with per-job context and fenced lease heartbeat.
//   - Robust retry classification (Retryable vs NonRetryable).
//   - Exponential backoff with jitter.
//   - Sensitive data sanitization in error logs.
//   - Audit trail for permanent job failures and significant operational events.
//   - Graceful shutdown handling for standalone workers.
// ============================================================================

export interface ExecuteOptions {
  workerId?: string;
  leaseDurationMs?: number;
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
}

/**
 * Calculates exponential backoff with jitter.
 * Base delay: 30 seconds, multiplier: 2^(attempt-1), max delay: 1 hour.
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = 30_000,
  maxMs: number = 3_600_000
): number {
  const exponential = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(maxMs, exponential);
  // Add 10-25% random jitter to avoid thundering herd
  const jitter = capped * (0.1 + Math.random() * 0.15);
  return Math.round(capped + jitter);
}

/**
 * Sanitizes error messages to prevent leaking secrets, credentials, tokens, or cookies.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  let msg = error instanceof Error ? error.message : String(error);

  // Redact common secret patterns
  msg = msg.replace(/(password|secret|token|key|cookie)=[^&\s]+/gi, "$1=[REDACTED]");
  msg = msg.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");

  // Bound length to 500 characters
  return msg.length > 500 ? `${msg.slice(0, 497)}...` : msg;
}

/**
 * Executes a single claimed job to completion or registers failure/retry.
 */
export async function executeJob(job: JobRecord, options?: ExecuteOptions): Promise<boolean> {
  const workerId = options?.workerId ?? job.lockedBy ?? `worker-${nanoid(8)}`;
  const context: JobContext = {
    jobId: job.id,
    type: job.type,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    workerId,
    correlationId: job.correlationId,
    createdById: job.createdById,
    renewLease: (extMs) => renewJobLease(job.id, workerId, extMs)
  };

  const def = getJobDefinition(job.type);

  if (!def) {
    const errorMsg = `No registered handler found for job type "${job.type}"`;
    await db.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        lastError: errorMsg,
        lockedBy: null,
        lockedUntil: null
      }
    });
    return false;
  }

  try {
    // 1. Validate payload immediately before execution
    const validatedPayload = validateJobPayload(job.type, job.payload);

    // 2. Invoke the registered handler
    await def.handler(validatedPayload, context);

    // 3. Mark SUCCEEDED on successful completion
    await db.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        lastError: null,
        lockedBy: null,
        lockedUntil: null
      }
    });
    return true;
  } catch (error: unknown) {
    const sanitizedError = sanitizeErrorMessage(error);
    const retryable = isErrorRetryable(error);
    const attemptsRemaining = job.attempts < job.maxAttempts;

    if (retryable && attemptsRemaining) {
      // Transition to RETRYING with exponential backoff
      const delayMs = calculateBackoff(job.attempts);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await db.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "RETRYING",
          nextRetryAt,
          lastError: sanitizedError,
          lockedBy: null,
          lockedUntil: null
        }
      });
      return false;
    } else {
      // Transition to FAILED permanently
      await db.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          lastError: sanitizedError,
          lockedBy: null,
          lockedUntil: null
        }
      });

      // Write audit log entry for permanent failure
      await writeAuditLog({
        userId: job.createdById,
        action: "job.failed_permanently",
        entityType: "BackgroundJob",
        entityId: job.id,
        changes: {
          type: job.type,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          error: sanitizedError
        }
      }).catch(() => undefined);

      return false;
    }
  }
}

/**
 * Claims and executes a batch of pending jobs.
 * Used by both the Cron API route handler and the standalone daemon.
 */
export async function processJobBatch(options?: {
  workerId?: string;
  maxJobs?: number;
  types?: string[];
  leaseDurationMs?: number;
}): Promise<BatchResult> {
  const workerId = options?.workerId ?? `worker-${nanoid(8)}`;
  const maxJobs = options?.maxJobs ?? 10;
  const result: BatchResult = { processed: 0, succeeded: 0, failed: 0, retried: 0 };

  for (let i = 0; i < maxJobs; i++) {
    const job = await claimNextJob({
      workerId,
      leaseDurationMs: options?.leaseDurationMs,
      types: options?.types
    });

    if (!job) {
      // No more eligible jobs in queue
      break;
    }

    result.processed++;
    const success = await executeJob(job, { workerId });
    if (success) {
      result.succeeded++;
    } else {
      // Fetch latest state to classify failure vs retry
      const updated = await db.backgroundJob.findUnique({ where: { id: job.id }, select: { status: true } });
      if (updated?.status === "RETRYING") {
        result.retried++;
      } else {
        result.failed++;
      }
    }
  }

  return result;
}

/**
 * Runs a continuous daemon loop with graceful shutdown for standalone worker CLI.
 */
export async function startWorkerDaemon(options?: {
  pollIntervalMs?: number;
  concurrency?: number;
}): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2000;
  const workerId = `daemon-${process.pid}-${nanoid(6)}`;
  let isRunning = true;

  const shutdown = () => {
    console.log(`[JobWorker ${workerId}] Received shutdown signal. Stopping gracefully...`);
    isRunning = false;
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`[JobWorker ${workerId}] Worker daemon started. Polling every ${pollIntervalMs}ms...`);

  while (isRunning) {
    try {
      const batchResult = await processJobBatch({ workerId, maxJobs: options?.concurrency ?? 5 });
      if (batchResult.processed === 0) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    } catch (err) {
      console.error(`[JobWorker ${workerId}] Error in worker loop:`, err);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  console.log(`[JobWorker ${workerId}] Worker daemon stopped.`);
}
