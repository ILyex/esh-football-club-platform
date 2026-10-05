"use server";

import { db } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function markNotificationReadAction(notificationId: string) {
  const user = await getSessionOrThrow();
  await db.notification.updateMany({ where: { id: notificationId, userId: user.id }, data: { isRead: true } });
  revalidatePath("/[locale]/dashboard/notifications", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await getSessionOrThrow();
  await db.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
  revalidatePath("/[locale]/dashboard/notifications", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}
