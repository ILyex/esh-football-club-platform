"use server";

import { db } from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/permissions";
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
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const STAFF_CARD_ROLE: Record<string, string> = {
  HEAD_COACH: "Entraîneur",
  ASSISTANT_COACH: "Entraîneur adjoint",
  GOALKEEPING_COACH: "Entraîneur des gardiens",
  FITNESS_COACH: "Préparateur physique",
  MEDICAL_STAFF: "Personnel médical",
  ADMINISTRATIVE_STAFF: "Personnel administratif",
  OTHER: "Staff"
};
const STAFF_CARD_CATEGORY: Record<string, string> = {
  SENIOR: "Seniors",
  U20: "U20",
  U17: "U17",
  U15: "U15"
};
function staffCardTitle(role: string, category?: string | null) {
  const base = STAFF_CARD_ROLE[role] ?? "Staff";
  return category && STAFF_CARD_CATEGORY[category] ? `${base} — ${STAFF_CARD_CATEGORY[category]}` : base;
}

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
    positiveDrugTest = params.type === "DRUG_TEST" && isConfirmedPositiveDrugTest(verification);
  }
  // An automated mismatch is not a reason to discard a staff member's upload.
  // Keep every safely validated file attached for an authorized human review;
  // only a confident ACCEPT may mark it approved automatically.
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
  const canAssignUserAccess = hasPermission(user, "users.manage");
  const requestedRoleId = canAssignUserAccess ? parsed.accountRoleId : undefined;
  const accountRole = requestedRoleId
    ? await db.role.findUnique({ where: { id: requestedRoleId }, select: { id: true, key: true, teamScoped: true } })
    : await db.role.findUnique({ where: { key: "viewer" }, select: { id: true, key: true, teamScoped: true } });
  if (!accountRole || accountRole.key === "super_admin" || accountRole.key === "treasurer") {
    throw new Error("staffAccountRoleNotAllowed");
  }
  const teamId = parsed.teamId ?? null;
  const validTeam = teamId ? await db.team.findFirst({ where: { id: teamId, active: true }, select: { id: true, category: true } }) : null;
  if (teamId && !validTeam) throw new Error("staffTeamAssignmentInvalid");
  if (accountRole.teamScoped && accountRole.key !== "secretary_general" && !teamId) throw new Error("teamScopedStaffNeedsOneTeam");
  if (parsed.role === "HEAD_COACH" && teamId) {
    const occupied = await db.staff.findFirst({ where: { role: "HEAD_COACH", status: "ACTIVE", teamId }, select: { id: true } });
    if (occupied) throw new Error("categoryAlreadyHasHeadCoach");
  }
  const photoUrl = await extractStaffPhoto(formData);

  const staff = await db.staff.create({
    data: { ...parsed, accountRoleId: accountRole.id, teamId, photoUrl }
  });

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

  // Every staff profile has one linked platform identity. The generated
  // address is intentionally non-deliverable and the account stays disabled
  // until an administrator sets a real email and password in User Details.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  await db.$transaction(async (tx) => {
    const linkedUser = await tx.user.create({
      data: {
        name: [staff.firstNameFr, staff.lastNameFr].filter(Boolean).join(" ") || `${staff.firstName} ${staff.lastName}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        dateOfBirth: staff.dateOfBirth,
        bloodGroup: staff.bloodGroup,
        licenseNumber: staff.licenceNumber,
        licenseRole: staffCardTitle(staff.role, validTeam?.category),
        image: staff.photoUrl,
        email: `${staff.id}@staff.esh.invalid`,
        passwordHash,
        roleId: accountRole.id,
        isActive: false
      },
      select: { id: true }
    });
    await tx.staff.update({ where: { id: staff.id }, data: { userId: linkedUser.id } });
    if (teamId) {
      await tx.staffTeam.create({ data: { staffId: staff.id, teamId } });
      if (accountRole.teamScoped) await tx.userTeam.create({ data: { userId: linkedUser.id, teamId } });
    }
  });
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
    changes: { after: { ...parsed, accountRoleId: accountRole.id, teamId, linkedPlatformAccount: true } }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  return { id: staff.id, positiveDrugTestDetected };
}

export async function updateStaffAction(staffId: string, formData: FormData) {
  const user = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({
    where: { id: staffId },
    include: { user: { select: { id: true, roleId: true } } }
  });
  assertTeamScope(scopeContext, before.teamId, "Staff");
  const submittedVersion = formData.get("recordUpdatedAt");
  if (typeof submittedVersion !== "string" || Date.parse(submittedVersion) !== before.updatedAt.getTime()) {
    throw new Error("تم تعديل بيانات عضو الطاقم في جلسة أخرى. أعد تحميل الصفحة قبل الحفظ لتجنب فقدان التغييرات.");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = staffSchema.parse(raw);
  const effectiveTeamId = parsed.teamId === undefined ? before.teamId : parsed.teamId;
  if (before.userId && effectiveTeamId !== before.teamId && !hasPermission(user, "users.manage")) {
    throw new Error("usersManagePermissionRequiredForLinkedStaffTeam");
  }
  if (effectiveTeamId) assertTeamScope(scopeContext, effectiveTeamId, "Staff");
  if (effectiveTeamId) {
    const team = await db.team.findFirst({ where: { id: effectiveTeamId, active: true }, select: { id: true, category: true } });
    if (!team) throw new Error("staffTeamAssignmentInvalid");
  }
  const effectiveTeam = effectiveTeamId ? await db.team.findUnique({ where: { id: effectiveTeamId }, select: { category: true } }) : null;
  if (parsed.role === "HEAD_COACH" && parsed.status === "ACTIVE" && effectiveTeamId) {
    const occupied = await db.staff.findFirst({ where: { role: "HEAD_COACH", status: "ACTIVE", teamId: effectiveTeamId, id: { not: staffId } }, select: { id: true } });
    if (occupied) throw new Error("categoryAlreadyHasHeadCoach");
  }
  const newPhotoUrl = await extractStaffPhoto(formData);
  const canAssignUserAccess = hasPermission(user, "users.manage");
  if (before.userId && parsed.accountRoleId && parsed.accountRoleId !== (before.accountRoleId ?? before.user?.roleId) && !canAssignUserAccess) {
    throw new Error("usersManagePermissionRequiredForLinkedStaffRole");
  }
  const accountRoleId = parsed.accountRoleId ?? before.accountRoleId ?? before.user?.roleId;
  const accountRole = accountRoleId
    ? await db.role.findUnique({ where: { id: accountRoleId }, select: { id: true, key: true, teamScoped: true } })
    : null;
  if (accountRole && ["super_admin", "treasurer"].includes(accountRole.key)) throw new Error("staffAccountRoleNotAllowed");
  if (before.userId && accountRole?.teamScoped && accountRole.key !== "secretary_general" && !effectiveTeamId) {
    throw new Error("teamScopedStaffNeedsOneTeam");
  }

  const staff = await db.$transaction(async (tx) => {
    const updatedStaff = await tx.staff.update({
      // Guard against stale forms overwriting newer profile data.
      where: { id: staffId, updatedAt: before.updatedAt },
      data: {
        ...parsed,
        teamId: effectiveTeamId,
        ...(accountRole ? { accountRoleId: accountRole.id } : {}),
        ...(newPhotoUrl ? { photoUrl: newPhotoUrl } : {})
      }
    });
    await tx.staffTeam.deleteMany({ where: { staffId } });
    if (effectiveTeamId) await tx.staffTeam.create({ data: { staffId, teamId: effectiveTeamId } });
    if (updatedStaff.userId) {
      if (accountRole?.key === "secretary_general") {
        if (before.teamId && before.teamId !== effectiveTeamId) {
          await tx.userTeam.deleteMany({ where: { userId: updatedStaff.userId, teamId: before.teamId } });
        }
        if (effectiveTeamId) await tx.userTeam.upsert({
          where: { userId_teamId: { userId: updatedStaff.userId, teamId: effectiveTeamId } },
          create: { userId: updatedStaff.userId, teamId: effectiveTeamId },
          update: {}
        });
      } else if (accountRole?.teamScoped && effectiveTeamId) {
        await tx.userTeam.deleteMany({ where: { userId: updatedStaff.userId } });
        await tx.userTeam.create({ data: { userId: updatedStaff.userId, teamId: effectiveTeamId } });
      } else {
        // Association-wide roles, including the president, have no category scope.
        await tx.userTeam.deleteMany({ where: { userId: updatedStaff.userId } });
      }
      await tx.user.update({
        where: { id: updatedStaff.userId },
        data: {
          name: [updatedStaff.firstNameFr, updatedStaff.lastNameFr].filter(Boolean).join(" ") || `${updatedStaff.firstName} ${updatedStaff.lastName}`,
          firstName: updatedStaff.firstName,
          lastName: updatedStaff.lastName,
          dateOfBirth: updatedStaff.dateOfBirth,
          bloodGroup: updatedStaff.bloodGroup,
          licenseNumber: updatedStaff.licenceNumber,
          licenseRole: staffCardTitle(updatedStaff.role, effectiveTeam?.category),
          image: updatedStaff.photoUrl,
          ...(accountRole ? { roleId: accountRole.id } : {}),
          ...(accountRole && accountRole.id !== before.user?.roleId ? { tokenVersion: { increment: 1 }, lastSeenAt: null } : {})
        }
      });
    }
    return updatedStaff;
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
  if (staff.userId) revalidatePath(`/[locale]/dashboard/users/${staff.userId}`, "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  return { id: staff.id, positiveDrugTestDetected };
}

// Delete-as-archive by default (same rationale as players.archive), separate
// from the real hard-delete action so it's never triggered accidentally.
export async function archiveStaffAction(staffId: string) {
  const user = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true, teamId: true, userId: true } });
  assertTeamScope(scopeContext, before.teamId, "Staff");

  const staff = await db.$transaction(async (tx) => {
    const archived = await tx.staff.update({ where: { id: staffId }, data: { status: "ARCHIVED" } });
    if (before.userId) await tx.user.update({ where: { id: before.userId }, data: { isActive: false, tokenVersion: { increment: 1 }, lastSeenAt: null } });
    return archived;
  });

  await writeAuditLog({ userId: user.id, action: "staff.archive", entityType: "Staff", entityId: staff.id });
  revalidatePath("/[locale]/dashboard/staff", "page");
  if (before.userId) revalidatePath(`/[locale]/dashboard/users/${before.userId}`, "page");
  revalidatePath("/[locale]/staff", "page");
}

export async function restoreStaffAction(staffId: string) {
  const user = await requirePermission("staff.update");
  const scopeContext = await getMutationScopeContext();
  const before = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
  assertTeamScope(scopeContext, before.teamId, "Staff");
  if (before.status !== "ARCHIVED") return;

  const staff = await db.staff.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  await writeAuditLog({ userId: user.id, action: "staff.restore", entityType: "Staff", entityId: staff.id });
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
// StaffTeam is an operational assignment. Linked accounts mirror explicit
// category edits into UserTeam; unlinked staff never receive user access from
// an operational assignment. Authorization continues to read UserTeam only.
//
// Authorization: staff.update (same permission as editing staff profile).
//
// Safety:
//   - Scoped upsert/deleteMany — no TOCTOU window
//   - FK on teamId enforced at DB level (Prisma surfaces the error)
//   - Both keys (staffId + teamId) in every WHERE clause
//   - Bump tokenVersion when a linked account's UserTeam changes.
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
  const targetStaff = await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true, userId: true, teamId: true, user: { select: { role: { select: { teamScoped: true } } } } } });
  if (targetStaff.userId && !hasPermission(actor, "users.manage")) throw new Error("usersManagePermissionRequiredForLinkedStaffTeam");

  const currentStaffRole = await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { role: true, status: true } });
  if (currentStaffRole.role === "HEAD_COACH" && currentStaffRole.status === "ACTIVE") {
    const occupied = await db.staff.findFirst({ where: { role: "HEAD_COACH", status: "ACTIVE", teamId: parsed.teamId, id: { not: staffId } }, select: { id: true } });
    if (occupied) throw new Error("categoryAlreadyHasHeadCoach");
  }

  await db.$transaction(async (tx) => {
    // A staff profile has exactly one operational category. Replace its old
    // assignment atomically and keep the linked account scope synchronized.
    await tx.staffTeam.deleteMany({ where: { staffId } });
    if (targetStaff.userId) await tx.userTeam.deleteMany({ where: { userId: targetStaff.userId } });
    await tx.staffTeam.upsert({
      where: { staffId_teamId: { staffId, teamId: parsed.teamId } },
      create: { staffId, teamId: parsed.teamId },
      update: {}
    });
    if (targetStaff.userId) {
      await tx.userTeam.upsert({
        where: { userId_teamId: { userId: targetStaff.userId, teamId: parsed.teamId } },
        create: { userId: targetStaff.userId, teamId: parsed.teamId },
        update: {}
      });
      await tx.user.update({ where: { id: targetStaff.userId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } });
    }
    await tx.staff.update({ where: { id: staffId }, data: { teamId: parsed.teamId } });
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
  const targetStaff = await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true, userId: true, teamId: true } });
  if (targetStaff.userId && !hasPermission(actor, "users.manage")) throw new Error("usersManagePermissionRequiredForLinkedStaffTeam");

  await db.$transaction(async (tx) => {
    if (targetStaff.userId) {
      const assignedCount = await tx.staffTeam.count({ where: { staffId } });
      const targetRole = await tx.user.findUniqueOrThrow({ where: { id: targetStaff.userId }, select: { role: { select: { teamScoped: true } } } });
      if (targetRole.role.teamScoped && assignedCount <= 1) throw new Error("teamScopedStaffNeedsOneTeam");
    }
    // Scoped deletes use both keys so neither account can detach another
    // member's category.
    await tx.staffTeam.deleteMany({ where: { staffId, teamId } });
    if (targetStaff.userId) {
      await tx.userTeam.deleteMany({ where: { userId: targetStaff.userId, teamId } });
      await tx.user.update({ where: { id: targetStaff.userId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } });
    }
    if (targetStaff.teamId === teamId) {
      const nextAssignment = await tx.staffTeam.findFirst({ where: { staffId }, orderBy: { createdAt: "asc" }, select: { teamId: true } });
      await tx.staff.update({ where: { id: staffId }, data: { teamId: nextAssignment?.teamId ?? null } });
    }
  });

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
