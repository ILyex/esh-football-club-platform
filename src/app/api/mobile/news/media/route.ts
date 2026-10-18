import { NextResponse } from "next/server";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { generatePublicStorageKey, uploadPublicFile, validateUploadedImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NATIVE_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "news.create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "image_required" }, { status: 400 });
  if (file.size > MAX_NATIVE_IMAGE_BYTES) return NextResponse.json({ error: "image_too_large" }, { status: 413 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("news", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error("[MobileNewsMedia] Upload failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
}
