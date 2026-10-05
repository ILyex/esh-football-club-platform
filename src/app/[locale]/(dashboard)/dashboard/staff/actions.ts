"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { staffSchema } from "@/lib/validations/staff";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import {
  validateUploadedImage,
  generatePublicStorageKey,
  uploadPublicFile,
  deletePublicFile,
  deletePrivateFile,
  validateUploadedFile,
  generateStorageKey,
  uploadPrivateFile
} from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { isConfirmedPositiveDrugTest, verifyDocument } from "@/lib/ai/document-verifier";

async function extractStaffPhoto(formData: FormData): Promise<string | undefined> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime, ext } = await validateUploadedImage(buffer);
  const key = generatePublicStorageKey("staff", ext);
  return uploadPublicFile({ key, buffer, mimeType: mime });
}

async function saveStaffAttachedDocument(params: {
  staffId: string;
  teamId: string | null;
  file: File;
  type: "CNI" | "CONTRACT" | "DIPLOMA" | "DRUG_TEST";
  staffName: string;
  userId: string;
}): Promise<boolean> {
  if (!(params.file instanceof File) || params.file.size === 0) return false;
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const { mime, ext } = await validateUploadedFile(buffer);

  const staff = await db.staff.findUniqueOrThrow({
    where: { id: params.staffId },
    select: { firstName: true, lastName: true }
  });
  const kindByType = {
    CNI: "IDENTITY",
    CONTRACT: "CONTRACT",
    DIPLOMA: "DIPLOMA",
    DRUG_TEST: "DRUG_TEST"
  } as const;
  const verification = await verifyDocument(buffer, mime, {
    kind: kindByType[params.type],
    player: staff,
    otherPlayers: []
  });

  let positiveDrugTest = false;
  if (verification.verdict === "REJECT") {
    const errorCodes = verification.findings
      .filter((f) => f.severity === "error")
      .map((f) => f.code)
      .join(", ");
    positiveDrugTest = params.type === "DRUG_TEST" && isConfirmedPositiveDrugTest(verification);
    if (!positiveDrugTest) throw new Error(
      `VERIFY_REJECT|${errorCodes}|تعذّر قبول الوثيقة — ${
        errorCodes.includes("WRONG_DOCUMENT_TYPE")
          ? "نوع الملف لا يطابق الوثيقة المطلوبة؛ تحقق من الملف المرفوع واختر الوثيقة الصحيحة"
          : errorCodes.includes("NAME_MISSING")
          ? "الوثيقة غير مطابقة لمعلومات العضو؛ لم يظهر اسمه المسجل فيها"
          : errorCodes.includes("OTHER_PLAYER")
            ? "الوثيقة غير مطابقة لمعلومات العضو؛ الاسم الظاهر يعود إلى شخص آخر"
            : errorCodes.includes("DRUG_TEST_POSITIVE")
              ? "نتيجة فحص المخدرات إيجابية؛ لم تُرفق لأن هوية صاحب الوثيقة لم تتطابق مع العضو"
            : "تعذّر تأكيد مطابقة الوثيقة لبيانات العضو؛ راجع الملف أو ارفع نسخة أوضح"
      }`
    );
  }
  const verificationStatus = verification.verdict === "ACCEPT" && !positiveDrugTest
    ? "APPROVED"
    : "PENDING_REVIEW";

  const categoryMap: Record<string, string> = {
    CNI: "registration",
    CONTRACT: "contract",
    DIPLOMA: "certificate",
    DRUG_TEST: "certificate"
  };
  const categoryKey = categoryMap[params.type] || "administrative";
  let category = await db.documentCategory.findFirst({
    where: { OR: [{ key: categoryKey }, { key: "administrative" }, { key: "other" }] }
  });
  if (!category) {
    category = await db.documentCategory.create({
      data: { key: categoryKey, name: categoryKey }
    });
  }

  const namePrefixMap: Record<string, string> = {
    CNI: "بطاقة التعريف الوطنية",
    CONTRACT: "عقد المدرب / الطاقم",
    DIPLOMA: "الشهادات والمؤهلات التدريبية",
    DRUG_TEST: "وثيقة فحص المخدرات"
  };
  const docPrefix = namePrefixMap[params.type];
  const docName = `${docPrefix} - ${params.staffName}`;
  const storageKey = generateStorageKey(`staff/${params.type.toLowerCase()}`, ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: mime });

  // Delete/replace previous document of the same category for this staff member
  const existing = await db.document.findFirst({
    where: {
      relatedStaffId: params.staffId,
      name: { startsWith: docPrefix }
    }
  });

  if (existing) {
    const updated = await db.document.update({
      where: { id: existing.id },
      data: {
        name: docName,
        ...(positiveDrugTest ? { description: "verification:DRUG_TEST_POSITIVE" } : {}),
        storageKey,
        mimeType: mime,
        sizeBytes: buffer.byteLength,
        originalName: params.file.name,
        uploadedById: params.userId,
        status: verificationStatus
      }
    });
    if (positiveDrugTest) await writeAuditLog({
      userId: params.userId,
      action: "document.drug_test_positive_detected",
      entityType: "Document",
      entityId: updated.id,
      changes: { status: "PENDING_REVIEW", relatedStaffId: params.staffId }
    });
    return positiveDrugTest;
  }

  const created = await db.document.create({
    data: {
      name: docName,
      categoryId: category.id,
      ...(positiveDrugTest ? { description: "verification:DRUG_TEST_POSITIVE" } : {}),
      storageKey,
      mimeType: mime,
      sizeBytes: buffer.byteLength,
      originalName: params.file.name,
      ownerId: params.userId,
      uploadedById: params.userId,
      relatedStaffId: params.staffId,
      teamId: params.teamId,
      classification: "RESTRICTED",
      status: verificationStatus
    }
  });
  if (positiveDrugTest) await writeAuditLog({
    userId: params.userId,
    action: "document.drug_test_positive_detected",
    entityType: "Document",
    entityId: created.id,
    changes: { status: "PENDING_REVIEW", relatedStaffId: params.staffId }
  });
  return positiveDrugTest;
}

export async function createStaffAction(formData: FormData) {
  const user = await requirePermission("staff.create");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "Staff"); // creating staff profile requires unrestricted authority

  const raw = Object.fromEntries(formData.entries());
  const parsed = staffSchema.parse(raw);
  const photoUrl = await extractStaffPhoto(formData);

  const staff = await db.staff.create({ data: { ...parsed, photoUrl } });

  let positiveDrugTestDetected = false;
  try {
  const cniFile = formData.get("cniFile");
  if (cniFile instanceof File && cniFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: cniFile,
      type: "CNI",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const contractFile = formData.get("contractFile");
  if (contractFile instanceof File && contractFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: contractFile,
      type: "CONTRACT",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const diplomaFile = formData.get("diplomaFile");
  if (diplomaFile instanceof File && diplomaFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: diplomaFile,
      type: "DIPLOMA",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const drugTestFile = formData.get("drugTestFile");
  if (drugTestFile instanceof File && drugTestFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: drugTestFile,
      type: "DRUG_TEST",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }
  } catch (error) {
    const attachedDocuments = await db.document.findMany({
      where: { relatedStaffId: staff.id },
      select: { id: true, storageKey: true }
    });
    await Promise.allSettled(attachedDocuments.map((document) => deletePrivateFile(document.storageKey)));
    await db.document.deleteMany({ where: { relatedStaffId: staff.id } });
    await db.staff.delete({ where: { id: staff.id } });
    if (photoUrl) await deletePublicFile(photoUrl).catch(() => {});
    throw error;
  }

  await writeAuditLog({
    userId: user.id,
    action: "staff.create",
    entityType: "Staff",
    entityId: staff.id,
    changes: { after: parsed }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  return { id: staff.id, positiveDrugTestDetected };
}

export async function updateStaffAction(staffId: string, formData: FormData) {
  const user = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
  assertTeamScope(scopeContext, before.teamId, "Staff");

  const raw = Object.fromEntries(formData.entries());
  const parsed = staffSchema.parse(raw);
  const newPhotoUrl = await extractStaffPhoto(formData);

  const staff = await db.staff.update({
    where: { id: staffId },
    data: {
      ...parsed,
      ...(newPhotoUrl ? { photoUrl: newPhotoUrl } : {})
    }
  });

  if (newPhotoUrl && before.photoUrl) {
    await deletePublicFile(before.photoUrl).catch(() => {});
  }

  let positiveDrugTestDetected = false;
  const cniFile = formData.get("cniFile");
  if (cniFile instanceof File && cniFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: cniFile,
      type: "CNI",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const contractFile = formData.get("contractFile");
  if (contractFile instanceof File && contractFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: contractFile,
      type: "CONTRACT",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const diplomaFile = formData.get("diplomaFile");
  if (diplomaFile instanceof File && diplomaFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: diplomaFile,
      type: "DIPLOMA",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const drugTestFile = formData.get("drugTestFile");
  if (drugTestFile instanceof File && drugTestFile.size > 0) {
    positiveDrugTestDetected = (await saveStaffAttachedDocument({
      staffId: staff.id,
      teamId: staff.teamId,
      file: drugTestFile,
      type: "DRUG_TEST",
      staffName: `${staff.firstName} ${staff.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  await writeAuditLog({
    userId: user.id,
    action: "staff.update",
    entityType: "Staff",
    entityId: staff.id,
    changes: { before, after: parsed }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath(`/[locale]/dashboard/staff/${staffId}`, "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  return { id: staff.id, positiveDrugTestDetected };
}

// Delete-as-archive by default (same rationale as players.archive), separate
// from the real hard-delete action so it's never triggered accidentally.
export async function archiveStaffAction(staffId: string) {
  const user = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
  assertTeamScope(scopeContext, before.teamId, "Staff");

  const staff = await db.staff.update({ where: { id: staffId }, data: { status: "ARCHIVED" } });

  await writeAuditLog({ userId: user.id, action: "staff.archive", entityType: "Staff", entityId: staff.id });
  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/staff", "page");
}

export async function hardDeleteStaffAction(staffId: string) {
  const user = await requirePermission("staff.delete");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
  assertTeamScope(scopeContext, before.teamId, "Staff");

  await db.staff.delete({ where: { id: staffId } });

  await writeAuditLog({ userId: user.id, action: "staff.delete", entityType: "Staff", entityId: staffId });
  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/staff", "page");
}

// ============================================================================
// P2 — Staff Team Assignments (StaffTeam)
// ----------------------------------------------------------------------------
// Manages the StaffTeam join table (operational assignment — which teams a
// staff member works with). Intentionally SEPARATE from UserTeam:
//
//   StaffTeam rows describe who coaches/works with which team.
//   UserTeam rows describe who is AUTHORIZED to access which team's data.
//
// Granting a StaffTeam row MUST NOT implicitly grant any UserTeam row or any
// authorization. The policy module (policy.ts) reads UserTeam only.
//
// Authorization: staff.update (same permission as editing staff profile).
//
// Safety:
//   - Scoped upsert/deleteMany — no TOCTOU window
//   - FK on teamId enforced at DB level (Prisma surfaces the error)
//   - Both keys (staffId + teamId) in every WHERE clause
//   - NO tokenVersion bump: StaffTeam is never consulted for authorization
//     (only UserTeam is) — bumping here would be semantically wrong.
// ============================================================================

import { teamAssignmentSchema as _teamAssignSchema } from "@/lib/validations/team-assignment";

export async function addStaffTeamAction(staffId: string, formData: FormData) {
  const actor = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = _teamAssignSchema.parse(raw);

  // Assert target team assignment is within actor's live UserTeam scope
  assertTeamScope(scopeContext, parsed.teamId, "StaffTeam");

  // Verify staff exists before writing any assignment row.
  await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  // Upsert: safe no-op if already assigned. FK on teamId errors if team
  // doesn't exist — let Prisma surface that as a recognisable error.
  await db.staffTeam.upsert({
    where: { staffId_teamId: { staffId, teamId: parsed.teamId } },
    create: { staffId, teamId: parsed.teamId },
    update: {} // already assigned — no-op
  });

  await writeAuditLog({
    userId: actor.id,
    action: "staff.team_assignment.add",
    entityType: "StaffTeam",
    entityId: staffId,
    changes: { teamId: parsed.teamId }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath(`/[locale]/dashboard/staff/${staffId}`, "page");
}

export async function removeStaffTeamAction(staffId: string, teamId: string) {
  const actor = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();

  // Assert target team being detached is within actor's live UserTeam scope
  assertTeamScope(scopeContext, teamId, "StaffTeam");

  // Verify staff exists.
  await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  // Scoped delete: WHERE staffId AND teamId — cannot remove another staff
  // member's assignment regardless of what the caller passes.
  await db.staffTeam.deleteMany({ where: { staffId, teamId } });

  await writeAuditLog({
    userId: actor.id,
    action: "staff.team_assignment.remove",
    entityType: "StaffTeam",
    entityId: staffId,
    changes: { teamId }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath(`/[locale]/dashboard/staff/${staffId}`, "page");
}
