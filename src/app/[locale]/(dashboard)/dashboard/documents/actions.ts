"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
// (toHttpErrorResponse not needed here — Server Actions let thrown errors
// propagate to the client's error boundary rather than returning a Response.)
import { documentMetadataSchema } from "@/lib/validations/document";
import {
  validateUploadedFile,
  uploadPrivateFile,
  deletePrivateFile,
  generateStorageKey,
  FileValidationError
} from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";
import { verifyDocument } from "@/lib/ai/document-verifier";
import type { PlayerVerificationContext } from "@/lib/ai/document-verifier";

function inferPlayerDocumentKind(hint: string): PlayerVerificationContext["kind"] | null {
  const value = hint.toLocaleLowerCase();
  if (/drug|doping|toxic|مخدر|سموم|تحليل|فحص/.test(value)) return "DRUG_TEST";
  if (/insurance|assurance|تأمين/.test(value)) return "INSURANCE";
  if (/birth|naissance|ميلاد/.test(value)) return "BIRTH_CERTIFICATE";
  if (/contract|contrat|عقد/.test(value)) return "CONTRACT";
  if (/diploma|diplome|qualification|دبلوم|شهادة|شهاده/.test(value)) return "DIPLOMA";
  if (/identity|identite|carte|passport|cni|بطاقة|تعريف|جواز/.test(value)) return "IDENTITY";
  return null;
}

// Full real upload pipeline (spec sections 23–26 & 45):
//   1. RBAC check
//   2. Metadata validation (zod)
//   3. Team scope check
//   4. Related entity consistency check
//   5. File bytes validated server-side by real content sniffing — never by
//      trusting the browser-supplied filename/extension/MIME type
//   6. A random, non-guessable storage key is generated (never the original
//      filename) and the file is written to the PRIVATE bucket only
//   7. Metadata row created in Postgres, `classification` drives who can
//      ever download it again (see the API route below)
//   8. Audit-logged
export async function uploadDocumentAction(formData: FormData) {
  const user = await requirePermission("documents.create");
  const scopeContext = await getMutationScopeContext();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const metadataRaw = Object.fromEntries(formData.entries());
  const metadata = documentMetadataSchema.parse(metadataRaw);

  if (metadata.relatedPlayerId && /insurance|assurance|تأمين|مخدر|drug|dopage|تحاليل|analysis|analyse|medical|طبي|أهلية|aptitude/i.test(`${metadata.name} ${metadata.description || ""}`)) {
    throw new Error("أضف وثائق التأمين والفحوصات الطبية من الملف الطبي الخاص باللاعب.");
  }

  // Assert target team is authorized for the caller
  assertTeamScope(scopeContext, metadata.teamId || null, "Document");

  if (metadata.relatedPlayerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: metadata.relatedPlayerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (metadata.relatedStaffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: metadata.relatedStaffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }
  if (metadata.relatedMatchId) {
    const match = await db.match.findUniqueOrThrow({ where: { id: metadata.relatedMatchId } });
    assertTeamScope(scopeContext, match.teamId, "Match");
  }

  // If this upload targets a RESTRICTED category (contracts, correspondence,
  // meeting minutes, administrative), require the elevated permission too —
  // otherwise a Document Manager-adjacent role could smuggle sensitive files
  // in under a permissive category.
  if (metadata.classification === "RESTRICTED") {
    await requirePermission("documents.view.restricted");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let validated;
  try {
    validated = await validateUploadedFile(buffer);
  } catch (err) {
    if (err instanceof FileValidationError) {
      throw new Error(err.message);
    }
    throw err;
  }

  // ── AI + rules for recognized, person-bound document categories ─────────
  let positiveDrugTestDetected = false;
  if (metadata.relatedPlayerId || metadata.relatedStaffId) {
    const [category, player, staff] = await Promise.all([
      db.documentCategory.findUnique({ where: { id: metadata.categoryId }, select: { key: true, name: true } }),
      metadata.relatedPlayerId
        ? db.player.findUniqueOrThrow({ where: { id: metadata.relatedPlayerId } })
        : Promise.resolve(null),
      metadata.relatedStaffId
        ? db.staff.findUniqueOrThrow({ where: { id: metadata.relatedStaffId } })
        : Promise.resolve(null)
    ]);
    const kind = inferPlayerDocumentKind(`${metadata.name} ${metadata.description || ""} ${category?.key || ""} ${category?.name || ""}`);
    if (kind) {
      const person = player || staff!;
      const otherPlayers = player?.teamId
        ? await db.player.findMany({
            where: { teamId: player.teamId, id: { not: player.id } },
            select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true }
          })
        : [];
      const verification = await verifyDocument(buffer, validated.mime, {
        kind,
        player: {
          firstName: person.firstName,
          lastName: person.lastName,
          firstNameFr: "firstNameFr" in person ? person.firstNameFr : null,
          lastNameFr: "lastNameFr" in person ? person.lastNameFr : null
        },
        otherPlayers
      });

      const errorCodes = verification.findings
        .filter((f) => f.severity === "error")
        .map((f) => f.code);
      positiveDrugTestDetected = kind === "DRUG_TEST" && errorCodes.includes("DRUG_TEST_POSITIVE");
      if (positiveDrugTestDetected && metadata.classification !== "RESTRICTED") {
        await requirePermission("documents.view.restricted");
      }

      if (verification.verdict === "REJECT" && !positiveDrugTestDetected) {
        const errorCodeList = errorCodes.join(", ");
        const reason = errorCodes.includes("WRONG_DOCUMENT_TYPE")
            ? "نوع الملف لا يطابق نوع الوثيقة المحدد"
            : errorCodes.includes("NAME_MISSING") || errorCodes.includes("OTHER_PLAYER")
              ? "اسم الوثيقة لا يطابق الشخص المحدد"
              : "يرجى التحقق من محتوى الملف";
        throw new Error(`VERIFY_REJECT|${errorCodeList}|تعذّر قبول الوثيقة — ${reason}`);
      }
    }
  }
  // ── End verification ──────────────────────────────────────────────────────

  const storageKey = generateStorageKey(metadata.categoryId, validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const document = await db.document.create({
    data: {
      name: metadata.name,
      categoryId: metadata.categoryId,
      description: positiveDrugTestDetected
        ? "verification:DRUG_TEST_POSITIVE"
        : metadata.description,
      documentDate: metadata.documentDate,
      classification: positiveDrugTestDetected ? "RESTRICTED" : metadata.classification,
      department: metadata.department,
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      teamId: metadata.teamId || null,
      relatedPlayerId: metadata.relatedPlayerId || null,
      relatedStaffId: metadata.relatedStaffId || null,
      relatedMatchId: metadata.relatedMatchId || null,
      status: "PENDING_REVIEW"
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "document.upload",
    entityType: "Document",
    entityId: document.id,
      changes: { classification: positiveDrugTestDetected ? "RESTRICTED" : metadata.classification, category: metadata.categoryId }
  });

  if (positiveDrugTestDetected) {
    await writeAuditLog({
      userId: user.id,
      action: "document.drug_test_positive_detected",
      entityType: "Document",
      entityId: document.id,
      changes: { relatedPlayerId: document.relatedPlayerId, relatedStaffId: document.relatedStaffId }
    });
  }

  revalidatePath("/[locale]/dashboard/documents", "page");
  return { id: document.id, positiveDrugTestDetected };
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requirePermission("documents.delete");
  const scopeContext = await getMutationScopeContext();
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (await db.playerMedicalRecord.findUnique({ where: { documentId }, select: { id: true } })) {
    await requirePermission("medical.records.manage");
    throw new Error("تُدار الوثائق الطبية من سجل اللاعب للحفاظ على تاريخ الملف.");
  }
  assertTeamScope(scopeContext, document.teamId, "Document");

  await deletePrivateFile(document.storageKey);
  await db.document.delete({ where: { id: documentId } });

  await writeAuditLog({ userId: user.id, action: "document.delete", entityType: "Document", entityId: documentId });
  revalidatePath("/[locale]/dashboard/documents", "page");
}

// Metadata-only edit — the file itself is immutable once uploaded (spec:
// an official document's content shouldn't silently change); replacing the
// file means uploading a new Document, not mutating this one.
export async function updateDocumentMetadataAction(documentId: string, formData: FormData) {
  const user = await requirePermission("documents.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (await db.playerMedicalRecord.findUnique({ where: { documentId }, select: { id: true } })) {
    await requirePermission("medical.records.manage");
    throw new Error("تُدار بيانات الوثيقة الطبية من سجل اللاعب.");
  }

  const metadataRaw = Object.fromEntries(formData.entries());
  const metadata = documentMetadataSchema.parse(metadataRaw);
  assertDualTeamScope(scopeContext, before.teamId, metadata.teamId || null, "Document");

  if (metadata.relatedPlayerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: metadata.relatedPlayerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (metadata.relatedStaffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: metadata.relatedStaffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }
  if (metadata.relatedMatchId) {
    const match = await db.match.findUniqueOrThrow({ where: { id: metadata.relatedMatchId } });
    assertTeamScope(scopeContext, match.teamId, "Match");
  }

  if (metadata.classification === "RESTRICTED" && before.classification !== "RESTRICTED") {
    await requirePermission("documents.view.restricted");
  }

  const document = await db.document.update({
    where: { id: documentId },
    data: {
      name: metadata.name,
      categoryId: metadata.categoryId,
      description: before.description === "verification:DRUG_TEST_POSITIVE"
        ? before.description
        : metadata.description,
      documentDate: metadata.documentDate,
      classification: metadata.classification,
      department: metadata.department,
      teamId: metadata.teamId || null,
      relatedPlayerId: metadata.relatedPlayerId || null,
      relatedStaffId: metadata.relatedStaffId || null,
      relatedMatchId: metadata.relatedMatchId || null
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "document.update",
    entityType: "Document",
    entityId: documentId,
    changes: { before: { classification: before.classification, categoryId: before.categoryId }, after: metadata }
  });
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath(`/[locale]/dashboard/documents/${documentId}`, "page");
}

export async function setDocumentStatusAction(documentId: string, status: "PENDING_REVIEW" | "APPROVED" | "ARCHIVED") {
  const user = await requirePermission("documents.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (await db.playerMedicalRecord.findUnique({ where: { documentId }, select: { id: true } })) {
    await requirePermission("medical.records.manage");
    throw new Error("لا يمكن تعديل حالة وثيقة طبية من الأرشيف العام.");
  }
  assertTeamScope(scopeContext, before.teamId, "Document");

  const document = await db.document.update({ where: { id: documentId }, data: { status } });

  await writeAuditLog({ userId: user.id, action: `document.${status.toLowerCase()}`, entityType: "Document", entityId: documentId });
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath(`/[locale]/dashboard/documents/${documentId}`, "page");
}
