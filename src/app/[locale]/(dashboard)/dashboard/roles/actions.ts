"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/role";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createRoleAction(formData: FormData) {
  const actor = await requirePermission("roles.manage");
  const raw = Object.fromEntries(formData.entries());
  const parsed = createRoleSchema.parse(raw);

  const existing = await db.role.findUnique({ where: { key: parsed.key } });
  if (existing) throw new Error("keyTaken");

  const role = await db.role.create({ data: { key: parsed.key, name: parsed.name, description: parsed.description, isSystem: false } });

  await writeAuditLog({ userId: actor.id, action: "role.create", entityType: "Role", entityId: role.id, changes: { after: parsed } });
  revalidatePath("/[locale]/dashboard/roles", "page");
  return { id: role.id };
}

export async function updateRoleAction(roleId: string, formData: FormData) {
  const actor = await requirePermission("roles.manage");
  const before = await db.role.findUniqueOrThrow({ where: { id: roleId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateRoleSchema.parse(raw);

  const role = await db.role.update({ where: { id: roleId }, data: { name: parsed.name, description: parsed.description } });

  await writeAuditLog({ userId: actor.id, action: "role.update", entityType: "Role", entityId: role.id, changes: { before, after: parsed } });
  revalidatePath("/[locale]/dashboard/roles", "page");
  revalidatePath(`/[locale]/dashboard/roles/${roleId}`, "page");
}

// Replaces a role's full permission set. Every currently-logged-in user
// with this role has their sessions invalidated (permissions are frozen
// into the JWT at login — see lib/auth.ts), so a permission change takes
// effect immediately instead of silently waiting for token expiry.
export async function updateRolePermissionsAction(roleId: string, formData: FormData) {
  const actor = await requirePermission("roles.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id: roleId } });

  let selectedKeys = formData.getAll("permissionKeys").map(String);
  // Safety guard: super_admin's "*" wildcard must never be strippable from
  // the UI, or an admin could accidentally lock every super-admin account
  // out of the whole platform at once.
  if (role.key === "super_admin" && !selectedKeys.includes("*")) {
    selectedKeys = [...selectedKeys, "*"];
  } else if (role.key !== "super_admin") {
    // A crafted form request must not grant the super-admin wildcard to a
    // regular role, even if the UI is bypassed.
    selectedKeys = selectedKeys.filter((key) => key !== "*");
  }
  const permissions = await db.permission.findMany({ where: { key: { in: selectedKeys } } });
  const actorSessionWillBeRevoked = role.key === actor.roleKey;

  // Use an interactive transaction: db is a lazy Prisma proxy that resolves
  // model methods to ordinary Promises, so Prisma's array/PrismaPromise form
  // cannot safely be used here. Keep permissions, token revocation and audit
  // record atomic so a partial update can never leave mixed authorization.
  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })) });
    }
    await tx.user.updateMany({ where: { roleId }, data: { tokenVersion: { increment: 1 } } });
    await writeAuditLog({
      userId: actor.id,
      action: "role.permissions_update",
      entityType: "Role",
      entityId: roleId,
      changes: { after: { permissionKeys: selectedKeys } }
    }, tx);
  });

  // If the actor belongs to this role, the update deliberately revokes their
  // old JWT. Redirect to sign-in rather than re-rendering a now-forbidden page
  // and showing Next.js's generic Server Component error screen.
  if (!actorSessionWillBeRevoked) revalidatePath(`/[locale]/dashboard/roles/${roleId}`, "page");
  return { actorSessionWillBeRevoked };
}

export async function deleteRoleAction(roleId: string) {
  const actor = await requirePermission("roles.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id: roleId }, include: { users: true } });
  if (role.isSystem) throw new Error("cannotDeleteSystemRole");
  if (role.users.length > 0) throw new Error("roleInUse");

  await db.role.delete({ where: { id: roleId } });

  await writeAuditLog({ userId: actor.id, action: "role.delete", entityType: "Role", entityId: roleId });
  revalidatePath("/[locale]/dashboard/roles", "page");
}
