import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { importUpcomingFafMatches } from "@/lib/integrations/faf/scheduled-match-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !provided) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (providedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(providedBytes, expectedBytes)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await importUpcomingFafMatches({ lookAheadDays: 14 });
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("[FAF weekly schedule import] Import failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "FAF schedule import failed" }, { status: 502 });
  }
}
