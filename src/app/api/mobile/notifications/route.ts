import { NextResponse } from "next/server";
import { getNativePrincipal } from "@/lib/native-session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_NOTIFICATION_TYPES = ["UPCOMING_MATCH", "UPCOMING_TRAINING", "NEW_ANNOUNCEMENT"] as const;

/** Remove app-specific inbox notifications without touching platform alerts. */
export async function DELETE(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await db.notification.deleteMany({ where: { userId: user.id, type: { in: [...APP_NOTIFICATION_TYPES] } } });
  return NextResponse.json({ success: true, deleted: result.count }, { headers: { "Cache-Control": "no-store" } });
}
