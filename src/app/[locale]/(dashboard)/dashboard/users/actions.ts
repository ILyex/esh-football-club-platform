"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ForbiddenError, getSessionOrThrow, isProgrammer, requirePermission } from "@/lib/permissions";
import { createUserSchema, updateUserSchema, resetPasswordSchema } from "@/lib/validations/user";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  validateUploadedImage,
  generatePublicStorageKey,
  uploadPublicFile,
  deletePublicFile,
  isPublicStorageConfigured
} from "@/lib/storage";
import { userIdPrefixFromRoute } from "@/lib/user-route";

const TEAM_SCOPED_COACH_ROLE_KEYS = new Set(["coach", "assistant_coach"]);
const MULTI_TEAM_STAFF_ROLE_KEYS = new Set(["secretary_general"]);

/**
 * User detail links intentionally expose a readable route segment such as
 * `super-admin--cmuqk2tw`, while mutations must always use the full database
 * CUID. Resolve both forms at the server boundary so a form submission never
 * targets the display URL as if it were the primary key.
 */
async function resolveUserId(routeOrId: string): Promise<string> {
  const direct = await db.user.findFirst({ where: { id: routeOrId, deletedAt: null }, select: { id: true } });
  if (direct) return direct.id;

  const prefix = userIdPrefixFromRoute(routeOrId);
  if (!prefix) throw new Error("userNotFound");
  const byPrefix = await db.user.findFirst({ where: { id: { startsWith: prefix }, deletedAt: null }, select: { id: true } });
  if (!byPrefix) throw new Error("userNotFound");
  return byPrefix.id;
}

async function extractUserPhoto(formData: FormData): Promise<string | undefined> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime, ext } = await validateUploadedImage(buffer);
  // Avatars remain online even before an S3 provider is configured: the
  // browser compresses them first, then Neon stores the small data URL.
  // When S3 is configured, keep using the scalable object-storage path.
  if (!isPublicStorageConfigured()) {
    if (buffer.byteLength > 700 * 1024) throw new Error("avatar_too_large");
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
  const key = generatePublicStorageKey("users", ext);
  return uploadPublicFile({ key, buffer, mimeType: mime });
}

export async function createUserAction(formData: FormData) {
  const actor = await requirePermission("users.manage");
  const raw = Object.fromEntries(formData.entries());
  const { photo, ...schemaInput } = raw;
  const parsed = createUserSchema.parse(schemaInput);

  const selectedRole = await db.role.findUniqueOrThrow({ where: { id: parsed.roleId }, select: { key: true } });
  if (selectedRole.key === "staff_profile") throw new Error("staffProfileRoleUnavailable");
  if (selectedRole.key === "super_admin" && actor.roleKey !== "super_admin") {
    throw new Error("superAdminAssignmentRestricted");
  }
  const existing = await db.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  if (existing) throw new Error("emailTaken");

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const photoUrl = await extractUserPhoto(formData);

  const user = await db.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash,
      roleId: parsed.roleId,
      image: photoUrl || null,
      licenseNumber: parsed.licenseNumber || null,
      licenseRole: parsed.licenseRole || null,
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      dateOfBirth: parsed.dateOfBirth ? new Date(`${parsed.dateOfBirth}T00:00:00.000Z`) : null,
      bloodGroup: parsed.bloodGroup || null
    }
  });

  // Never log the password itself — spec section 12/5: audit logs must not contain secrets.
  await writeAuditLog({
    userId: actor.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    changes: { after: { name: parsed.name, email: parsed.email, roleId: parsed.roleId, hasImage: Boolean(photoUrl), hasDigitalCardDetails: Boolean(parsed.firstName || parsed.lastName || parsed.dateOfBirth || parsed.bloodGroup || parsed.licenseRole) } }
  });
  revalidatePath("/[locale]/dashboard/users", "page");
  return { id: user.id };
}

export async function updateUserAction(userId: string, formData: FormData) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);
  const before = await db.user.findFirstOrThrow({
    where: { id: targetUserId, deletedAt: null },
    include: { staff: { select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, dateOfBirth: true, bloodGroup: true, licenceNumber: true, role: true, photoUrl: true, accountRoleId: true, team: { select: { category: true } } } } }
  });

  const raw = Object.fromEntries(formData.entries());
  const { photo, removePhoto, ...schemaInput } = raw;
  const parsed = updateUserSchema.parse(schemaInput);

  const effectiveRoleId = parsed.roleId;
  const selectedRole = await db.role.findUniqueOrThrow({ where: { id: effectiveRoleId }, select: { key: true, teamScoped: true } });
  if (selectedRole.key === "staff_profile") throw new Error("staffProfileRoleUnavailable");
  if (before.staff && ["super_admin", "treasurer"].includes(selectedRole.key)) {
    throw new Error("staffAccountRoleNotAllowed");
  }
  if (selectedRole.key === "super_admin" && actor.roleKey !== "super_admin") {
    throw new Error("superAdminAssignmentRestricted");
  }
  if (selectedRole.teamScoped && TEAM_SCOPED_COACH_ROLE_KEYS.has(selectedRole.key)) {
    if (before.staff) {
      const staffTeamAssignments = await db.staffTeam.count({ where: { staffId: before.staff.id } });
      if (staffTeamAssignments !== 1) throw new Error("teamScopedStaffNeedsOneTeam");
    } else {
      const existingTeamAssignments = await db.userTeam.count({ where: { userId: targetUserId } });
      if (existingTeamAssignments > 1) throw new Error("coachMustHaveOneTeam");
    }
  }

  if (parsed.email.toLowerCase() !== before.email) {
    const existing = await db.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
    if (existing) throw new Error("emailTaken");
  }

  // Role and active-status changes must invalidate every session already
  // issued for this user — permissions are baked into the JWT at login
  // time (see lib/auth.ts), so without bumping tokenVersion a role change
  // or a deactivation would silently NOT take effect until the token
  // naturally expired (up to 8h later).
  const roleOrActiveChanged = effectiveRoleId !== before.roleId || parsed.isActive !== before.isActive;
  if (before.staff && parsed.isActive && parsed.email.toLowerCase().endsWith("@staff.esh.invalid")) {
    throw new Error("staffAccountNeedsRealEmail");
  }

  // Safety guard: never allow the last active super_admin to be demoted or
  // deactivated through this form — that would lock every administrator
  // out of the platform with no way back in through the UI.
  if (roleOrActiveChanged) {
    const beforeRole = await db.role.findUnique({ where: { id: before.roleId } });
    const losingSuperAdmin = beforeRole?.key === "super_admin" && (effectiveRoleId !== before.roleId || !parsed.isActive);
    if (losingSuperAdmin) {
      const otherActiveSuperAdmins = await db.user.count({
        where: { id: { not: targetUserId }, isActive: true, role: { key: "super_admin" } }
      });
      if (otherActiveSuperAdmins === 0) throw new Error("lastSuperAdmin");
    }
  }

  const shouldRemovePhoto = !before.staff && (formData.get("removePhoto") === "1" || formData.get("removePhoto") === "true");
  const newPhotoUrl = before.staff ? undefined : await extractUserPhoto(formData);

  let nextImage = before.image;
  if (shouldRemovePhoto) {
    if (before.image) {
      await deletePublicFile(before.image).catch(() => {});
    }
    nextImage = null;
  } else if (newPhotoUrl) {
    if (before.image) {
      await deletePublicFile(before.image).catch(() => {});
    }
    nextImage = newPhotoUrl;
  }

  const profileName = before.staff
    ? [before.staff.firstNameFr, before.staff.lastNameFr].filter(Boolean).join(" ") || `${before.staff.firstName} ${before.staff.lastName}`
    : parsed.name;
  const user = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: targetUserId },
      data: {
        name: profileName,
        email: parsed.email.toLowerCase(),
        roleId: effectiveRoleId,
        isActive: parsed.isActive,
        image: before.staff ? before.staff.photoUrl : nextImage,
        licenseNumber: before.staff ? before.staff.licenceNumber : (parsed.licenseNumber || null),
        licenseRole: before.staff ? `${({ HEAD_COACH: "Entraîneur", ASSISTANT_COACH: "Entraîneur adjoint", GOALKEEPING_COACH: "Entraîneur des gardiens", FITNESS_COACH: "Préparateur physique", MEDICAL_STAFF: "Personnel médical", ADMINISTRATIVE_STAFF: "Personnel administratif", OTHER: "Staff" } as Record<string, string>)[before.staff.role]}${before.staff.team ? ` — ${{ SENIOR: "Seniors", U20: "U20", U17: "U17", U15: "U15" }[before.staff.team.category]}` : ""}` : (parsed.licenseRole || null),
        firstName: before.staff ? before.staff.firstName : (parsed.firstName || null),
        lastName: before.staff ? before.staff.lastName : (parsed.lastName || null),
        dateOfBirth: before.staff ? before.staff.dateOfBirth : (parsed.dateOfBirth ? new Date(`${parsed.dateOfBirth}T00:00:00.000Z`) : null),
        bloodGroup: before.staff ? before.staff.bloodGroup : (parsed.bloodGroup || null),
        ...(roleOrActiveChanged ? { tokenVersion: { increment: 1 }, lastSeenAt: null } : {})
      }
    });
    if (!selectedRole.teamScoped) {
      // Unrestricted roles such as the association president have no fixed
      // category. Remove dormant scopes so they cannot reappear on a later role change.
      await tx.userTeam.deleteMany({ where: { userId: targetUserId } });
    }
    if (before.staff) {
      await tx.staff.update({ where: { id: before.staff.id }, data: { accountRoleId: effectiveRoleId } });
      if (selectedRole.key === "secretary_general") {
        const existingAssignments = await tx.userTeam.count({ where: { userId: targetUserId } });
        if (existingAssignments === 0) {
          const staffTeam = await tx.staffTeam.findFirst({ where: { staffId: before.staff.id }, select: { teamId: true } });
          if (staffTeam) await tx.userTeam.upsert({
            where: { userId_teamId: { userId: targetUserId, teamId: staffTeam.teamId } },
            create: { userId: targetUserId, teamId: staffTeam.teamId },
            update: {}
          });
        }
      } else if (selectedRole.teamScoped) {
        const assignment = await tx.staffTeam.findFirst({ where: { staffId: before.staff.id }, select: { teamId: true } });
        if (!assignment) throw new Error("teamScopedStaffNeedsOneTeam");
        await tx.userTeam.deleteMany({ where: { userId: targetUserId, teamId: { not: assignment.teamId } } });
        await tx.userTeam.upsert({
          where: { userId_teamId: { userId: targetUserId, teamId: assignment.teamId } },
          create: { userId: targetUserId, teamId: assignment.teamId },
          update: {}
        });
      }
    }
    await writeAuditLog({
      userId: actor.id,
      action: "user.update",
      entityType: "User",
      entityId: updatedUser.id,
      changes: {
        before: { name: before.name, email: before.email, roleId: before.roleId, isActive: before.isActive, hasImage: Boolean(before.image) },
        after: { name: profileName, email: parsed.email, roleId: effectiveRoleId, isActive: parsed.isActive, hasImage: Boolean(before.staff ? before.staff.photoUrl : nextImage), hasDigitalCardDetails: Boolean(before.staff || parsed.firstName || parsed.lastName || parsed.dateOfBirth || parsed.bloodGroup || parsed.licenseRole) }
      }
    }, tx);
    return updatedUser;
  });
  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
  // User names are also rendered from the Auth.js session in the dashboard
  // layout and greeting. Revalidate that layout when profile data changes so
  // the updated name is visible immediately after saving one's own account.
  revalidatePath("/[locale]/dashboard", "layout");
}

/**
 * Remove an account from the system while preserving its linked audit and
 * financial history. PII is scrubbed and tokenVersion revokes issued JWTs.
 */
export async function deleteUserAction(userId: string) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);
  if (await db.staff.findUnique({ where: { userId: targetUserId }, select: { id: true } })) {
    throw new Error("staffAccountsMustBeManagedFromStaffProfile");
  }
  if (actor.id === targetUserId) throw new Error("cannotDeleteOwnAccount");

  const deletedAt = new Date();
  const target = await db.$transaction(async (tx) => {
    // Recheck inside a serializable transaction to prevent simultaneous deletes
    // from removing the final active super-admin.
    const current = await tx.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      include: { role: { select: { key: true } } }
    });
    if (!current) throw new Error("userNotFound");
    if (current.isActive && current.role.key === "super_admin") {
      const otherActiveSuperAdmins = await tx.user.count({
        where: { id: { not: targetUserId }, isActive: true, deletedAt: null, role: { key: "super_admin" } }
      });
      if (otherActiveSuperAdmins === 0) throw new Error("lastSuperAdmin");
    }
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        name: "Deleted account",
        email: `deleted-${current.id}@deleted.invalid`,
        image: null,
        isActive: false,
        deletedAt,
        lastSeenAt: null,
        tokenVersion: { increment: 1 }
      }
    });
    await writeAuditLog({
      userId: actor.id,
      action: "user.delete",
      entityType: "User",
      entityId: current.id,
      changes: { accountRemoved: true, deletedAt: deletedAt.toISOString(), performedBy: actor.email }
    }, tx);
    return current;
  }, { isolationLevel: "Serializable" });

  if (target.image) await deletePublicFile(target.image).catch(() => {});

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
  revalidatePath("/[locale]/dashboard/roles", "page");
  revalidatePath("/[locale]/dashboard/audit-logs", "page");
}

export async function deleteUserPhotoAction(userId: string) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);
  const user = await db.user.findFirstOrThrow({ where: { id: targetUserId, deletedAt: null }, include: { staff: { select: { id: true } } } });
  if (user.staff) throw new Error("staffPhotoMustBeManagedFromStaffProfile");
  if (user.image) {
    await deletePublicFile(user.image).catch(() => {});
    await db.user.update({ where: { id: targetUserId }, data: { image: null } });
    await writeAuditLog({
      userId: actor.id,
      action: "user.photo.delete",
      entityType: "User",
      entityId: targetUserId
    });
  }
  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

export async function resetUserPasswordAction(userId: string, formData: FormData) {
  const actor = await getSessionOrThrow();
  if (!isProgrammer(actor)) throw new ForbiddenError("users.password.reset");
  const targetUserId = await resolveUserId(userId);
  const raw = Object.fromEntries(formData.entries());
  const parsed = resetPasswordSchema.parse(raw);

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  // A password reset must also force re-login everywhere — bump
  // tokenVersion.
  await db.user.update({ where: { id: targetUserId, deletedAt: null }, data: { passwordHash, tokenVersion: { increment: 1 }, lastSeenAt: null } });

  await writeAuditLog({ userId: actor.id, action: "user.password_reset", entityType: "User", entityId: targetUserId });
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

// ============================================================================
// P2 — User Team Assignments (UserTeam)
// ----------------------------------------------------------------------------
// Authorization: users.manage — managing a user's team scope is a natural
// extension of managing that user.
//
// Safety:
//   - findUniqueOrThrow verifies the target user exists before any DB write.
//   - Upsert (not create): safe no-op if the assignment already exists at the
//     DB level (composite PK on UserTeam prevents duplicates regardless).
//   - deleteMany scoped to (userId, teamId): cannot affect another user.
//   - Both add AND remove bump tokenVersion in the SAME $transaction so the
//     new team scope takes effect on the user's very next request (JWT
//     invalidation), matching the pattern in updateUserAction above.
// ============================================================================

import { teamAssignmentSchema } from "@/lib/validations/team-assignment";

export async function addUserTeamAction(userId: string, formData: FormData) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);

  const raw = Object.fromEntries(formData.entries());
  const parsed = teamAssignmentSchema.parse(raw);

  const targetUser = await db.user.findFirstOrThrow({
    where: { id: targetUserId, deletedAt: null },
    select: { id: true, role: { select: { key: true } } }
  });
  if (targetUser.role.key === "president") throw new Error("presidentHasNoTeamAssignment");
  const linkedStaff = await db.staff.findUnique({ where: { userId: targetUserId }, select: { id: true } });
  if (linkedStaff && !MULTI_TEAM_STAFF_ROLE_KEYS.has(targetUser.role.key)) throw new Error("staffTeamsMustBeManagedFromStaffProfile");

  await db.$transaction(async (tx) => {
    if (TEAM_SCOPED_COACH_ROLE_KEYS.has(targetUser.role.key)) {
      const existingTeamAssignments = await tx.userTeam.count({ where: { userId: targetUserId } });
      const alreadyAssigned = await tx.userTeam.findUnique({
        where: { userId_teamId: { userId: targetUserId, teamId: parsed.teamId } },
        select: { teamId: true }
      });
      if (existingTeamAssignments > 0 && !alreadyAssigned) throw new Error("coachMustHaveOneTeam");
    }
    await tx.userTeam.upsert({
      where: { userId_teamId: { userId: targetUserId, teamId: parsed.teamId } },
      create: { userId: targetUserId, teamId: parsed.teamId },
      update: {} // already assigned — safe no-op
    });
    await tx.user.update({ where: { id: targetUserId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } });
    await writeAuditLog({
      userId: actor.id,
      action: "user.team_assignment.add",
      entityType: "UserTeam",
      entityId: targetUserId,
      changes: { teamId: parsed.teamId }
    }, tx);
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

export async function removeUserTeamAction(userId: string, teamId: string) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);

  const targetUser = await db.user.findFirstOrThrow({
    where: { id: targetUserId, deletedAt: null },
    select: { id: true, role: { select: { key: true } } }
  });
  const linkedStaff = await db.staff.findUnique({ where: { userId: targetUserId }, select: { id: true } });
  if (linkedStaff && !MULTI_TEAM_STAFF_ROLE_KEYS.has(targetUser.role.key)) throw new Error("staffTeamsMustBeManagedFromStaffProfile");

  await db.$transaction(async (tx) => {
    await tx.userTeam.deleteMany({ where: { userId: targetUserId, teamId } });
    await tx.user.update({ where: { id: targetUserId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } });
    await writeAuditLog({
      userId: actor.id,
      action: "user.team_assignment.remove",
      entityType: "UserTeam",
      entityId: targetUserId,
      changes: { teamId }
    }, tx);
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

export async function terminateSessionAction(userId: string, _formData?: FormData): Promise<void> {
  const { terminateUserSession } = await import("@/lib/security/session-manager");
  await terminateUserSession(await resolveUserId(userId));
}
