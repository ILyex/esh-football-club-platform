"use server";

import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { syncGmailInbox } from "@/lib/integrations/gmail/service";
import { db } from "@/lib/db";

export async function syncMailboxForNotifications() {
  const user = await getSessionOrThrow();
  if (!hasPermission(user, "mail.view")) {
    return { newMessagesCount: 0, recentMessagesCount: 0, recentNotificationIds: [] as string[] };
  }

  let newMessagesCount = 0;
  let recentMessagesCount = 0;
  try {
    const result = await syncGmailInbox(user.id);
    newMessagesCount = result.newMessagesCount;
    recentMessagesCount = result.recentMessagesCount ?? 0;
  } catch {
    // The existing notification center remains available if Gmail is temporarily unavailable.
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const recentNotifications = await db.notification.findMany({
    where: {
      userId: user.id,
      type: "NEW_CORRESPONDENCE",
      isRead: false,
      createdAt: { gte: cutoff }
    },
    select: { id: true }
  });

  return {
    newMessagesCount,
    recentMessagesCount,
    recentNotificationIds: recentNotifications.map((notification) => notification.id)
  };
}
