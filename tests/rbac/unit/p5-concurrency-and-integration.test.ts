/**
 * P5 — Concurrency, Claiming, Transactional Outbox & Security Integration Tests
 *
 * Verifies:
 *   1. Double Claim isolation (two workers competing for one job).
 *   2. Concurrent claiming across multiple jobs (distinct allocations).
 *   3. Stale lease recovery (abandoned RUNNING jobs).
 *   4. Final maxAttempts boundary (crashed job at maxAttempts moves to FAILED).
 *   5. Lease fencing (stale worker rejected on lease renewal).
 *   6. Transactional outbox (commit persists job, rollback aborts job).
 *   7. Idempotency race (concurrent duplicate enqueue produces one job).
 *   8. Notification dedup race (concurrent identical notifications produce one row).
 *   9. Team-scoping isolation (Coach U15 vs Coach U20 vs Unrestricted Admin).
 *  10. Cron route security & secret enforcement.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueJob } from "@/lib/jobs/queue";
import { claimNextJob, renewJobLease } from "@/lib/jobs/claim";
import { dispatchNotification } from "@/lib/notifications/service";
import { POST as cronHandler } from "@/app/api/cron/process-jobs/route";
import { NextRequest } from "next/server";

// In-Memory Transactional Fake DB for Concurrency Verification
function createFakeDb() {
  const jobs: any[] = [];
  const notifications: any[] = [];
  const users: any[] = [
    {
      id: "u-coach-u15",
      name: "Coach U15",
      isActive: true,
      role: {
        key: "coach",
        name: "Coach",
        teamScoped: true,
        permissions: [{ permission: { key: "contracts.view" } }, { permission: { key: "players.view" } }]
      },
      teamAssignments: [{ teamId: "team-u15" }]
    },
    {
      id: "u-coach-u20",
      name: "Coach U20",
      isActive: true,
      role: {
        key: "coach",
        name: "Coach",
        teamScoped: true,
        permissions: [{ permission: { key: "contracts.view" } }, { permission: { key: "players.view" } }]
      },
      teamAssignments: [{ teamId: "team-u20" }]
    },
    {
      id: "u-admin",
      name: "Super Admin",
      isActive: true,
      role: {
        key: "super_admin",
        name: "Super Admin",
        teamScoped: false,
        permissions: [{ permission: { key: "*" } }]
      },
      teamAssignments: []
    }
  ];

  let idCounter = 1;

  const client: any = {
    backgroundJob: {
      async findUnique({ where }: any) {
        let found: any = null;
        if (where.id) found = jobs.find((j) => j.id === where.id) ?? null;
        else if (where.idempotencyKey) found = jobs.find((j) => j.idempotencyKey === where.idempotencyKey) ?? null;
        return found ? { ...found } : null;
      },
      async findFirst({ where, orderBy }: any) {
        const now = new Date();
        const candidates = jobs.filter((j) => {
          if (where.type && !where.type.in?.includes(j.type)) return false;
          if (j.status === "QUEUED" && j.scheduledAt <= now) return true;
          if (j.status === "RETRYING" && (!j.nextRetryAt || j.nextRetryAt <= now)) return true;
          if (j.status === "RUNNING" && j.lockedUntil && j.lockedUntil < now) return true;
          return false;
        });
        if (candidates.length === 0) return null;
        // Priority order: CRITICAL > HIGH > DEFAULT > LOW
        const priorityScore: Record<string, number> = { CRITICAL: 4, HIGH: 3, DEFAULT: 2, LOW: 1 };
        candidates.sort((a, b) => (priorityScore[b.priority] ?? 2) - (priorityScore[a.priority] ?? 2) || a.scheduledAt.getTime() - b.scheduledAt.getTime());
        return candidates[0] ? { ...candidates[0] } : null;
      },
      async create({ data }: any) {
        if (data.idempotencyKey && jobs.some((j) => j.idempotencyKey === data.idempotencyKey)) {
          const err: any = new Error("Unique constraint failed on the fields: (`idempotencyKey`)");
          err.code = "P2002";
          throw err;
        }
        const created = {
          id: `job-${idCounter++}`,
          attempts: 0,
          maxAttempts: 3,
          scheduledAt: new Date(),
          startedAt: null,
          completedAt: null,
          failedAt: null,
          nextRetryAt: null,
          lockedBy: null,
          lockedUntil: null,
          lastError: null,
          errorDetails: null,
          correlationId: null,
          createdById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        };
        jobs.push(created);
        return { ...created };
      },
      async update({ where, data }: any) {
        const job = jobs.find((j) => j.id === where.id);
        if (!job) throw new Error("Not found");
        Object.assign(job, data, { updatedAt: new Date() });
        return { ...job };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const job of jobs) {
          if (where.id && job.id !== where.id) continue;
          if (where.status && job.status !== where.status) continue;
          if (where.lockedBy && job.lockedBy !== where.lockedBy) continue;
          if (where.lockedUntil?.lt && !(job.lockedUntil && job.lockedUntil < where.lockedUntil.lt)) continue;
          if (where.lockedUntil?.gte && !(job.lockedUntil && job.lockedUntil >= where.lockedUntil.gte)) continue;

          Object.assign(job, data, { updatedAt: new Date() });
          count++;
        }
        return { count };
      }
    },
    notification: {
      async upsert({ where, create, update }: any) {
        const existing = notifications.find((n) => n.dedupKey === where.dedupKey);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = {
          id: `notif-${idCounter++}`,
          isRead: false,
          createdAt: new Date(),
          ...create
        };
        notifications.push(created);
        return created;
      },
      async findMany({ where }: any) {
        return notifications.filter((n) => {
          if (where.userId && n.userId !== where.userId) return false;
          return true;
        });
      }
    },
    user: {
      async findMany({ where }: any) {
        return users.filter((u) => {
          if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
          if (where.id?.in && !where.id.in.includes(u.id)) return false;
          return true;
        });
      }
    },
    async $transaction(fn: (tx: any) => Promise<any>) {
      const snapshot = JSON.stringify(jobs);
      try {
        return await fn(client);
      } catch (e) {
        jobs.length = 0;
        jobs.push(...JSON.parse(snapshot));
        throw e;
      }
    }
  };

  return { client, jobs, notifications };
}

// ============================================================================
// CONCURRENCY & CLAIMING TESTS
// ============================================================================

test("Concurrency: Double claim on single job results in exactly one winner", async () => {
  const { client, jobs } = createFakeDb();
  await client.backgroundJob.create({
    data: { type: "test.job", payload: { x: 1 }, status: "QUEUED", scheduledAt: new Date(Date.now() - 1000) }
  });

  // Worker A and Worker B try to claim concurrently
  const [claimA, claimB] = await Promise.all([
    claimNextJob({ workerId: "worker-A" }, client),
    claimNextJob({ workerId: "worker-B" }, client)
  ]);

  const winner = claimA || claimB;
  const loser = claimA ? claimB : claimA;

  assert.ok(winner !== null, "One worker must claim the job");
  assert.equal(loser, null, "The other worker must receive null");
  assert.equal(jobs[0].status, "RUNNING");
  assert.equal(jobs[0].attempts, 1);
});

test("Concurrency: Multiple workers claim distinct jobs (SKIP LOCKED semantics)", async () => {
  const { client } = createFakeDb();
  await client.backgroundJob.create({ data: { type: "job.1", payload: {}, status: "QUEUED" } });
  await client.backgroundJob.create({ data: { type: "job.2", payload: {}, status: "QUEUED" } });
  await client.backgroundJob.create({ data: { type: "job.3", payload: {}, status: "QUEUED" } });

  const [claimA, claimB, claimC] = await Promise.all([
    claimNextJob({ workerId: "worker-A" }, client),
    claimNextJob({ workerId: "worker-B" }, client),
    claimNextJob({ workerId: "worker-C" }, client)
  ]);

  const claimedIds = new Set([claimA?.id, claimB?.id, claimC?.id]);
  assert.equal(claimedIds.size, 3, "Each worker must claim a distinct job");
});

test("Crash Recovery: Stale lease on RUNNING job is reclaimed", async () => {
  const { client, jobs } = createFakeDb();
  // Simulate a crashed worker who abandoned the job 10 minutes ago
  await client.backgroundJob.create({
    data: {
      type: "test.stale",
      payload: {},
      status: "RUNNING",
      attempts: 1,
      maxAttempts: 3,
      lockedBy: "worker-dead",
      lockedUntil: new Date(Date.now() - 600_000) // expired
    }
  });

  const reclaimed = await claimNextJob({ workerId: "worker-alive" }, client);
  assert.ok(reclaimed !== null, "Stale job must be reclaimed");
  assert.equal(reclaimed.id, jobs[0].id);
  assert.equal(jobs[0].lockedBy, "worker-alive");
  assert.equal(jobs[0].attempts, 2, "Attempts must be incremented upon recovery");
});

test("Crash Recovery Boundary: Stale RUNNING job at maxAttempts transitions to FAILED", async () => {
  const { client, jobs } = createFakeDb();
  // Simulate a job that crashed on its FINAL attempt
  await client.backgroundJob.create({
    data: {
      type: "test.fatal",
      payload: {},
      status: "RUNNING",
      attempts: 3,
      maxAttempts: 3,
      lockedBy: "worker-crashed",
      lockedUntil: new Date(Date.now() - 600_000) // expired
    }
  });

  const next = await claimNextJob({ workerId: "worker-alive" }, client);
  assert.equal(next, null, "Should not return job to queue");
  assert.equal(jobs[0].status, "FAILED", "Job must be marked FAILED permanently");
  assert.match(jobs[0].lastError, /maxAttempts/, "Error must state maxAttempts exceeded");
});

test("Lease Fencing: Stale worker cannot renew lease after reclamation", async () => {
  const { client, jobs } = createFakeDb();
  const job = await client.backgroundJob.create({
    data: {
      type: "test.fence",
      payload: {},
      status: "RUNNING",
      lockedBy: "worker-original",
      lockedUntil: new Date(Date.now() - 1000) // expired
    }
  });

  // Worker B reclaims it
  await claimNextJob({ workerId: "worker-replacement" }, client);
  assert.equal(jobs[0].lockedBy, "worker-replacement");

  // Worker A attempts to extend its old lease
  const renewed = await renewJobLease(job.id, "worker-original", 60_000, client);
  assert.equal(renewed, false, "Stale worker lease renewal must be rejected");
  assert.equal(jobs[0].lockedBy, "worker-replacement", "Replacement worker must remain owner");
});

// ============================================================================
// TRANSACTIONAL ENQUEUE & IDEMPOTENCY
// ============================================================================

test("Transactional Enqueue: Enqueued job rolls back if outer transaction fails", async () => {
  const { client, jobs } = createFakeDb();

  await assert.rejects(
    async () => {
      await client.$transaction(async (tx: any) => {
        await enqueueJob(tx, {
          type: "test.rollback",
          payload: { foo: "bar" }
        });
        throw new Error("Simulated business transaction failure");
      });
    },
    /Simulated business transaction failure/
  );

  assert.equal(jobs.length, 0, "No background job must persist after transaction rollback");
});

test("Transactional Enqueue: Enqueued job persists if outer transaction commits", async () => {
  const { client, jobs } = createFakeDb();

  await client.$transaction(async (tx: any) => {
    await enqueueJob(tx, {
      type: "test.commit",
      payload: { foo: "bar" }
    });
  });

  assert.equal(jobs.length, 1, "Background job must persist after successful transaction commit");
  assert.equal(jobs[0].status, "QUEUED");
});

test("Idempotency Race: Concurrent enqueues with same idempotencyKey produce one job", async () => {
  const { client, jobs } = createFakeDb();
  const idempotencyKey = "unique-key-12345";

  const [job1, job2] = await Promise.all([
    enqueueJob(client, { type: "test.idempotent", payload: { val: 1 }, idempotencyKey }),
    enqueueJob(client, { type: "test.idempotent", payload: { val: 1 }, idempotencyKey })
  ]);

  assert.equal(jobs.length, 1, "Exactly one job must be created");
  assert.equal(job1.id, job2.id, "Both callers must receive the exact same job ID");
});

// ============================================================================
// NOTIFICATIONS DEDUP & TEAM SCOPE SECURITY
// ============================================================================

test("Notification Dedup: Concurrent identical dispatches produce exactly one notification", async () => {
  const { client, notifications } = createFakeDb();

  await Promise.all([
    dispatchNotification(client, {
      type: "CONTRACT_EXPIRING",
      title: "Contract Expiring",
      teamId: "team-u15",
      requiredPermission: "contracts.view",
      dedupKey: "contract:c1:expiring:30d"
    }),
    dispatchNotification(client, {
      type: "CONTRACT_EXPIRING",
      title: "Contract Expiring",
      teamId: "team-u15",
      requiredPermission: "contracts.view",
      dedupKey: "contract:c1:expiring:30d"
    })
  ]);

  // Coach U15 and Super Admin receive it, but neither gets duplicate rows
  const coachNotifs = notifications.filter((n) => n.userId === "u-coach-u15");
  const adminNotifs = notifications.filter((n) => n.userId === "u-admin");

  assert.equal(coachNotifs.length, 1, "Coach U15 must have exactly 1 notification");
  assert.equal(adminNotifs.length, 1, "Super Admin must have exactly 1 notification");
});

test("Notification Team Scope: Coach U15 does NOT receive U20 notification", async () => {
  const { client, notifications } = createFakeDb();

  await dispatchNotification(client, {
    type: "PLAYER_MISSING_DOCUMENTS",
    title: "Missing docs for U20 Player",
    teamId: "team-u20",
    requiredPermission: "players.view",
    dedupKey: "player:p-u20:missing"
  });

  const coachU15 = notifications.find((n) => n.userId === "u-coach-u15");
  const coachU20 = notifications.find((n) => n.userId === "u-coach-u20");
  const admin = notifications.find((n) => n.userId === "u-admin");

  assert.equal(coachU15, undefined, "Coach U15 must NOT receive U20 notification");
  assert.ok(coachU20 !== undefined, "Coach U20 must receive U20 notification");
  assert.ok(admin !== undefined, "Unrestricted admin must receive U20 notification");
});

test("Notification Club-Wide Scope: Restricted coaches do NOT receive club-wide alerts", async () => {
  const { client, notifications } = createFakeDb();

  await dispatchNotification(client, {
    type: "BUDGET_EXCEEDED",
    title: "Club Budget Exceeded",
    teamId: null, // Club-wide
    requiredPermission: "*",
    dedupKey: "budget:2026:exceeded"
  });

  const coachU15 = notifications.find((n) => n.userId === "u-coach-u15");
  const admin = notifications.find((n) => n.userId === "u-admin");

  assert.equal(coachU15, undefined, "Restricted coach must NOT receive club-wide notification");
  assert.ok(admin !== undefined, "Unrestricted admin must receive club-wide notification");
});

// ============================================================================
// CRON ROUTE SECURITY
// ============================================================================

test("Cron Security: Rejects unauthorized requests without CRON_SECRET", async () => {
  const prevSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "super-secret-cron-token";

  try {
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", { method: "POST" });
    const res1 = await cronHandler(unauthReq);
    assert.equal(res1.status, 401);

    const wrongReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", {
      method: "POST",
      headers: { "x-cron-secret": "wrong-token" }
    });
    const res2 = await cronHandler(wrongReq);
    assert.equal(res2.status, 401);

    const wrongBearer = new NextRequest("http://localhost:3000/api/cron/process-jobs", {
      method: "POST",
      headers: { authorization: "Bearer invalid-token" }
    });
    const res3 = await cronHandler(wrongBearer);
    assert.equal(res3.status, 401);

    // In production, missing CRON_SECRET fails closed
    delete process.env.CRON_SECRET;
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    try {
      const prodReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", { method: "POST" });
      const res4 = await cronHandler(prodReq);
      assert.equal(res4.status, 500);
      const data = await res4.json();
      assert.equal(data.error, "CRON_SECRET is not configured on this server");
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
    }
  } finally {
    process.env.CRON_SECRET = prevSecret;
  }
});
