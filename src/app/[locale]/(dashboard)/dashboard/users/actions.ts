"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
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
      image: photoUrl || null
    }
  });

  // Never log the password itself — spec section 12/5: audit logs must not contain secrets.
  await writeAuditLog({
    userId: actor.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    changes: { after: { name: parsed.name, email: parsed.email, roleId: parsed.roleId, hasImage: Boolean(photoUrl) } }
  });
  revalidatePath("/[locale]/dashboard/users", "page");
  return { id: user.id };
}

export async function updateUserAction(userId: string, formData: FormData) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);
  const before = await db.user.findFirstOrThrow({ where: { id: targetUserId, deletedAt: null } });

  const raw = Object.fromEntries(formData.entries());
  const { photo, removePhoto, ...schemaInput } = raw;
  const parsed = updateUserSchema.parse(schemaInput);

  const selectedRole = await db.role.findUniqueOrThrow({ where: { id: parsed.roleId }, select: { key: true } });
  if (selectedRole.key === "super_admin" && actor.roleKey !== "super_admin") {
    throw new Error("superAdminAssignmentRestricted");
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
  const roleOrActiveChanged = parsed.roleId !== before.roleId || parsed.isActive !== before.isActive;

  // Safety guard: never allow the last active super_admin to be demoted or
  // deactivated through this form — that would lock every administrator
  // out of the platform with no way back in through the UI.
  if (roleOrActiveChanged) {
    const beforeRole = await db.role.findUnique({ where: { id: before.roleId } });
    const losingSuperAdmin = beforeRole?.key === "super_admin" && (parsed.roleId !== before.roleId || !parsed.isActive);
    if (losingSuperAdmin) {
      const otherActiveSuperAdmins = await db.user.count({
        where: { id: { not: targetUserId }, isActive: true, role: { key: "super_admin" } }
      });
      if (otherActiveSuperAdmins === 0) throw new Error("lastSuperAdmin");
    }
  }

  const shouldRemovePhoto = formData.get("removePhoto") === "1" || formData.get("removePhoto") === "true";
  const newPhotoUrl = await extractUserPhoto(formData);

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

  const user = await db.user.update({
    where: { id: targetUserId },
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      roleId: parsed.roleId,
      isActive: parsed.isActive,
      image: nextImage,
      ...(roleOrActiveChanged ? { tokenVersion: { increment: 1 }, lastSeenAt: null } : {})
    }
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.update",
    entityType: "User",
    entityId: user.id,
    changes: {
      before: { name: before.name, email: before.email, roleId: before.roleId, isActive: before.isActive, hasImage: Boolean(before.image) },
      after: { ...parsed, hasImage: Boolean(nextImage) }
    }
  });
  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

/**
 * Remove an account from the system while preserving its linked audit and
 * financial history. PII is scrubbed and tokenVersion revokes issued JWTs.
 */
export async function deleteUserAction(userId: string) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);
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
  const user = await db.user.findFirstOrThrow({ where: { id: targetUserId, deletedAt: null } });
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
  const actor = await requirePermission("users.manage");
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

  await db.user.findFirstOrThrow({ where: { id: targetUserId, deletedAt: null }, select: { id: true } });

  await db.$transaction([
    db.userTeam.upsert({
      where: { userId_teamId: { userId: targetUserId, teamId: parsed.teamId } },
      create: { userId: targetUserId, teamId: parsed.teamId },
      update: {} // already assigned — safe no-op
    }),
    db.user.update({ where: { id: targetUserId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } })
  ]);

  await writeAuditLog({
    userId: actor.id,
    action: "user.team_assignment.add",
    entityType: "UserTeam",
    entityId: targetUserId,
    changes: { teamId: parsed.teamId }
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

export async function removeUserTeamAction(userId: string, teamId: string) {
  const actor = await requirePermission("users.manage");
  const targetUserId = await resolveUserId(userId);

  await db.user.findFirstOrThrow({ where: { id: targetUserId, deletedAt: null }, select: { id: true } });

  await db.$transaction([
    db.userTeam.deleteMany({ where: { userId: targetUserId, teamId } }),
    db.user.update({ where: { id: targetUserId }, data: { tokenVersion: { increment: 1 }, lastSeenAt: null } })
  ]);

  await writeAuditLog({
    userId: actor.id,
    action: "user.team_assignment.remove",
    entityType: "UserTeam",
    entityId: targetUserId,
    changes: { teamId }
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
}

export async function terminateSessionAction(userId: string, _formData?: FormData): Promise<void> {
  const { terminateUserSession } = await import("@/lib/security/session-manager");
  await terminateUserSession(await resolveUserId(userId));
}
