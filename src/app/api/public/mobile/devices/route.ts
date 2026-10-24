import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenSchema = z.string().min(80).max(512).regex(/^[A-Za-z0-9_:-]+$/);
const registerSchema = z.object({ fcmToken: tokenSchema, locale: z.enum(["ar", "fr"]) });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  await db.publicAppDevice.upsert({
    where: { fcmToken: parsed.data.fcmToken },
    create: parsed.data,
    update: { locale: parsed.data.locale }
  });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ fcmToken: tokenSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  await db.publicAppDevice.deleteMany({ where: { fcmToken: parsed.data.fcmToken } });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
