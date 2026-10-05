import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getLocalPublicFilePath } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  try {
    const filePath = getLocalPublicFilePath(key);
    if (!fs.existsSync(filePath)) {
      const fallbackPath = path.resolve(process.cwd(), "public", "branding", "esh-logo-256.png");
      if (fs.existsSync(fallbackPath)) {
        const fallbackBuffer = await fs.promises.readFile(fallbackPath);
        return new Response(fallbackBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = path.extname(key).toLowerCase();
    const ALLOWED_EXTS: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime"
    };
    const mimeType = ALLOWED_EXTS[ext];
    if (!mimeType) {
      return NextResponse.json({ error: "Access denied: unapproved public file type" }, { status: 403 });
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
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    const buffer = await fs.promises.readFile(filePath);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline"
      }
    });
  } catch {
    const fallbackPath = path.resolve(process.cwd(), "public", "branding", "esh-logo-256.png");
    if (fs.existsSync(fallbackPath)) {
      const fallbackBuffer = fs.readFileSync(fallbackPath);
      return new Response(fallbackBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    return NextResponse.json({ error: "Invalid key or file access error" }, { status: 400 });
  }
}
