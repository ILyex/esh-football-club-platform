import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deviceSchema = z.object({
  fcmToken: z.string().min(80).max(4096).regex(/^[A-Za-z0-9_:-]+$/),
  locale: z.enum(["ar", "fr"])
});

export async function POST(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
  const parsed = deviceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  await db.nativePushDevice.upsert({
    where: { fcmToken: parsed.data.fcmToken },
    create: { ...parsed.data, userId: user.id },
    update: { locale: parsed.data.locale, userId: user.id }
  });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ fcmToken: z.string().min(80).max(4096).regex(/^[A-Za-z0-9_:-]+$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  await db.nativePushDevice.deleteMany({ where: { userId: user.id, fcmToken: parsed.data.fcmToken } });
  return new Response(null, { status: 204 });
}
