import { NextResponse } from "next/server";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { generatePublicStorageKey, uploadPublicFile, validateUploadedImage } from "@/lib/storage";
import { saveOpponentClub } from "@/lib/opponents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "matches.create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  const opponent = String(form?.get("opponent") ?? "").trim();
  const opponentNameFr = String(form?.get("opponentNameFr") ?? "").trim();
  const stadium = String(form?.get("stadium") ?? "").trim();
  if (!opponent || opponent.length > 120) return NextResponse.json({ error: "invalid_opponent" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "image_required" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "image_too_large" }, { status: 413 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("opponents", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });
    await saveOpponentClub(opponent, url, stadium || undefined, opponentNameFr ? [opponentNameFr] : []);
    return NextResponse.json({ url }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MobileOpponentLogo] Upload failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
}
