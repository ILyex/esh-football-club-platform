import { NextRequest } from "next/server";
import { requirePermission, toHttpErrorResponse } from "@/lib/permissions";
import { getMailAttachment } from "@/lib/integrations/gmail/service";

// ============================================================================
// PHASE 11 — SECURE ATTACHMENT DOWNLOAD ROUTE
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("mail.view");
    const searchParams = req.nextUrl.searchParams;

    const messageId = searchParams.get("messageId");
    const attachmentId = searchParams.get("attachmentId");
    const filename = searchParams.get("filename");
    const preview = searchParams.get("preview") === "1";
    const requestedMimeType = searchParams.get("mimeType") || "";

    if (!messageId || !attachmentId || !filename) {
      return new Response("Missing required attachment parameters", { status: 400 });
    }

    const { data } = await getMailAttachment(messageId, attachmentId, filename, user);

    const safeFilename = filename.replace(/["\\;\r\n\0]/g, "_");
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(safeFilename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

    const previewMimeTypes = new Set([
      "application/pdf",
      "text/plain",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp"
    ]);
    const mimeType = preview && previewMimeTypes.has(requestedMimeType)
      ? requestedMimeType
      : "application/octet-stream";
    const disposition = preview && mimeType !== "application/octet-stream" ? "inline" : "attachment";

    return new Response(data as any, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store"
      }
    });
  } catch (err: any) {
    const httpRes = toHttpErrorResponse(err);
    if (httpRes) return httpRes;
    return new Response(err.message || "Failed to download attachment", { status: 500 });
  }
}
