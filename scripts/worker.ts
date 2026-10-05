#!/usr/bin/env tsx
import { startWorkerDaemon } from "../src/lib/jobs/worker";
import { runSchedulerTick } from "../src/lib/jobs/scheduler";
import "../src/lib/jobs/registry-init";

// ============================================================================
// P5 — STANDALONE BACKGROUND WORKER DAEMON
// ----------------------------------------------------------------------------
// Run with: npx tsx scripts/worker.ts
//
// Continuously claims and processes background jobs with atomic row locking,
// heartbeat lease management, and graceful shutdown on SIGINT/SIGTERM.
// Periodic scheduler ticks run every 5 minutes.
// ============================================================================

async function main() {
  console.log("=== Starting ESH Football Club Background Worker Daemon ===");

  // Run initial scheduler tick on startup
  await runSchedulerTick().catch((err) => console.error("Initial scheduler tick failed:", err));

  // Periodic scheduler timer
  const schedulerInterval = setInterval(() => {
    runSchedulerTick().catch((err) => console.error("Scheduler tick failed:", err));
  }, 5 * 60 * 1000); // every 5 minutes

  process.on("SIGINT", () => clearInterval(schedulerInterval));
  process.on("SIGTERM", () => clearInterval(schedulerInterval));

  // Start polling daemon
  await startWorkerDaemon({
    pollIntervalMs: 2500,
    concurrency: 5
  });
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
