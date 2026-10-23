"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import {
  generatePublicStorageKey,
  isPublicStorageConfigured,
  uploadPublicFile,
  validateUploadedImage
} from "@/lib/storage";
import { revalidatePath } from "next/cache";

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

export async function changeOwnPhotoAction(formData: FormData): Promise<never> {
  const actor = await getSessionOrThrow();
  const locale = String(formData.get("locale") ?? "ar") === "fr" ? "fr" : "ar";
  const accountPath = `/${locale}/dashboard/account`;
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) redirect(`${accountPath}?photoError=required`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    let image: string;
    if (isPublicStorageConfigured()) {
      image = await uploadPublicFile({ key: generatePublicStorageKey("users", ext), buffer, mimeType: mime });
    } else {
      if (buffer.byteLength > 700 * 1024) redirect(`${accountPath}?photoError=too_large`);
      image = `data:${mime};base64,${buffer.toString("base64")}`;
    }

    await db.user.update({ where: { id: actor.id }, data: { image } });
    await writeAuditLog({
      userId: actor.id,
      action: "user.photo_changed",
      entityType: "User",
      entityId: actor.id,
      changes: { after: { hasImage: true } }
    });
    revalidatePath("/[locale]/dashboard/account", "page");
    revalidatePath("/[locale]/dashboard", "layout");
    redirect(`${accountPath}?photo=saved`);
  } catch (error) {
    // Next redirects throw internally; allow successful redirects to pass through.
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    redirect(`${accountPath}?photoError=invalid`);
  }
}
