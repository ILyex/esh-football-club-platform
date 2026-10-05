import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { isLocalStorageMode, getPrivateFileBuffer } from "@/lib/storage";
import { verifyLocalDownloadSignature } from "@/lib/storage-signing";

export async function GET(req: NextRequest) {
  if (!isLocalStorageMode()) {
    return NextResponse.json({ error: "Local storage download is not enabled." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const expires = searchParams.get("expires");
  const sig = searchParams.get("sig");

  if (!key || !expires || !sig) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const expiresNum = /^\d{13}$/.test(expires) ? Number(expires) : NaN;
  if (!Number.isSafeInteger(expiresNum) || Date.now() > expiresNum || expiresNum > Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "Download link has expired" }, { status: 403 });
  }

  const inline = searchParams.get("inline") === "true";
  let signatureValid = false;
  try {
    signatureValid = verifyLocalDownloadSignature(key, expiresNum, inline, sig);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const buffer = await getPrivateFileBuffer(key);
    const filename = path.basename(key);
    const lowerKey = key.toLowerCase();
    const mimeType = lowerKey.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : lowerKey.endsWith(".pdf")
      ? "application/pdf"
      : lowerKey.endsWith(".png")
      ? "image/png"
      : lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")
      ? "image/jpeg"
      : lowerKey.endsWith(".webp")
      ? "image/webp"
      : "application/octet-stream";

    const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_");
    const disposition = `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
