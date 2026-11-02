import crypto from "crypto";
import { NextRequest } from "next/server";
import { runSchedulerTick } from "@/lib/jobs/scheduler";
import { processJobBatch } from "@/lib/jobs/worker";
import { flushPendingMatchPushOutbox } from "@/lib/push/match-push";

// ============================================================================
// P5 — CRON TRIGGER & BATCH PROCESSING ROUTE
// ----------------------------------------------------------------------------
// Secret-protected entry point for external schedulers (Vercel Cron, GitHub
// Actions, systemd timers, Cloudflare cron, ...).
//
// 1. Authenticates the request (CRON_SECRET via Authorization: Bearer or
//    x-cron-secret — Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
// 2. Runs the deterministic scheduler tick to enqueue due periodic jobs.
// 3. Claims and processes a batch of available jobs using the worker engine.
// 4. Returns high-level operational counts without leaking payloads or errors.
//
// GET is supported because Vercel Cron issues GET requests; POST stays for
// GitHub Actions / manual calls.
// ============================================================================

function isAuthorized(req: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "CRON_SECRET is not configured on this server" }, { status: 500 });
    }
    return null;
  }
  const authHeader = req.headers.get("authorization");
  const secretHeader = req.headers.get("x-cron-secret");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = secretHeader ?? bearer;
  if (!provided) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(cronSecret, "utf8");
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function runProcessJobs() {
  const queuedMatchPushes = await flushPendingMatchPushOutbox(20);

  // 1. Enqueue due recurring jobs
  await runSchedulerTick();

  // 2. Process a batch of pending jobs
  const configuredMaxJobs = Number.parseInt(process.env.CRON_MAX_JOBS ?? "5", 10);
  const maxJobs = Number.isInteger(configuredMaxJobs) && configuredMaxJobs >= 1
    ? Math.min(configuredMaxJobs, 15)
    : 5;
  const batchResult = await processJobBatch({ maxJobs });

  return Response.json({
    success: true,
    processed: batchResult.processed,
    succeeded: batchResult.succeeded,
    failed: batchResult.failed,
    retried: batchResult.retried,
    queuedMatchPushes
  });
}

export async function GET(req: NextRequest) {
  const unauthorized = isAuthorized(req);
  if (unauthorized) return unauthorized;
  try {
    return await runProcessJobs();
  } catch (error) {
    console.error("[Cron process-jobs] Error during batch processing:", error);
    return Response.json({ error: "Job processing encountered an internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = isAuthorized(req);
  if (unauthorized) return unauthorized;
  try {
    return await runProcessJobs();
  } catch (error) {
    console.error("[Cron process-jobs] Error during batch processing:", error);
    return Response.json({ error: "Job processing encountered an internal error" }, { status: 500 });
  }
}
