import { db } from "@/lib/db";
import { getPrivateFileDownloadUrl } from "@/lib/storage";
import { getSessionOrThrow, requiredPermissionForDocument, hasPermission, toHttpErrorResponse } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

// ============================================================================
// THE single choke point every document byte must pass through.
// ----------------------------------------------------------------------------
// Prevents IDOR (spec section 44): a user cannot access a document merely by
// guessing/incrementing its id in the URL — every request re-checks
// classification and team scope against the CALLER'S current permissions
// and authorized UserTeam scope server-side.
//
// The response is a 302 redirect to a short-lived (2 min) signed URL, so the
// actual file bytes are served directly by the storage provider/CDN and
// never proxied through this Next.js server — this keeps large PDF/DOCX
// downloads fast and off the app server's memory/bandwidth.
// ============================================================================
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionOrThrow();
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const medicalRecord = await db.playerMedicalRecord.findUnique({ where: { documentId: document.id }, select: { id: true } });
    const isLegacyTeamInsuranceDocument = document.description?.startsWith("Team group insurance policy (") ?? false;
    const requiredPermission = medicalRecord ? "medical.records.view" : isLegacyTeamInsuranceDocument ? "teams.view" : requiredPermissionForDocument(document.classification);
    if (!hasPermission(user, requiredPermission)) {
      await writeAuditLog({
        userId: user.id,
        action: "document.download_denied",
        entityType: "Document",
        entityId: document.id
      });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Team-scope authorization check
    const scopeContext = await getMutationScopeContext();
    try {
      assertTeamScope(scopeContext, document.teamId, "Document", { allowClubWide: true });
    } catch {
      await writeAuditLog({
        userId: user.id,
        action: "document.download_denied",
        entityType: "Document",
        entityId: document.id
      });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const inline = _req.nextUrl.searchParams.get("inline") === "true";

    // For inline previews in iframes/embeds, serve bytes directly on the same origin.
    // Redirecting to third-party S3/Cloudflare R2 signed URLs causes Cross-Origin-Resource-Policy
    // and iframe frame-ancestors blocking, and breaks browser print capabilities.
    if (inline) {
      const { getPrivateFileBuffer } = await import("@/lib/storage");
      const buffer = await getPrivateFileBuffer(document.storageKey);
      const filename = document.originalName || `${document.name}.pdf`;
      const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_");
      const mimeType = document.mimeType || (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

      await writeAuditLog({
        userId: user.id,
        action: "document.view",
        entityType: "Document",
        entityId: document.id
      });

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const url = await getPrivateFileDownloadUrl(document.storageKey, 120, { inline: false });

    await writeAuditLog({
      userId: user.id,
      action: "document.download",
      entityType: "Document",
      entityId: document.id
    });

    const redirectUrl = url.startsWith("http") ? url : new URL(url, _req.nextUrl.origin).toString();
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    const httpError = toHttpErrorResponse(error);
    if (httpError) return httpError;
    console.error(error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
