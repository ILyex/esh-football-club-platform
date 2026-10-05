"use server";

import { db } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/permissions";

/** Record authenticated dashboard activity, throttled to one write per minute per user. */
export async function updatePresenceAction(): Promise<void> {
  const user = await getSessionOrThrow();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 60_000);

  await db.user.updateMany({
    where: {
      id: user.id,
      isActive: true,
      deletedAt: null,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }]
    },
    data: { lastSeenAt: now }
  });
}

/** Clear presence immediately on explicit logout. */
export async function clearPresenceAction(): Promise<void> {
  const user = await getSessionOrThrow();
  await db.user.updateMany({
    where: { id: user.id, deletedAt: null },
    data: { lastSeenAt: null }
  });
}
