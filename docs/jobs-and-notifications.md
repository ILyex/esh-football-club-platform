# Background Jobs & Notifications Infrastructure (P5)

## Overview

The ESH Football Club Platform utilizes a durable, transactional, PostgreSQL-backed background job processing and notification engine. It requires zero external queue brokers (no Redis or SaaS services) and provides transactional guarantees, atomic job claiming, fenced lease recovery, and strict team-scoped notification delivery.

---

## 1. Background Jobs Architecture

### Transactional Enqueue (Transactional Outbox)
Jobs are enqueued using `enqueueJob(client, input)`. When passed an active transaction client (`tx` from `db.$transaction`), the job commits or rolls back atomically with the business mutation:

```ts
import { enqueueJob } from "@/lib/jobs/queue";

await db.$transaction(async (tx) => {
  // 1. Business mutation
  const match = await tx.match.create({ ... });

  // 2. Enqueue background task atomically
  await enqueueJob(tx, {
    type: "notification.dispatch",
    payload: { matchId: match.id, ... },
    idempotencyKey: `match-created:${match.id}`
  });
});
```

### Handler Registry
All executable job types are declared in `src/lib/jobs/registry.ts`. Dynamic module imports and `eval` are strictly prohibited. Every handler registers a runtime Zod schema for payload validation:

```ts
registerJobHandler({
  type: "insights.sync",
  schema: z.object({ triggerSource: z.string().optional() }),
  defaultPriority: "DEFAULT",
  defaultMaxAttempts: 3,
  handler: async (payload, context) => {
    // Execution logic
  }
});
```

### State Machine & Transitions

```text
       [QUEUED] ───────────────► [CANCELLED]
          │
     Atomic Claim
          ▼
       [RUNNING] ─────────────► [SUCCEEDED]
       │       │
    Retry   Non-Retryable / Max Attempts
       ▼       ▼
  [RETRYING] [FAILED]
```

### Atomic Claim & Crash Recovery
- **Atomic Claiming**: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` (with conditional optimistic locking fallback) to prevent competing workers from double-processing tasks.
- **Crash Recovery**: If a worker crashes, its lease (`lockedUntil`) expires. The claim engine detects abandoned `RUNNING` tasks and reclaims them.
- **Max Attempts Guard**: If a crashed task has already reached `maxAttempts`, it is automatically transitioned to `FAILED` instead of being retried infinitely.
- **Fenced Lease Renewal**: A worker can extend its lease via `context.renewLease()`. Stale workers whose lease has expired cannot renew or overwrite reclaimed jobs.

---

## 2. Notification Security & Scoping

Notifications are dispatched via `dispatchNotification(db, options)` in `src/lib/notifications/service.ts`:

1. **Permission Check**: Verifies that the recipient holds the required functional permission (e.g. `contracts.view`).
2. **Team Scope Enforcement**:
   - If `teamId` is present, restricted users receive the alert **only if** `teamId` is in their authoritative `UserTeam` scope.
   - `StaffTeam` is operational only and is never used for authorization.
   - Restricted users assigned to Team A never receive notifications for Team B.
   - Unrestricted users and Super Admins receive both team-specific and club-wide alerts.
3. **Database Deduplication**:
   - Enforces unique `dedupKey: `${dedupKey}:${userId}`` with `upsert` semantics to eliminate duplicate notifications across job retries and concurrent runs.
4. **Safe Routing**:
   - Notification links are validated to ensure they only reference internal `/dashboard/...` routes, preventing open redirects.
5. **Decoupled Dashboard**:
   - `syncNotifications()` runs strictly in the background via scheduled background jobs, eliminating blocking computation during dashboard page rendering.

---

## 3. Worker Runtime & Execution

### Option A: HTTP Cron Trigger
Hit `/api/cron/process-jobs` via any HTTP scheduler (e.g. systemd timer, Vercel Cron, GitHub Actions):
```bash
curl -X POST https://your-domain.com/api/cron/process-jobs \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Option B: Standalone Daemon CLI
For dedicated VPS or containerized environments (Docker):
```bash
npx tsx scripts/worker.ts
```
The daemon runs continuously with graceful shutdown on `SIGINT` / `SIGTERM`.
