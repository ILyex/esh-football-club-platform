"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";

export async function changeOwnPasswordAction(formData: FormData): Promise<never> {
  const actor = await getSessionOrThrow();
  const locale = String(formData.get("locale") ?? "ar") === "fr" ? "fr" : "ar";
  const accountPath = `/${locale}/dashboard/account`;
  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    redirect(`${accountPath}?error=${mismatch ? "password_mismatch" : "password_invalid"}`);
  }

  const limit = await checkRateLimit({ key: `password:change:${actor.id}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) redirect(`${accountPath}?error=too_many_attempts`);

  const currentUser = await db.user.findFirst({
    where: { id: actor.id, isActive: true, deletedAt: null },
    select: { id: true, passwordHash: true }
  });
  if (!currentUser || !(await bcrypt.compare(parsed.data.currentPassword, currentUser.passwordHash))) {
    await writeAuditLog({ userId: actor.id, action: "auth.password_change_failed", entityType: "User", entityId: actor.id });
    redirect(`${accountPath}?error=current_password_invalid`);
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: currentUser.id },
      data: { passwordHash, tokenVersion: { increment: 1 }, lastSeenAt: null }
    });
    await writeAuditLog({ userId: actor.id, action: "auth.password_changed", entityType: "User", entityId: actor.id }, tx);
  });

  // Revoke all sessions, including this one, so the new credential takes
  // effect everywhere. The login page confirms the change after re-auth.
  redirect(`/${locale}/login?passwordChanged=1`);
}
