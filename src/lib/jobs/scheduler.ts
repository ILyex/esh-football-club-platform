import "server-only";
import { db } from "@/lib/db";
import { enqueueJob } from "./queue";
import "./registry-init";

// ============================================================================
// P5 — DETERMINISTIC JOB SCHEDULER
// ----------------------------------------------------------------------------
// Idempotently enqueues recurring system jobs using time-bucketed idempotency
// keys. Running the scheduler multiple times (concurrently or sequentially)
// within the same time window never creates duplicate jobs.
// ============================================================================

export interface SchedulerTickResult {
  enqueuedJobs: string[];
}

/**
 * Runs a scheduler tick to ensure all due periodic jobs are in the queue.
 * Safe under concurrency.
 */
export async function runSchedulerTick(): Promise<SchedulerTickResult> {
  const enqueuedJobs: string[] = [];
  const now = new Date();

  // Hourly Insights & Notifications Sync
  // Bucket key format: "scheduled:insights.sync:YYYY-MM-DDTHH"
  const hourlyBucket = now.toISOString().slice(0, 13);
  const insightsSyncKey = `scheduled:insights.sync:${hourlyBucket}`;

  try {
    const job = await enqueueJob(db, {
      type: "insights.sync",
      payload: { triggerSource: "scheduler" },
      idempotencyKey: insightsSyncKey,
      priority: "DEFAULT",
      maxAttempts: 3
    });
    if (job) {
      enqueuedJobs.push(job.id);
    }
  } catch (error) {
    console.error("[Scheduler] Error scheduling insights.sync:", error);
  }

  return { enqueuedJobs };
}
