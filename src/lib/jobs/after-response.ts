import "server-only";
import { after } from "next/server";
import "./registry-init";
import { processJobBatch } from "./worker";
import { db } from "@/lib/db";

/**
 * Gives a newly queued task an immediate processing opportunity on serverless
 * platforms. The durable DB queue remains the source of truth; the scheduled
 * worker can still recover work if the request runtime is interrupted.
 */
export function processQueuedJobAfterResponse(
  type: string,
  options?: { jobId?: string; followUp?: { type: string; matchId: string } }
): void {
  after(async () => {
    try {
      await processJobBatch({ maxJobs: 1, types: [type], ...(options?.jobId ? { jobIds: [options.jobId] } : {}) });

      if (options?.followUp) {
        const parent = options.jobId
          ? await db.backgroundJob.findUnique({ where: { id: options.jobId }, select: { createdAt: true } })
          : null;
        const candidates = await db.backgroundJob.findMany({
          where: {
            type: options.followUp.type,
            payload: { path: ["matchId"], equals: options.followUp.matchId },
            ...(parent ? { createdAt: { gte: parent.createdAt } } : {}),
            status: { in: ["QUEUED", "RETRYING"] }
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true }
        });
        const followUp = candidates[0];
        if (followUp) await processJobBatch({ maxJobs: 1, types: [options.followUp.type], jobIds: [followUp.id] });
      }
    } catch {
      // Keep sensitive document content and provider details out of logs.
      console.error("[BackgroundJob] After-response processing failed");
    }
  });
}
