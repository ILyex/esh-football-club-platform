import { NextResponse } from "next/server";
import { getNativePrincipal } from "@/lib/native-session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove one inbox notification, scoped to the authenticated mobile user. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 120) return NextResponse.json({ error: "invalid_notification" }, { status: 400 });

  // Deletion is intentionally idempotent. A refresh, retry, or another device
  // may have removed the row already; the mobile client must still persist its
  // local tombstone instead of treating that perfectly valid state as an error.
  const result = await db.notification.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ success: true, deleted: result.count }, { headers: { "Cache-Control": "no-store" } });
}
