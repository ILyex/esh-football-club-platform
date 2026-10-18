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

  const result = await db.notification.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return NextResponse.json({ error: "notification_not_found" }, { status: 404 });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
