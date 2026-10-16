import PizZip from "pizzip";
import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission, toHttpErrorResponse } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { getPrivateFileBuffer } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";

const allowedTypes = ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"];

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const user = await getSessionOrThrow();
    if (!hasPermission(user, "medical.records.view")) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { playerId } = await params;
    const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true, firstName: true, lastName: true, medicalRecords: { where: { type: { in: allowedTypes as any }, documentId: { not: null } }, include: { document: { select: { id: true, storageKey: true, originalName: true } } }, orderBy: { createdAt: "asc" } } } });
    if (!player) return Response.json({ error: "Not found" }, { status: 404 });
    const scope = await getMutationScopeContext();
    try { assertTeamScope(scope, player.teamId, "Player", { allowClubWide: true }); } catch { return Response.json({ error: "Forbidden" }, { status: 403 }); }
    if (!player.medicalRecords.length) return Response.json({ error: "No medical documents" }, { status: 404 });
    const zip = new PizZip();
    const usedNames = new Set<string>();
    for (const [index, record] of player.medicalRecords.entries()) {
      if (!record.document) continue;
      const rawName = record.document.originalName || `document-${index + 1}`;
      const safeName = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || `document-${index + 1}`;
      let fileName = safeName;
      let suffix = 2;
      while (usedNames.has(fileName)) {
        const dot = safeName.lastIndexOf(".");
        fileName = dot > 0 ? `${safeName.slice(0, dot)}-${suffix}${safeName.slice(dot)}` : `${safeName}-${suffix}`;
        suffix++;
      }
      usedNames.add(fileName);
      const content = await getPrivateFileBuffer(record.document.storageKey);
      zip.file(fileName, content);
    }
    const archive = zip.generate({ type: "uint8array", compression: "DEFLATE" });
    const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    await writeAuditLog({ userId: user.id, action: "medical_record.documents_downloaded", entityType: "Player", entityId: player.id, changes: { documentCount: player.medicalRecords.length } });
    const fileStem = `${player.firstName}-${player.lastName}`.replace(/[^\p{L}\p{N}-]+/gu, "-");
    return new Response(archiveBuffer, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="medical-record-${fileStem}.zip"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    const httpError = toHttpErrorResponse(error);
    if (httpError) return httpError;
    console.error("[MedicalRecordDownload] Failed to create medical archive", error);
    return Response.json({ error: "Unable to create archive" }, { status: 500 });
  }
}
