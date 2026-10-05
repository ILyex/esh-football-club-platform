import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, getSessionOrThrow, hasPermission, ForbiddenError, toHttpErrorResponse } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { validateUploadedFile, generateStorageKey, uploadPrivateFile, deletePrivateFile } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { verifyDocument } from "@/lib/ai/document-verifier";
import { isInsuranceDocument, parseDMYToISO } from "@/lib/documents/insurance-helper";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const user = await requirePermission("players.update");
    const scope = await getMutationScopeContext();

    const player = await db.player.findUnique({
      where: { id: playerId },
      include: { team: true }
    });
    if (!player) {
      return NextResponse.json({ error: "اللاعب غير موجود" }, { status: 404 });
    }
    assertTeamScope(scope, player.teamId, "Player");

    const formData = await request.formData();
    const file = formData.get("insuranceFile");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "لم يتم اختيار ملف صالح" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedFile(buffer);

    // ── AI + Rule-based document verification ───────────────────────────────
    // Fetch sibling players for cross-player name detection
    const otherPlayers = await db.player.findMany({
      where: { status: "ACTIVE", id: { not: playerId } },
      select: {
        firstName: true,
        lastName: true,
        firstNameFr: true,
        lastNameFr: true
      }
    });

    const verification = await verifyDocument(buffer, mime, {
      kind: "INSURANCE",
      player: {
        firstName: player.firstName,
        lastName: player.lastName,
        firstNameFr: player.firstNameFr,
        lastNameFr: player.lastNameFr
      },
      otherPlayers
    });

    // Insurance status is derived from the presence of this document. Only an
    // explicit ACCEPT may be stored; REJECT and UNVERIFIED both fail closed.
    if (verification.verdict !== "ACCEPT") {
      const findingCodes = new Set(verification.findings.map((finding) => finding.code));
      const reason = findingCodes.has("OTHER_PLAYER")
        ? "الوثيقة غير مطابقة لمعلومات اللاعب؛ الاسم الظاهر يعود إلى لاعب آخر."
        : findingCodes.has("WRONG_DOCUMENT_TYPE")
          ? "الملف المرفوع ليس وثيقة التأمين المطلوبة؛ تحقّق من نوع الوثيقة واختر الملف الصحيح."
          : findingCodes.has("NAME_MISSING")
            ? "الوثيقة غير مطابقة لمعلومات اللاعب؛ لم يُعثر على اسمه في محتواها."
            : findingCodes.has("NAME_UNCERTAIN")
              ? "تعذّر تأكيد مطابقة اسم اللاعب بسبب وضوح النص أو اختلاف التهجئة. ارفع نسخة أوضح للمراجعة."
              : "تعذّرت قراءة محتوى الوثيقة بوضوح. تحقق من الملف المرفوع أو ارفع نسخة أوضح.";
      return NextResponse.json(
        {
          error: `${reason} لم تُحفظ الوثيقة ولم تتغير حالة التأمين للاعب.`,
          verdict: verification.verdict,
          findings: verification.findings,
          aiUsed: verification.aiUsed
        },
        { status: 422 }
      );
    }
    // ── End verification ────────────────────────────────────────────────────

    let category = await db.documentCategory.findFirst({
      where: { OR: [{ key: "certificate" }, { key: "administrative" }, { key: "other" }] }
    });
    if (!category) {
      category = await db.documentCategory.create({
        data: { key: "certificate", name: "Certificates" }
      });
    }

    const docPrefix = "وثيقة التأمين الرياضي";
    const docName = `${docPrefix} - ${player.firstName} ${player.lastName}`;
    const storageKey = generateStorageKey("players/insurance", ext);
    await uploadPrivateFile({ key: storageKey, buffer, mimeType: mime });

    // Look for previous insurance document for this player and replace or create
    const existing = await db.document.findFirst({
      where: {
        relatedPlayerId: player.id,
        name: { startsWith: docPrefix }
      }
    });

    const rawStartDate = formData.get("startDate")?.toString()?.trim() || null;
    const rawEndDate = formData.get("endDate")?.toString()?.trim() || null;
    const policyNumber = formData.get("policyNumber")?.toString()?.trim() || null;

    const startDateStr = parseDMYToISO(rawStartDate);
    const endDateStr = parseDMYToISO(rawEndDate);

    const metadataDesc = JSON.stringify({
      insurance: true,
      startDate: startDateStr,
      endDate: endDateStr,
      policyNumber
    });
    const parsedDocDate = startDateStr ? new Date(startDateStr) : new Date();

    if (existing) {
      await db.document.update({
        where: { id: existing.id },
        data: {
          name: docName,
          description: metadataDesc,
          documentDate: parsedDocDate,
          storageKey,
          mimeType: mime,
          sizeBytes: buffer.byteLength,
          originalName: file.name,
          uploadedById: user.id
        }
      });
    } else {
      await db.document.create({
        data: {
          name: docName,
          categoryId: category.id,
          description: metadataDesc,
          documentDate: parsedDocDate,
          storageKey,
          mimeType: mime,
          sizeBytes: buffer.byteLength,
          originalName: file.name,
          ownerId: user.id,
          uploadedById: user.id,
          relatedPlayerId: player.id,
          teamId: player.teamId,
          classification: "RESTRICTED",
          status: "APPROVED"
        }
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "player.insurance.upload",
      entityType: "Player",
      entityId: player.id,
      changes: { fileName: file.name, sizeBytes: buffer.byteLength }
    });

    revalidatePath("/[locale]/dashboard/insurance", "page");
    revalidatePath("/[locale]/dashboard/players", "page");
    revalidatePath(`/[locale]/dashboard/players/${player.id}`, "page");
    revalidatePath("/[locale]/dashboard/documents", "page");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const authResponse = toHttpErrorResponse(err);
    if (authResponse) return authResponse;
    console.error("[POST /api/players/[id]/insurance] Error:", err);
    return NextResponse.json({ error: "فشل رفع الوثيقة" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const user = await getSessionOrThrow();
    const scope = await getMutationScopeContext();
    if (!hasPermission(user, "players.update") && !hasPermission(user, "documents.delete")) {
      return NextResponse.json({ error: "غير مصرح لك بحذف وثيقة التأمين" }, { status: 403 });
    }

    const player = await db.player.findUnique({
      where: { id: playerId },
      select: { id: true, teamId: true }
    });
    if (!player) {
      return NextResponse.json({ error: "اللاعب غير موجود" }, { status: 404 });
    }
    assertTeamScope(scope, player.teamId, "Player");

    // Check optional documentId from URL searchParams or JSON body
    const url = new URL(request.url);
    let targetDocId = url.searchParams.get("documentId");

    if (!targetDocId) {
      try {
        const body = await request.clone().json();
        if (body && typeof body === "object" && typeof body.documentId === "string") {
          targetDocId = body.documentId;
        }
      } catch {
        // No body provided
      }
    }

    let docs: Array<{
      id: string;
      storageKey: string | null;
      name: string;
      description: string | null;
      relatedPlayerId: string | null;
    }> = [];

    if (targetDocId) {
      const doc = await db.document.findUnique({
        where: { id: targetDocId },
        select: {
          id: true,
          storageKey: true,
          name: true,
          description: true,
          relatedPlayerId: true
        }
      });
      if (doc && doc.relatedPlayerId === player.id && isInsuranceDocument(doc)) {
        docs = [doc];
      }
    }

    // If no document found by targetDocId or targetDocId was not supplied,
    // look up all insurance documents for this player
    if (docs.length === 0 && !targetDocId) {
      const allPlayerDocs = await db.document.findMany({
        where: { relatedPlayerId: player.id },
        select: {
          id: true,
          storageKey: true,
          name: true,
          description: true,
          relatedPlayerId: true
        }
      });

      docs = allPlayerDocs.filter((d) => isInsuranceDocument(d));

      // Broader fallback if needed
      if (docs.length === 0) {
        const docPrefix = "وثيقة التأمين الرياضي";
        docs = allPlayerDocs.filter((d) => {
          const n = (d.name || "").toLowerCase();
          return (
            d.name.startsWith(docPrefix) ||
            d.name.includes("تأمين") ||
            n.includes("assurance") ||
            n.includes("insurance") ||
            (d.description && d.description.toLowerCase().includes("insurance"))
          );
        });
      }
    }

    const docIds = docs.map((d) => d.id);

    if (docIds.length > 0) {
      // 1. Delete private files from storage
      for (const doc of docs) {
        if (doc.storageKey) {
          try {
            await deletePrivateFile(doc.storageKey);
          } catch (storageErr) {
            console.warn(`[DELETE insurance] Failed to delete file ${doc.storageKey}:`, storageErr);
          }
        }
      }

      // 2. Unlink references in related models before deleting
      await db.generatedDocument.updateMany({
        where: { documentId: { in: docIds } },
        data: { documentId: null }
      });
      await db.expense.updateMany({
        where: { documentId: { in: docIds } },
        data: { documentId: null }
      });
      await db.contract.updateMany({
        where: { documentId: { in: docIds } },
        data: { documentId: null }
      });
      await db.correspondenceAttachment.deleteMany({
        where: { documentId: { in: docIds } }
      });
      await db.meetingAttachment.deleteMany({
        where: { documentId: { in: docIds } }
      });

      // 3. Delete document rows
      await db.document.deleteMany({
        where: { id: { in: docIds } }
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "player.insurance.delete",
      entityType: "Player",
      entityId: player.id,
      changes: { deletedCount: docIds.length, deletedDocIds: docIds }
    });

    revalidatePath("/[locale]/dashboard/insurance", "page");
    revalidatePath("/[locale]/dashboard/players", "page");
    revalidatePath(`/[locale]/dashboard/players/${player.id}`, "page");
    revalidatePath("/[locale]/dashboard/documents", "page");

    return NextResponse.json({ success: true, count: docIds.length });
  } catch (err: any) {
    const authResponse = toHttpErrorResponse(err);
    if (authResponse) return authResponse;
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "غير مصرح لك بحذف وثيقة التأمين" }, { status: 403 });
    }
    console.error("[DELETE /api/players/[id]/insurance] Error:", err);
    return NextResponse.json({ error: "فشل حذف وثيقة التأمين" }, { status: 500 });
  }
}

