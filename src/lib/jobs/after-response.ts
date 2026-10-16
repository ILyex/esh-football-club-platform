import "server-only";
import { after } from "next/server";
import "./registry-init";
import { processJobBatch } from "./worker";

/**
 * Gives a newly queued task an immediate processing opportunity on serverless
 * platforms. The durable DB queue remains the source of truth; the scheduled
 * worker can still recover work if the request runtime is interrupted.
 */
export function processQueuedJobAfterResponse(type: string): void {
  after(async () => {
    try {
      await processJobBatch({ maxJobs: 1, types: [type] });
    } catch {
      // Keep sensitive document content and provider details out of logs.
      console.error("[BackgroundJob] After-response processing failed");
    }
  });
}
