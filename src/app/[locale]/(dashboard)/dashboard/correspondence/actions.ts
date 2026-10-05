"use server";

import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { correspondenceSchema } from "@/lib/validations/correspondence";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { validateUploadedFile, uploadPrivateFile, generateStorageKey, FileValidationError } from "@/lib/storage";
import { revalidatePath } from "next/cache";

async function getOrCreateCorrespondenceCategory() {
  let cat = await db.documentCategory.findUnique({ where: { key: "correspondence" } });
  if (!cat) {
    cat = await db.documentCategory.create({
      data: { key: "correspondence", name: "Correspondence / مراسلات" }
    });
  }
  return cat;
}

export async function createCorrespondenceAction(formData: FormData) {
  const user = await requirePermission("correspondence.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = correspondenceSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "Correspondence");

  if (parsed.relatedPlayerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: parsed.relatedPlayerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (parsed.relatedStaffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: parsed.relatedStaffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }
  if (parsed.relatedMatchId) {
    const match = await db.match.findUniqueOrThrow({ where: { id: parsed.relatedMatchId } });
    assertTeamScope(scopeContext, match.teamId, "Match");
  }

  const correspondence = await db.correspondence.create({
    data: {
      referenceNumber: parsed.referenceNumber,
      subject: parsed.subject,
      sender: parsed.sender,
      recipient: parsed.recipient,
      date: parsed.date,
      type: parsed.type,
      priority: parsed.priority,
      status: parsed.status,
      teamId: parsed.teamId || null,
      relatedPlayerId: parsed.relatedPlayerId || null,
      relatedStaffId: parsed.relatedStaffId || null,
      relatedMatchId: parsed.relatedMatchId || null,
      notes: parsed.notes,
      responsibleUserId: user.id
    }
  });

  // Optional direct file upload attached during creation
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let validated;
    try {
      validated = await validateUploadedFile(buffer);
    } catch (err) {
      if (err instanceof FileValidationError) throw new Error(err.message);
      throw err;
    }

    const category = await getOrCreateCorrespondenceCategory();
    const storageKey = generateStorageKey(category.id, validated.ext);
    await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

    const document = await db.document.create({
      data: {
        name: parsed.subject,
        categoryId: category.id,
        description: `Attachment for correspondence ${parsed.referenceNumber}`,
        documentDate: parsed.date,
        classification: "RESTRICTED",
        department: "Secretariat / الأمانة العامة",
        storageKey,
        mimeType: validated.mime,
        sizeBytes: buffer.byteLength,
        originalName: file.name,
        ownerId: user.id,
        uploadedById: user.id,
        teamId: parsed.teamId || null,
        relatedPlayerId: parsed.relatedPlayerId || null,
        relatedStaffId: parsed.relatedStaffId || null,
        relatedMatchId: parsed.relatedMatchId || null,
        status: "APPROVED"
      }
    });

    await db.correspondenceAttachment.create({
      data: {
        correspondenceId: correspondence.id,
        documentId: document.id
      }
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: "correspondence.create",
    entityType: "Correspondence",
    entityId: correspondence.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/correspondence", "page");
  return { id: correspondence.id };
}

export async function updateCorrespondenceAction(correspondenceId: string, formData: FormData) {
  const user = await requirePermission("correspondence.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.correspondence.findUniqueOrThrow({ where: { id: correspondenceId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = correspondenceSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "Correspondence");

  if (parsed.relatedPlayerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: parsed.relatedPlayerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (parsed.relatedStaffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: parsed.relatedStaffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }
  if (parsed.relatedMatchId) {
    const match = await db.match.findUniqueOrThrow({ where: { id: parsed.relatedMatchId } });
    assertTeamScope(scopeContext, match.teamId, "Match");
  }

  const correspondence = await db.correspondence.update({
    where: { id: correspondenceId },
    data: {
      referenceNumber: parsed.referenceNumber,
      subject: parsed.subject,
      sender: parsed.sender,
      recipient: parsed.recipient,
      date: parsed.date,
      type: parsed.type,
      priority: parsed.priority,
      status: parsed.status,
      teamId: parsed.teamId || null,
      relatedPlayerId: parsed.relatedPlayerId || null,
      relatedStaffId: parsed.relatedStaffId || null,
      relatedMatchId: parsed.relatedMatchId || null,
      notes: parsed.notes
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "correspondence.update",
    entityType: "Correspondence",
    entityId: correspondence.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/correspondence", "page");
  revalidatePath(`/[locale]/dashboard/correspondence/${correspondenceId}`, "page");
  return { id: correspondence.id };
}

// Attaching reuses the existing secure Document system (spec section 32) —
// no separate raw-file upload path here, so every attachment still goes
// through the same MIME/size/path-traversal validation and the same
// classification-based access control as the Documents module itself.
export async function attachDocumentAction(correspondenceId: string, formData: FormData) {
  const user = await requirePermission("correspondence.manage");
  const scopeContext = await getMutationScopeContext();
  const correspondence = await db.correspondence.findUniqueOrThrow({ where: { id: correspondenceId } });
  assertTeamScope(scopeContext, correspondence.teamId, "Correspondence");

  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const canSeeRestricted = hasPermission(user, "documents.view.restricted");
  const document = await db.document.findFirst({
    where: { id: documentId, ...(canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } }) }
  });
  if (!document) return; // silently no-op: not found or not authorized — never leak existence of restricted docs

  // Attachment team-compatibility enforcement:
  // - Team A parent -> Team A document OR club-wide document
  // - Club-wide parent -> club-wide document only
  if (correspondence.teamId) {
    if (document.teamId !== null && document.teamId !== correspondence.teamId) return;
  } else {
    if (document.teamId !== null) return;
  }

  // Ensure caller has scope over the document being attached
  assertTeamScope(scopeContext, document.teamId, "Document", { allowClubWide: true });

  await db.correspondenceAttachment.upsert({
    where: { correspondenceId_documentId: { correspondenceId, documentId } },
    update: {},
    create: { correspondenceId, documentId }
  });

  await writeAuditLog({
    userId: user.id,
    action: "correspondence.attach",
    entityType: "Correspondence",
    entityId: correspondenceId,
    changes: { after: { documentId } }
  });
  revalidatePath(`/[locale]/dashboard/correspondence/${correspondenceId}`, "page");
}

export async function detachDocumentAction(correspondenceId: string, documentId: string) {
  const user = await requirePermission("correspondence.manage");
  const scopeContext = await getMutationScopeContext();
  const correspondence = await db.correspondence.findUniqueOrThrow({ where: { id: correspondenceId } });
  assertTeamScope(scopeContext, correspondence.teamId, "Correspondence");

  await db.correspondenceAttachment.deleteMany({ where: { correspondenceId, documentId } });

  await writeAuditLog({
    userId: user.id,
    action: "correspondence.detach",
    entityType: "Correspondence",
    entityId: correspondenceId,
    changes: { after: { documentId } }
  });
  revalidatePath(`/[locale]/dashboard/correspondence/${correspondenceId}`, "page");
}

export async function uploadAndAttachCorrespondenceDocumentAction(correspondenceId: string, formData: FormData) {
  const user = await requirePermission("correspondence.manage");
  const scopeContext = await getMutationScopeContext();
  const correspondence = await db.correspondence.findUniqueOrThrow({ where: { id: correspondenceId } });
  assertTeamScope(scopeContext, correspondence.teamId, "Correspondence");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let validated;
  try {
    validated = await validateUploadedFile(buffer);
  } catch (err) {
    if (err instanceof FileValidationError) throw new Error(err.message);
    throw err;
  }

  const category = await getOrCreateCorrespondenceCategory();
  const storageKey = generateStorageKey(category.id, validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const docName = (formData.get("name") as string)?.trim() || file.name;

  const document = await db.document.create({
    data: {
      name: docName,
      categoryId: category.id,
      description: `Attachment for correspondence ${correspondence.referenceNumber}`,
      documentDate: correspondence.date,
      classification: "RESTRICTED",
      department: "Secretariat / الأمانة العامة",
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      teamId: correspondence.teamId || null,
      relatedPlayerId: correspondence.relatedPlayerId || null,
      relatedStaffId: correspondence.relatedStaffId || null,
      relatedMatchId: correspondence.relatedMatchId || null,
      status: "APPROVED"
    }
  });

  await db.correspondenceAttachment.upsert({
    where: { correspondenceId_documentId: { correspondenceId, documentId: document.id } },
    update: {},
    create: { correspondenceId, documentId: document.id }
  });

  await writeAuditLog({
    userId: user.id,
    action: "correspondence.upload_attach",
    entityType: "Correspondence",
    entityId: correspondenceId,
    changes: { after: { documentId: document.id, originalName: file.name } }
  });

  revalidatePath(`/[locale]/dashboard/correspondence/${correspondenceId}`, "page");
  return { documentId: document.id };
}

