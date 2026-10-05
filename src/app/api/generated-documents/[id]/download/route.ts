import { db } from "@/lib/db";
import { getPrivateFileDownloadUrl, getPrivateFileBuffer } from "@/lib/storage";
import { getSessionOrThrow, hasPermission, toHttpErrorResponse } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { readPermissionForEntityType, resolveSourceEntityScope } from "@/lib/documents/entity-data-resolvers";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { isPdfConverterConfigured, convertDocxToPdf } from "@/lib/documents/pdf-converter";
import { NextRequest } from "next/server";
import { clientErrorResponse } from "@/lib/api/error-response";

// Same choke-point pattern as /api/documents/[id]/download — every request
// re-checks the caller's permission and source entity's team scope server-side
// before minting a short-lived signed URL or converting to PDF.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionOrThrow();
    const { id } = await params;

    const generated = await db.generatedDocument.findUnique({ where: { id } });
    if (!generated) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Base gate, PLUS the read permission of the entity the document was
    // generated from (finance.view for financial documents). Both are checked
    // on every request, so a guessed/shared id is useless without them.
    const entityReadPermission = readPermissionForEntityType(generated.relatedEntityType);
    if (!hasPermission(user, "documents.generate") || (entityReadPermission && !hasPermission(user, entityReadPermission))) {
      await writeAuditLog({ userId: user.id, action: "generatedDocument.download_denied", entityType: "GeneratedDocument", entityId: generated.id });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve source entity scope using the authoritative resolver
    const sourceScope = await resolveSourceEntityScope(generated.relatedEntityType, generated.relatedEntityId);
    const scopeContext = await getMutationScopeContext();

    if (!sourceScope.exists) {
      // Source deleted/missing: fail-closed for restricted users; allow unrestricted admins historical access
      if (!scopeContext.isUnrestricted) {
        await writeAuditLog({ userId: user.id, action: "generatedDocument.download_denied", entityType: "GeneratedDocument", entityId: generated.id });
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // Source exists: verify team scope
      try {
        assertTeamScope(scopeContext, sourceScope.teamId, "GeneratedDocument", { allowClubWide: true });
      } catch {
        await writeAuditLog({ userId: user.id, action: "generatedDocument.download_denied", entityType: "GeneratedDocument", entityId: generated.id });
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Determine requested format: "docx" (default) or "pdf"
    let format = "docx";
    if (req) {
      try {
        const reqAny = req as any;
        const urlStr = reqAny?.url || (reqAny?.nextUrl ? String(reqAny.nextUrl) : "http://localhost");
        const parsedUrl = new URL(urlStr, "http://localhost");
        format = parsedUrl.searchParams.get("format")?.toLowerCase() || "docx";
      } catch {
        format = "docx";
      }
    }

    if (format === "pdf") {
      // Pluggable converter check (Constraint 2 & 6: Never claim success or rename DOCX when unconfigured)
      if (!isPdfConverterConfigured()) {
        return Response.json(
          {
            error: "PDF_CONVERTER_NOT_CONFIGURED",
            message: "Server-side PDF conversion is not configured. Please use the Print preview button in the dashboard to Save as PDF directly from your browser."
          },
          { status: 503 }
        );
      }

      const docxBuffer = await getPrivateFileBuffer(generated.storageKey);
      const conversion = await convertDocxToPdf(docxBuffer, { filename: `${generated.id}.docx` });

      if (!conversion.success || !conversion.pdfBuffer) {
        await writeAuditLog({ userId: user.id, action: "generatedDocument.conversion_failed", entityType: "GeneratedDocument", entityId: generated.id });
        return Response.json(
          { error: conversion.error || "CONVERSION_FAILED" },
          { status: conversion.statusCode || 502 }
        );
      }

      await writeAuditLog({ userId: user.id, action: "generatedDocument.download_pdf", entityType: "GeneratedDocument", entityId: generated.id });

      return new Response(new Uint8Array(conversion.pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${generated.id}.pdf"`
        }
      });
    }

    // Default: DOCX download via short-lived signed URL
    const url = await getPrivateFileDownloadUrl(generated.storageKey);

    await writeAuditLog({ userId: user.id, action: "generatedDocument.download", entityType: "GeneratedDocument", entityId: generated.id });

    const redirectUrl = url.startsWith("http") ? url : new URL(url, req.nextUrl.origin).toString();
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    const httpError = toHttpErrorResponse(error);
    if (httpError) return httpError;
    // Preserve detailed error for the UI instead of a generic string.
    return clientErrorResponse(error);
  }
}
