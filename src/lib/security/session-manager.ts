import "server-only";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ForbiddenError, isProgrammer, requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

/**
 * Instantly revokes all active sessions / JWT tokens for the specified user
 * by incrementing `tokenVersion`.
 */
export async function terminateUserSession(userId: string) {
  const actor = await requirePermission("users.manage");
  if (!isProgrammer(actor)) throw new ForbiddenError("developer_only");

  if (actor.id === userId) throw new Error("cannotTerminateOwnSession");

  const newTokenVersion = await db.$transaction(async (tx) => {
    const targetUser = await tx.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { id: true, email: true, name: true, tokenVersion: true }
    });

    if (!targetUser) throw new Error("activeUserNotFound");

    const updated = await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 }, lastSeenAt: null }
    });

    await writeAuditLog({
      userId: actor.id,
      action: "security.session.terminated",
      entityType: "User",
      entityId: userId,
      changes: {
        targetEmail: targetUser.email,
        targetName: targetUser.name,
        previousTokenVersion: targetUser.tokenVersion,
        newTokenVersion: updated.tokenVersion,
        terminatedBy: actor.email,
        timestamp: new Date().toISOString()
      }
    }, tx);

    return updated.tokenVersion;
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(`/[locale]/dashboard/users/${userId}`, "page");
  revalidatePath("/[locale]/dashboard/audit-logs", "page");

  return { success: true, tokenVersion: newTokenVersion };
}
