import crypto from "crypto";
import { NextRequest } from "next/server";
import { runSchedulerTick } from "@/lib/jobs/scheduler";
import { processJobBatch } from "@/lib/jobs/worker";

// ============================================================================
// P5 — CRON TRIGGER & BATCH PROCESSING ROUTE
// ----------------------------------------------------------------------------
// Secret-protected entry point for external schedulers (e.g. Vercel Cron,
// GitHub Actions, systemd timers, or cloud schedulers).
//
// 1. Authenticates request via CRON_SECRET header.
// 2. Runs the deterministic scheduler tick to enqueue due periodic jobs.
// 3. Claims and processes a batch of available jobs using the unified worker engine.
// 4. Returns high-level operational counts without leaking job payloads or errors.
// ============================================================================

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed authorization: enforce CRON_SECRET if configured
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const secretHeader = req.headers.get("x-cron-secret");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const provided = secretHeader ?? bearer;

    if (!provided) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providedBuf = Buffer.from(provided, "utf8");
    const expectedBuf = Buffer.from(cronSecret, "utf8");

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // In production, CRON_SECRET is strictly required
    return Response.json({ error: "CRON_SECRET is not configured on this server" }, { status: 500 });
  }

  try {
    // 1. Enqueue due recurring jobs
    await runSchedulerTick();

    // 2. Process batch of pending jobs
    const batchResult = await processJobBatch({ maxJobs: 15 });

    return Response.json({
      success: true,
      processed: batchResult.processed,
      succeeded: batchResult.succeeded,
      failed: batchResult.failed,
      retried: batchResult.retried
    });
  } catch (error) {
    console.error("[Cron process-jobs] Error during batch processing:", error);
    return Response.json({ error: "Job processing encountered an internal error" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
