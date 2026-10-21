import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { processJobBatch } from "@/lib/jobs/worker";

/**
 * Gives the dashboard a reliable recovery path on Vercel Hobby, where a
 * sub-daily cron cannot be configured. The queue remains durable and the
 * worker claim is atomic, so concurrent dashboard visits are safe.
 */
export async function POST() {
  try {
    await requirePermission("teams.view");
    const result = await processJobBatch({ maxJobs: 1, types: ["team.insurance_check"] });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[TeamInsurance] Dashboard queue recovery failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
