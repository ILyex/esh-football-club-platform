import "server-only";
import { db } from "@/lib/db";
import { enqueueJob } from "./queue";
import { enqueueMedicalDocumentCheck } from "@/lib/ai/medical-document-check-job";
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

  // Daily Database Maintenance & Ephemeral Record Pruning
  // Keeps Neon DB free-tier storage permanently lean by removing expired rate limits,
  // 90-day-old analytics records, and completed background jobs.
  const dailyBucket = now.toISOString().slice(0, 10);
  const maintenanceKey = `scheduled:system.maintenance_cleanup:${dailyBucket}`;
  try {
    const maintenanceJob = await enqueueJob(db, {
      type: "system.maintenance_cleanup",
      payload: {},
      idempotencyKey: maintenanceKey,
      priority: "LOW",
      maxAttempts: 2
    });
    if (maintenanceJob) {
      enqueuedJobs.push(maintenanceJob.id);
    }
  } catch (error) {
    console.error("[Scheduler] Error scheduling system.maintenance_cleanup:", error);
  }

  // Backfill legacy medical records in bounded batches. Uploads enqueue their
  // check immediately; this also picks up records created before the worker
  // feature was installed.
  try {
    const pendingMedicalRecords = await db.playerMedicalRecord.findMany({
      where: { documentCheckStatus: "QUEUED", documentId: { not: null } },
      select: { id: true, createdById: true },
      orderBy: { createdAt: "asc" },
      take: 25
    });
    for (const record of pendingMedicalRecords) {
      const job = await enqueueMedicalDocumentCheck(db, record.id, record.createdById);
      enqueuedJobs.push(job.id);
    }
  } catch (error) {
    console.error("[Scheduler] Error scheduling medical document checks:", error);
  }

  return { enqueuedJobs };
}
