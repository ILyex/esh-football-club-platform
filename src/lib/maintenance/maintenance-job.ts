import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { registerJobHandler, hasJobHandler } from "@/lib/jobs/registry";

export const maintenanceCleanupSchema = z.object({
  retentionAnalyticsDays: z.number().int().min(7).max(365).optional(),
  retentionCompletedJobsDays: z.number().int().min(7).max(180).optional()
}).default({});

export async function runMaintenanceCleanup(params?: z.infer<typeof maintenanceCleanupSchema>) {
  const analyticsDays = params?.retentionAnalyticsDays ?? 90;
  const completedJobsDays = params?.retentionCompletedJobsDays ?? 30;

  const now = new Date();
  const analyticsCutoff = new Date(now.getTime() - analyticsDays * 24 * 60 * 60 * 1000);
  const jobsCutoff = new Date(now.getTime() - completedJobsDays * 24 * 60 * 60 * 1000);

  // 1. Purge expired rate limit buckets
  let rateLimitBucketsPurged = 0;
  if (db.rateLimitBucket?.deleteMany) {
    const res = await db.rateLimitBucket.deleteMany({
      where: { expiresAt: { lt: now } }
    }).catch((err) => {
      console.warn("[Maintenance] Failed to clean expired rate limit buckets:", err);
      return { count: 0 };
    });
    rateLimitBucketsPurged = res.count;
  }

  // 2. Purge old website analytics events to keep Neon DB storage permanently lean
  let analyticsEventsPurged = 0;
  if (db.websiteAnalyticsEvent?.deleteMany) {
    const res = await db.websiteAnalyticsEvent.deleteMany({
      where: { createdAt: { lt: analyticsCutoff } }
    }).catch((err) => {
      console.warn("[Maintenance] Failed to clean old analytics events:", err);
      return { count: 0 };
    });
    analyticsEventsPurged = res.count;
  }

  // 3. Purge finished background jobs (SUCCEEDED / CANCELLED)
  let backgroundJobsPurged = 0;
  if (db.backgroundJob?.deleteMany) {
    const res = await db.backgroundJob.deleteMany({
      where: {
        status: { in: ["SUCCEEDED", "CANCELLED"] },
        updatedAt: { lt: jobsCutoff }
      }
    }).catch((err) => {
      console.warn("[Maintenance] Failed to clean old background jobs:", err);
      return { count: 0 };
    });
    backgroundJobsPurged = res.count;
  }

  return {
    rateLimitBucketsPurged,
    analyticsEventsPurged,
    backgroundJobsPurged
  };
}

export function registerMaintenanceJobHandler(): void {
  if (hasJobHandler("system.maintenance_cleanup")) return;
  registerJobHandler({
    type: "system.maintenance_cleanup",
    schema: maintenanceCleanupSchema,
    defaultPriority: "LOW",
    defaultMaxAttempts: 2,
    handler: async (payload) => {
      const result = await runMaintenanceCleanup(payload);
      return result;
    }
  });
}
