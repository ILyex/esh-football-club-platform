import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { JobRecord } from "./types";

// ============================================================================
// P5 — ATOMIC JOB CLAIMING & LEASE MANAGEMENT
// ----------------------------------------------------------------------------
// Implements safe job claiming with:
//   1. Atomic claiming via conditional updates & row-locking (prevents double-runs).
//   2. Crash recovery for abandoned RUNNING jobs whose lease expired.
//   3. Strict maxAttempts enforcement: expired jobs that reached maxAttempts
//      are moved to FAILED instead of being reclaimed.
//   4. Fenced lease extension: a stale worker whose lease expired cannot renew
//      or overwrite a job that was reclaimed by another worker.
// ============================================================================

export const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface ClaimOptions {
  workerId: string;
  leaseDurationMs?: number;
  types?: string[];
  jobIds?: string[];
}

/**
 * Claims the next highest-priority available job atomically.
 * Returns null if no eligible jobs are available.
 */
export async function claimNextJob(
  options: ClaimOptions,
  client: Prisma.TransactionClient | typeof db = db
): Promise<JobRecord | null> {
  // When called with the root db client, wrap in an interactive transaction
  // so that PostgreSQL row-level locks acquired with FOR UPDATE SKIP LOCKED
  // are held across both the candidate selection and the subsequent update.
  if (typeof (client as any).$transaction === "function" && !(client as any).__inClaimTx) {
    return (client as any).$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        (tx as any).__inClaimTx = true;
        return await claimNextJob(options, tx);
      } finally {
        delete (tx as any).__inClaimTx;
      }
    });
  }

  const { workerId, leaseDurationMs = DEFAULT_LEASE_DURATION_MS, types, jobIds } = options;
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseDurationMs);

  // 1. Try PostgreSQL raw SQL with FOR UPDATE SKIP LOCKED if supported
  if (typeof (client as any).$queryRaw === "function") {
    try {
      const typeFilter = types && types.length > 0 ? types : null;
      const idFilter = jobIds && jobIds.length > 0 ? jobIds : null;
      const candidates: Array<{ id: string; status: string; attempts: number; maxAttempts: number }> =
        await (client as any).$queryRaw`
          SELECT id, status, attempts, "maxAttempts"
          FROM "BackgroundJob"
          WHERE (
            ("status" = 'QUEUED' AND "scheduledAt" <= ${now})
            OR ("status" = 'RETRYING' AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now}))
            OR ("status" = 'RUNNING' AND "lockedUntil" IS NOT NULL AND "lockedUntil" < ${now})
          )
          AND (${typeFilter}::text[] IS NULL OR "type" = ANY(${typeFilter}))
          AND (${idFilter}::text[] IS NULL OR id = ANY(${idFilter}))
          ORDER BY
            CASE "priority"
              WHEN 'CRITICAL' THEN 4
              WHEN 'HIGH' THEN 3
              WHEN 'DEFAULT' THEN 2
              WHEN 'LOW' THEN 1
              ELSE 2
            END DESC,
            "scheduledAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED;
        `;

      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        if (!candidate) return null;

        // Crash recovery safety: If lease expired on RUNNING job, check if maxAttempts reached
        if (candidate.status === "RUNNING" && candidate.attempts >= candidate.maxAttempts) {
          await client.backgroundJob.update({
            where: { id: candidate.id },
            data: {
              status: "FAILED",
              failedAt: now,
              lastError: `Lease expired after reaching maxAttempts (${candidate.attempts}/${candidate.maxAttempts})`
            }
          });
          // Look for next candidate recursively
          return claimNextJob(options, client);
        }

        // Atomically claim the candidate
        const claimed = await client.backgroundJob.update({
          where: { id: candidate.id },
          data: {
            status: "RUNNING",
            lockedBy: workerId,
            lockedUntil: leaseUntil,
            startedAt: now,
            attempts: { increment: 1 }
          }
        });
        return claimed as unknown as JobRecord;
      }
      return null;
    } catch {
      // Fallback to Prisma ORM query (e.g. in test doubles or environments without raw SQL)
    }
  }

  // 2. ORM-level fallback claiming logic
  const typeCondition = types && types.length > 0 ? { in: types } : undefined;
  const idCondition = jobIds && jobIds.length > 0 ? { in: jobIds } : undefined;

  const candidate = await client.backgroundJob.findFirst({
    where: {
      AND: [
        typeCondition ? { type: typeCondition } : {},
        idCondition ? { id: idCondition } : {},
        {
          OR: [
            { status: "QUEUED", scheduledAt: { lte: now } },
            { status: "RETRYING", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
            { status: "RUNNING", lockedUntil: { lt: now } }
          ]
        }
      ]
    },
    orderBy: [
      { priority: "desc" },
      { scheduledAt: "asc" }
    ]
  });

  if (!candidate) return null;

  // Stale recovery boundary: If running job exhausted attempts, mark FAILED
  if (candidate.status === "RUNNING" && candidate.attempts >= candidate.maxAttempts) {
    await client.backgroundJob.update({
      where: { id: candidate.id },
      data: {
        status: "FAILED",
        failedAt: now,
        lastError: `Lease expired after reaching maxAttempts (${candidate.attempts}/${candidate.maxAttempts})`
      }
    });
    return claimNextJob(options, client);
  }

  // Conditional update for atomic claim
  const result = await client.backgroundJob.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      ...(candidate.status === "RUNNING" ? { lockedUntil: candidate.lockedUntil } : {})
    },
    data: {
      status: "RUNNING",
      lockedBy: workerId,
      lockedUntil: leaseUntil,
      startedAt: now,
      attempts: candidate.attempts + 1
    }
  });

  if (result.count === 0) {
    // Another worker claimed this candidate in the microsecond window; retry
    return claimNextJob(options, client);
  }

  const claimed = await client.backgroundJob.findUnique({ where: { id: candidate.id } });
  return claimed as unknown as JobRecord;
}

/**
 * Fenced lease renewal: extends lockedUntil only if the job is still RUNNING
 * and still owned by the specified worker. If another worker reclaimed the job
 * due to lease expiry, this returns false (fencing out the stale worker).
 */
export async function renewJobLease(
  jobId: string,
  workerId: string,
  extensionMs: number = DEFAULT_LEASE_DURATION_MS,
  client: Prisma.TransactionClient | typeof db = db
): Promise<boolean> {
  const now = new Date();
  const newLease = new Date(now.getTime() + extensionMs);

  const updated = await client.backgroundJob.updateMany({
    where: {
      id: jobId,
      status: "RUNNING",
      lockedBy: workerId,
      lockedUntil: { gte: now } // Must not be expired/reclaimed
    },
    data: {
      lockedUntil: newLease
    }
  });

  return updated.count > 0;
}
