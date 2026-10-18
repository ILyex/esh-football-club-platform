import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getLocalPublicFilePath, getPublicFileObject, isDatabaseStorageMode, isLocalStorageMode, isPublicStorageConfigured } from "@/lib/storage";

const publicAssetCacheHeaders = {
  // Public storage keys are random/versioned on upload, so immutable CDN
  // caching is safe and avoids reading the same bytes from DB/S3 per visitor.
  "Cache-Control": "public, max-age=31536000, immutable",
  "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400"
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  try {
    const ext = path.extname(key).toLowerCase();
    const ALLOWED_EXTS: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime"
    };
    const mimeType = ALLOWED_EXTS[ext];
    if (!mimeType) {
      return NextResponse.json({ error: "Access denied: unapproved public file type" }, { status: 403 });
    }

    if (isPublicStorageConfigured() || isDatabaseStorageMode()) {
      const rangeHeader = req.headers.get("range");
      const object = await getPublicFileObject(key, mimeType.startsWith("video/") ? rangeHeader : null);
      const partial = Boolean(object.contentRange);
      return new Response(new Uint8Array(object.body), {
        status: partial ? 206 : 200,
        headers: {
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
          ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
          "Content-Length": String(object.contentLength ?? object.body.byteLength),
          ...publicAssetCacheHeaders,
          "Content-Disposition": "inline"
        }
      });
    }
    if (!isLocalStorageMode()) {
      return NextResponse.json({ error: "Public storage is not configured" }, { status: 503 });
    }

    const filePath = getLocalPublicFilePath(key);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const rangeHeader = req.headers.get("range");

    // Smooth video streaming support via HTTP 206 Partial Content
    if (rangeHeader && mimeType.startsWith("video/")) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match || (!match[1] && !match[2]) || stat.size === 0) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
      }
      const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      const end = match[2] && match[1] ? Number(match[2]) : stat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stat.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
      }
      const boundedEnd = Math.min(end, stat.size - 1);
      const chunkSize = boundedEnd - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end: boundedEnd });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        }
      });

      return new Response(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${boundedEnd}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": mimeType,
          ...publicAssetCacheHeaders
        }
      });
    }

    const buffer = await fs.promises.readFile(filePath);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        ...publicAssetCacheHeaders,
        "Content-Disposition": "inline"
      }
    });
  } catch {
    // Never return the club logo for a missing media file. Doing so makes a
    // broken video look like a valid image and hides the real storage issue.
    return NextResponse.json({ error: "Invalid key or file access error" }, { status: 404 });
  }
}
