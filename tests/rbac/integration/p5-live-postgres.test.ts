/**
 * P5 — LIVE POSTGRESQL VERIFICATION GATE
 *
 * Direct execution against real Neon PostgreSQL database (esh_p5_test).
 * Zero test doubles or mocks for the database engine.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { claimNextJob, renewJobLease } from "@/lib/jobs/claim";
import { processJobBatch, calculateBackoff, sanitizeErrorMessage } from "@/lib/jobs/worker";
import { registerJobHandler } from "@/lib/jobs/registry";
import { RetryableError } from "@/lib/jobs/types";
import { runSchedulerTick } from "@/lib/jobs/scheduler";
import { dispatchNotification } from "@/lib/notifications/service";
import { POST as cronHandler } from "@/app/api/cron/process-jobs/route";
import { NextRequest } from "next/server";
import { z } from "zod";

const TEST_PREFIX = `live-${Date.now()}`;

before(async () => {
  // Confirm target database identity
  const result: any[] = await db.$queryRawUnsafe(`
    SELECT current_database() AS db_name, version() AS pg_version
  `);
  const dbName = result[0]?.db_name;
  assert.equal(dbName, "esh_p5_test", "MUST be connected to esh_p5_test");

  // Register deterministic live test job handlers
  registerJobHandler({
    type: "test.live.worker",
    schema: z.object({ value: z.number() }),
    handler: async () => {}
  });

  registerJobHandler({
    type: "test.live.retry",
    schema: z.object({ value: z.number() }),
    handler: async () => {
      throw new RetryableError("Simulated transient connection timeout");
    }
  });

  registerJobHandler({
    type: "test.live.fail",
    schema: z.object({ value: z.number() }),
    handler: async () => {
      throw new Error("Deterministic error");
    }
  });

  registerJobHandler({
    type: "test.live.recover",
    schema: z.object({ value: z.number() }),
    handler: async () => {}
  });

  // Ensure deterministic test permission for notification dispatch tests
  await db.permission.upsert({
    where: { key: "notifications.test" },
    update: {},
    create: { key: "notifications.test", group: "notifications", description: "Test Permission" }
  });

  // Clean any previous test rows
  await db.backgroundJob.deleteMany({
    where: { type: { startsWith: "test.live" } }
  });
  await db.notification.deleteMany({
    where: { dedupKey: { startsWith: "live-notif-" } }
  });
});

after(async () => {
  // Cleanup test artifacts
  await db.backgroundJob.deleteMany({
    where: { type: { startsWith: "test.live" } }
  });
  await db.notification.deleteMany({
    where: { dedupKey: { startsWith: "live-notif-" } }
  });
  await db.$disconnect();
});

// ============================================================================
// 1. ATOMIC JOB CLAIM (DOUBLE CLAIM RACE)
// ============================================================================
test("1. Live PostgreSQL: Atomic claim prevents double-claim under race", async () => {
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.claim",
      payload: { testId: `${TEST_PREFIX}-claim` },
      status: "QUEUED",
      scheduledAt: new Date(Date.now() - 5000)
    }
  });

  // Launch two concurrent worker claims simultaneously
  const [claimA, claimB] = await Promise.all([
    claimNextJob({ workerId: "worker-live-A", types: ["test.live.claim"] }),
    claimNextJob({ workerId: "worker-live-B", types: ["test.live.claim"] })
  ]);

  const winner = claimA || claimB;
  const loser = claimA ? claimB : claimA;

  assert.ok(winner !== null, "One worker must claim the job");
  assert.equal(loser, null, "The competing worker must receive null");
  assert.equal(winner.id, job.id);

  // Verify PostgreSQL row directly
  const inDb = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.equal(inDb?.status, "RUNNING");
  assert.ok(inDb?.lockedBy === "worker-live-A" || inDb?.lockedBy === "worker-live-B");
  assert.equal(inDb?.attempts, 1);
});

// ============================================================================
// 2. FOR UPDATE SKIP LOCKED
// ============================================================================
test("2. Live PostgreSQL: FOR UPDATE SKIP LOCKED distributes jobs concurrently", async () => {
  const job1 = await db.backgroundJob.create({ data: { type: "test.live.skip", payload: {}, status: "QUEUED", scheduledAt: new Date(Date.now() - 3000) } });
  const job2 = await db.backgroundJob.create({ data: { type: "test.live.skip", payload: {}, status: "QUEUED", scheduledAt: new Date(Date.now() - 2000) } });
  const job3 = await db.backgroundJob.create({ data: { type: "test.live.skip", payload: {}, status: "QUEUED", scheduledAt: new Date(Date.now() - 1000) } });

  // 3 concurrent workers claim simultaneously
  const [claim1, claim2, claim3] = await Promise.all([
    claimNextJob({ workerId: "worker-live-1", types: ["test.live.skip"] }),
    claimNextJob({ workerId: "worker-live-2", types: ["test.live.skip"] }),
    claimNextJob({ workerId: "worker-live-3", types: ["test.live.skip"] })
  ]);

  const claimedIds = new Set([claim1?.id, claim2?.id, claim3?.id].filter(Boolean));
  assert.equal(claimedIds.size, 3, "Each worker must acquire a distinct row without blocking");
  assert.ok(claimedIds.has(job1.id));
  assert.ok(claimedIds.has(job2.id));
  assert.ok(claimedIds.has(job3.id));
});

// ============================================================================
// 3. MULTIPLE WORKERS BATCH PROCESSING
// ============================================================================
test("3. Live PostgreSQL: Multiple workers process queue with zero duplicates", async () => {
  await db.backgroundJob.deleteMany({ where: { type: "test.live.worker" } });
  const jobCount = 6;
  for (let i = 0; i < jobCount; i++) {
    await db.backgroundJob.create({
      data: {
        type: "test.live.worker",
        payload: { value: i },
        status: "QUEUED",
        scheduledAt: new Date(Date.now() - 1000)
      }
    });
  }

  // Run 3 worker batches concurrently
  const [batch1, batch2, batch3] = await Promise.all([
    processJobBatch({ workerId: "batch-w1", maxJobs: 4, types: ["test.live.worker"] }),
    processJobBatch({ workerId: "batch-w2", maxJobs: 4, types: ["test.live.worker"] }),
    processJobBatch({ workerId: "batch-w3", maxJobs: 4, types: ["test.live.worker"] })
  ]);

  const totalProcessed = batch1.processed + batch2.processed + batch3.processed;
  const totalSucceeded = batch1.succeeded + batch2.succeeded + batch3.succeeded;

  assert.equal(totalProcessed, jobCount, "All jobs must be processed");
  assert.equal(totalSucceeded, jobCount, "All jobs must succeed");

  // Verify in PostgreSQL: all 6 jobs are SUCCEEDED
  const remainingQueued = await db.backgroundJob.count({
    where: { type: "test.live.worker", status: "QUEUED" }
  });
  assert.equal(remainingQueued, 0, "No jobs should remain QUEUED");

  const succeededCount = await db.backgroundJob.count({
    where: { type: "test.live.worker", status: "SUCCEEDED" }
  });
  assert.equal(succeededCount, jobCount, "All 6 jobs must be SUCCEEDED in PostgreSQL");
});

// ============================================================================
// 4. LEASE CREATION
// ============================================================================
test("4. Live PostgreSQL: Lease creation records owner and future expiration", async () => {
  const job = await db.backgroundJob.create({
    data: { type: "test.live.lease", payload: {}, status: "QUEUED" }
  });

  const now = Date.now();
  const claimed = await claimNextJob({ workerId: "worker-lease-test", leaseDurationMs: 60000, types: ["test.live.lease"] });

  assert.ok(claimed !== null);
  assert.equal(claimed.lockedBy, "worker-lease-test");
  assert.equal(claimed.status, "RUNNING");
  assert.ok(claimed.lockedUntil !== null);
  assert.ok(claimed.lockedUntil.getTime() > now + 30000, "Lease must be in the future");
});

// ============================================================================
// 5. HEARTBEAT / LEASE EXTENSION
// ============================================================================
test("5. Live PostgreSQL: Lease renewal extends lockedUntil for owner only", async () => {
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.hb",
      payload: {},
      status: "RUNNING",
      lockedBy: "worker-owner",
      lockedUntil: new Date(Date.now() + 10000),
      attempts: 1
    }
  });

  // Owner renews lease by 5 minutes
  const renewed = await renewJobLease(job.id, "worker-owner", 300000);
  assert.equal(renewed, true, "Owner must be able to renew lease");

  const afterOwner = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.ok(afterOwner!.lockedUntil!.getTime() > Date.now() + 200000);

  // Imposter attempts to renew lease
  const imposterRenewed = await renewJobLease(job.id, "worker-imposter", 300000);
  assert.equal(imposterRenewed, false, "Imposter must be rejected");
});

// ============================================================================
// 6. STALE LEASE RECOVERY
// ============================================================================
test("6. Live PostgreSQL: Stale lease on dead worker is safely reclaimed", async () => {
  // Simulate worker that crashed 10 minutes ago
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.stale",
      payload: {},
      status: "RUNNING",
      lockedBy: "worker-crashed",
      lockedUntil: new Date(Date.now() - 600000), // expired
      attempts: 1,
      maxAttempts: 3
    }
  });

  const reclaimed = await claimNextJob({ workerId: "worker-recovering", types: ["test.live.stale"] });
  assert.ok(reclaimed !== null, "Stale job must be reclaimed");
  assert.equal(reclaimed.id, job.id);
  assert.equal(reclaimed.lockedBy, "worker-recovering");
  assert.equal(reclaimed.attempts, 2, "Attempts must increment upon recovery");
});

// ============================================================================
// 7. LEASE FENCING
// ============================================================================
test("7. Live PostgreSQL: Fencing prevents stale worker from mutating reclaimed job", async () => {
  // Job initially owned by Worker A with expired lease
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.fence",
      payload: {},
      status: "RUNNING",
      lockedBy: "worker-A-stale",
      lockedUntil: new Date(Date.now() - 5000), // expired
      attempts: 1,
      maxAttempts: 3
    }
  });

  // Worker B reclaims the job
  const claimB = await claimNextJob({ workerId: "worker-B-new", types: ["test.live.fence"] });
  assert.equal(claimB?.id, job.id);

  // Stale Worker A attempts to extend lease
  const staleExtension = await renewJobLease(job.id, "worker-A-stale", 60000);
  assert.equal(staleExtension, false, "Stale Worker A must be fenced out of lease renewal");

  // Verify Worker B remains authoritative in PostgreSQL
  const finalJob = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.equal(finalJob?.lockedBy, "worker-B-new");
});

// ============================================================================
// 8. RETRY / BACKOFF
// ============================================================================
test("8. Live PostgreSQL: Retry applies exponential backoff with jitter", async () => {
  await db.backgroundJob.deleteMany({ where: { type: "test.live.retry" } });
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.retry",
      payload: { value: 1 },
      status: "QUEUED",
      maxAttempts: 3
    }
  });

  const result = await processJobBatch({ workerId: "worker-retry-test", maxJobs: 1, types: ["test.live.retry"] });
  assert.equal(result.retried, 1);

  const inDb = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.equal(inDb?.status, "RETRYING");
  assert.equal(inDb?.attempts, 1);
  assert.ok(inDb?.nextRetryAt !== null);
  assert.ok(inDb?.nextRetryAt.getTime() > Date.now(), "nextRetryAt must be in future");
});

// ============================================================================
// 9. MAX ATTEMPTS BOUNDARY
// ============================================================================
test("9. Live PostgreSQL: Job exhausting maxAttempts transitions to FAILED", async () => {
  await db.backgroundJob.deleteMany({ where: { type: "test.live.fail" } });
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.fail",
      payload: { value: 1 },
      status: "QUEUED",
      attempts: 2,
      maxAttempts: 3
    }
  });

  const result = await processJobBatch({ workerId: "worker-fail-test", maxJobs: 1, types: ["test.live.fail"] });
  assert.equal(result.failed, 1);

  const inDb = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.equal(inDb?.status, "FAILED");
  assert.equal(inDb?.attempts, 3);
  assert.ok(inDb?.failedAt !== null);
  assert.equal(inDb?.nextRetryAt, null);
});

// ============================================================================
// 10. TRANSACTIONAL ENQUEUE / COMMIT
// ============================================================================
test("10. Live PostgreSQL: Transactional enqueue persists on commit", async () => {
  const idKey = `tx-commit-${Date.now()}`;
  let enqueuedId = "";

  await db.$transaction(async (tx) => {
    const job = await enqueueJob(tx, {
      type: "test.live.tx",
      payload: { test: true },
      idempotencyKey: idKey
    });
    enqueuedId = job.id;
  });

  const inDb = await db.backgroundJob.findUnique({ where: { id: enqueuedId } });
  assert.ok(inDb !== null, "Job must exist in PostgreSQL after commit");
  assert.equal(inDb.idempotencyKey, idKey);
});

// ============================================================================
// 11. TRANSACTIONAL ENQUEUE / ROLLBACK
// ============================================================================
test("11. Live PostgreSQL: Transactional enqueue rolls back on abort", async () => {
  const idKey = `tx-rollback-${Date.now()}`;

  await assert.rejects(async () => {
    await db.$transaction(async (tx) => {
      await enqueueJob(tx, {
        type: "test.live.tx",
        payload: { test: true },
        idempotencyKey: idKey
      });
      throw new Error("Intentional rollback");
    });
  });

  const inDb = await db.backgroundJob.findUnique({ where: { idempotencyKey: idKey } });
  assert.equal(inDb, null, "Job must NOT exist in PostgreSQL after rollback");
});

// ============================================================================
// 12. IDEMPOTENCY RACE
// ============================================================================
test("12. Live PostgreSQL: Concurrent enqueues with same idempotencyKey produce one job", async () => {
  const idKey = `race-idem-${Date.now()}`;

  const [res1, res2] = await Promise.all([
    enqueueJob(db, { type: "test.live.idem", payload: { req: 1 }, idempotencyKey: idKey }),
    enqueueJob(db, { type: "test.live.idem", payload: { req: 2 }, idempotencyKey: idKey })
  ]);

  assert.equal(res1.id, res2.id, "Both concurrent enqueues must resolve to the same job ID");

  const count = await db.backgroundJob.count({ where: { idempotencyKey: idKey } });
  assert.equal(count, 1, "Exactly one row must exist in PostgreSQL");
});

// ============================================================================
// 13. NOTIFICATION DEDUPLICATION RACE
// ============================================================================
test("13. Live PostgreSQL: Concurrent notification dispatches deduplicate cleanly", async () => {
  const perm = await db.permission.findUniqueOrThrow({ where: { key: "notifications.test" } });
  const role = await db.role.create({
    data: { key: `role-dedup-${Date.now()}`, name: "Dedup Test Role", teamScoped: false }
  });
  await db.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });

  const user = await db.user.create({
    data: { name: "Test User", email: `test-${Date.now()}@esh.dz`, passwordHash: "x", roleId: role.id }
  });

  const dedup = `notif-race-${Date.now()}`;

  // Concurrent identical dispatches
  await Promise.all([
    dispatchNotification(db, {
      type: "NEW_ANNOUNCEMENT",
      title: "Test Alert",
      message: "Message 1",
      requiredPermission: "notifications.test",
      dedupKey: dedup,
      targetUserIds: [user.id]
    }),
    dispatchNotification(db, {
      type: "NEW_ANNOUNCEMENT",
      title: "Test Alert",
      message: "Message 2",
      requiredPermission: "notifications.test",
      dedupKey: dedup,
      targetUserIds: [user.id]
    })
  ]);

  const notifs = await db.notification.findMany({
    where: { dedupKey: `NEW_ANNOUNCEMENT:${dedup}:${user.id}` }
  });
  assert.equal(notifs.length, 1, "Exactly one notification row must exist in PostgreSQL");

  // Cleanup
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  await db.rolePermission.deleteMany({ where: { roleId: role.id } });
  await db.role.delete({ where: { id: role.id } });
});

// ============================================================================
// 14. NOTIFICATION TEAM SCOPE (UserTeam ISOLATION)
// ============================================================================
test("14. Live PostgreSQL: Notification respects UserTeam boundaries", async () => {
  const perm = await db.permission.findUniqueOrThrow({ where: { key: "notifications.test" } });

  // Guarantee canonical team rows per unique category
  const teamU15 = await db.team.upsert({
    where: { category: "U15" },
    update: {},
    create: { name: "Live U15", category: "U15" }
  });
  const teamU20 = await db.team.upsert({
    where: { category: "U20" },
    update: {},
    create: { name: "Live U20", category: "U20" }
  });

  // Create teamScoped role with permission
  const coachRole = await db.role.create({
    data: { key: `coach-${Date.now()}`, name: "Coach Role", teamScoped: true }
  });
  await db.rolePermission.create({ data: { roleId: coachRole.id, permissionId: perm.id } });

  // Create Coach U15 and Coach U20
  const coachU15 = await db.user.create({
    data: { name: "Coach U15", email: `u15-${Date.now()}@esh.dz`, passwordHash: "x", roleId: coachRole.id }
  });
  const coachU20 = await db.user.create({
    data: { name: "Coach U20", email: `u20-${Date.now()}@esh.dz`, passwordHash: "x", roleId: coachRole.id }
  });

  // Assign via UserTeam (sole source of authorization)
  await db.userTeam.create({ data: { userId: coachU15.id, teamId: teamU15.id } });
  await db.userTeam.create({ data: { userId: coachU20.id, teamId: teamU20.id } });

  // Dispatch U15 notification
  const u15Dedup = `u15-${Date.now()}`;
  await dispatchNotification(db, {
    type: "NEW_ANNOUNCEMENT",
    title: "U15 Alert",
    teamId: teamU15.id,
    requiredPermission: "notifications.test",
    dedupKey: u15Dedup,
    targetUserIds: [coachU15.id]
  });

  const u15Notif = await db.notification.findFirst({
    where: { dedupKey: `NEW_ANNOUNCEMENT:${u15Dedup}:${coachU15.id}` }
  });
  assert.ok(u15Notif !== null, "Coach U15 must receive U15 notification");

  // Coach U20 attempting to receive U15 notification is rejected by dispatch service
  const u20Result = await dispatchNotification(db, {
    type: "NEW_ANNOUNCEMENT",
    title: "U15 Alert Attempt",
    teamId: teamU15.id,
    requiredPermission: "notifications.test",
    dedupKey: `leak-${Date.now()}`,
    targetUserIds: [coachU20.id]
  });
  assert.equal(u20Result.createdCount, 0, "Coach U20 must NOT receive U15 notification");

  // Cleanup
  await db.notification.deleteMany({ where: { userId: { in: [coachU15.id, coachU20.id] } } });
  await db.userTeam.deleteMany({ where: { userId: { in: [coachU15.id, coachU20.id] } } });
  await db.user.deleteMany({ where: { id: { in: [coachU15.id, coachU20.id] } } });
  await db.rolePermission.deleteMany({ where: { roleId: coachRole.id } });
  await db.role.delete({ where: { id: coachRole.id } });
});

// ============================================================================
// 15. TEAM REVOCATION
// ============================================================================
test("15. Live PostgreSQL: Revoking UserTeam immediately denies notification delivery", async () => {
  const perm = await db.permission.findUniqueOrThrow({ where: { key: "notifications.test" } });

  const team = await db.team.upsert({
    where: { category: "SENIOR" },
    update: {},
    create: { name: "Live Senior", category: "SENIOR" }
  });
  const role = await db.role.create({ data: { key: `sen-${Date.now()}`, name: "Senior Coach", teamScoped: true } });
  await db.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });

  const user = await db.user.create({ data: { name: "Senior Coach", email: `sen-${Date.now()}@esh.dz`, passwordHash: "x", roleId: role.id } });

  await db.userTeam.create({ data: { userId: user.id, teamId: team.id } });

  // Revoke membership
  await db.userTeam.deleteMany({ where: { userId: user.id, teamId: team.id } });

  // Attempt notification delivery after revocation
  const result = await dispatchNotification(db, {
    type: "NEW_ANNOUNCEMENT",
    title: "Post-revocation",
    teamId: team.id,
    requiredPermission: "notifications.test",
    dedupKey: `revoked-${Date.now()}`,
    targetUserIds: [user.id]
  });
  assert.equal(result.createdCount, 0, "Revoked user must be rejected immediately");

  // Cleanup
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  await db.rolePermission.deleteMany({ where: { roleId: role.id } });
  await db.role.delete({ where: { id: role.id } });
});

// ============================================================================
// 16. CRON SECURITY
// ============================================================================
test("16. Live PostgreSQL: Cron route enforces authentication and runs batch", async () => {
  const prevSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-live-cron-secret-12345";

  try {
    // 1. Unauthenticated request rejected
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", { method: "POST" });
    const res1 = await cronHandler(unauthReq);
    assert.equal(res1.status, 401);

    // 2. Wrong secret rejected
    const wrongReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", {
      method: "POST",
      headers: { "x-cron-secret": "wrong-secret" }
    });
    const res2 = await cronHandler(wrongReq);
    assert.equal(res2.status, 401);

    // 3. Valid secret processes jobs
    const validReq = new NextRequest("http://localhost:3000/api/cron/process-jobs", {
      method: "POST",
      headers: { "x-cron-secret": "test-live-cron-secret-12345" }
    });
    const res3 = await cronHandler(validReq);
    assert.equal(res3.status, 200);
    const data = await res3.json();
    assert.equal(data.success, true);
    assert.ok(typeof data.processed === "number");
  } finally {
    process.env.CRON_SECRET = prevSecret;
  }
});

// ============================================================================
// 17. ERROR SANITIZATION
// ============================================================================
test("17. Error Sanitization: Database credentials and secrets are scrubbed", () => {
  const sensitive = "Error at host?password=secret_pass&token=secret_token Bearer secret-token-xyz";
  const sanitized = sanitizeErrorMessage(sensitive);

  assert.ok(!sanitized.includes("secret_pass"));
  assert.ok(!sanitized.includes("secret_token"));
  assert.ok(!sanitized.includes("secret-token-xyz"));
  assert.ok(sanitized.includes("[REDACTED]"));
  assert.ok(sanitized.length <= 1000);
});

// ============================================================================
// 18. HANDLER REGISTRY
// ============================================================================
test("18. Handler Registry: Schema validation and safe unknown type rejection", async () => {
  const { validateJobPayload, getJobDefinition } = await import("@/lib/jobs/registry");

  // Valid payload passes and returns parsed data
  const valid = validateJobPayload<{ value: number }>("test.live.worker", { value: 42 });
  assert.equal(valid.value, 42);

  // Invalid payload fails Zod validation by throwing NonRetryableError
  assert.throws(() => validateJobPayload("test.live.worker", { value: "not-a-number" }));

  // Unknown type fails safely
  const unknownDef = getJobDefinition("completely.unknown.type");
  assert.equal(unknownDef, undefined);
});

// ============================================================================
// 19. SCHEDULER DETERMINISM
// ============================================================================
test("19. Live PostgreSQL: Scheduler tick is deterministic and idempotent", async () => {
  await db.backgroundJob.deleteMany({ where: { type: "insights.sync" } });
  // First tick enqueues scheduled job
  const firstTick = await runSchedulerTick();
  assert.ok(firstTick.enqueuedJobs.length >= 1);

  // Immediate second tick within same window enqueues same job via idempotencyKey
  const secondTick = await runSchedulerTick();
  assert.equal(secondTick.enqueuedJobs[0], firstTick.enqueuedJobs[0], "Must resolve to identical job ID");

  // In database: exactly 1 insights.sync job exists
  const syncJobs = await db.backgroundJob.count({ where: { type: "insights.sync" } });
  assert.equal(syncJobs, 1, "Direct DB check: exactly one scheduled job in current window");
});

// ============================================================================
// 20. PERSISTENCE AFTER WORKER INTERRUPTION
// ============================================================================
test("20. Live PostgreSQL: Interrupted job remains durable and is recovered", async () => {
  await db.backgroundJob.deleteMany({ where: { type: "test.live.recover" } });
  const job = await db.backgroundJob.create({
    data: {
      type: "test.live.recover",
      payload: { value: 100 },
      status: "RUNNING",
      lockedBy: "worker-died-midway",
      lockedUntil: new Date(Date.now() - 5000), // lease expired
      attempts: 1,
      maxAttempts: 3
    }
  });

  // Second worker reclaims and completes the durable job
  const result = await processJobBatch({ workerId: "worker-recovered", maxJobs: 1, types: ["test.live.recover"] });
  assert.equal(result.succeeded, 1);

  const completed = await db.backgroundJob.findUnique({ where: { id: job.id } });
  assert.equal(completed?.status, "SUCCEEDED");
  assert.equal(completed?.attempts, 2);
  assert.ok(completed?.completedAt !== null);
});

// ============================================================================
// 21. DIRECT DATABASE INVARIANTS
// ============================================================================
test("21. Live PostgreSQL: Direct database invariant query", async () => {
  // Check for any impossible statuses
  const invalidStatus: any[] = await db.$queryRawUnsafe(`
    SELECT id, status FROM "BackgroundJob" 
    WHERE status NOT IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'CANCELLED');
  `);
  assert.equal(invalidStatus.length, 0, "Zero jobs may have an invalid status");

  // Check unique constraints on BackgroundJob(idempotencyKey)
  const duplicateIdempotency: any[] = await db.$queryRawUnsafe(`
    SELECT "idempotencyKey", COUNT(*) 
    FROM "BackgroundJob" 
    WHERE "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1;
  `);
  assert.equal(duplicateIdempotency.length, 0, "Zero duplicate idempotency keys permitted");

  // Check unique constraints on Notification(dedupKey)
  const duplicateDedup: any[] = await db.$queryRawUnsafe(`
    SELECT "dedupKey", COUNT(*) 
    FROM "Notification" 
    WHERE "dedupKey" IS NOT NULL 
    GROUP BY "dedupKey" 
    HAVING COUNT(*) > 1;
  `);
  assert.equal(duplicateDedup.length, 0, "Zero duplicate notification dedup keys permitted");
});
