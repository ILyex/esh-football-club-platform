"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { cancelJob } from "@/lib/jobs/queue";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// ============================================================================
// P5 — ADMIN JOB MANAGEMENT SERVER ACTIONS
// ----------------------------------------------------------------------------
// Protected administrative actions for viewing and managing background jobs.
// Strictly guarded by requirePermission("settings.manage").
// ============================================================================

export async function retryJobAction(jobId: string) {
  const user = await requirePermission("settings.manage");

  const job = await db.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error("Job not found");
  }

  // Only failed or cancelled jobs can be retried
  if (job.status !== "FAILED" && job.status !== "CANCELLED") {
    throw new Error(`Cannot retry job in status "${job.status}"`);
  }

  await db.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      attempts: 0,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      nextRetryAt: null,
      lockedBy: null,
      lockedUntil: null,
      lastError: null
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "job.manually_retried",
    entityType: "BackgroundJob",
    entityId: jobId,
    changes: { previousStatus: job.status, type: job.type }
  });

  revalidatePath("/[locale]/dashboard/jobs", "page");
}

export async function cancelJobAction(jobId: string, reason?: string) {
  const user = await requirePermission("settings.manage");

  const success = await cancelJob(db, jobId, reason ?? "Cancelled by administrator");
  if (!success) {
    throw new Error("Job could not be cancelled (must be in QUEUED or RETRYING state)");
  }

  await writeAuditLog({
    userId: user.id,
    action: "job.manually_cancelled",
    entityType: "BackgroundJob",
    entityId: jobId,
    changes: { reason: reason ?? "Admin cancellation" }
  });

  revalidatePath("/[locale]/dashboard/jobs", "page");
}
