import "server-only";
import { db } from "@/lib/db";
import { getPushRuntimeEnv, isAllowedPushEndpoint } from "@/lib/push/match-push";
import { sendNativePush } from "@/lib/push/firebase-native-push";

type MeetingPushInput = { title: string; startDateTime: Date; location: string | null; teamId?: string | null };

/** Sends meeting alerts only to devices linked to active users who can manage the club calendar. */
export async function notifyCalendarManagersOfMeeting(meeting: MeetingPushInput): Promise<void> {
  const env = await getPushRuntimeEnv();

  const users = await db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { role: { permissions: { some: { permission: { key: "meetings.view" } } } } },
        { role: { teamScoped: false, permissions: { some: { permission: { key: "calendar.manage" } } } } },
        { role: { key: "super_admin", permissions: { some: { permission: { key: "*" } } } } }
      ]
    },
    select: { id: true, role: { select: { key: true, teamScoped: true } }, teamAssignments: { select: { teamId: true } } }
  });
  if (users.length === 0) return;

  const eligibleUsers = users.filter((user) => !user.role.teamScoped || Boolean(meeting.teamId && user.teamAssignments.some((assignment) => assignment.teamId === meeting.teamId)));
  const userIds = eligibleUsers.map((user) => user.id);
  if (userIds.length === 0) return;
  const nativeDevices = await db.nativePushDevice.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, fcmToken: true, locale: true } });
  const nativeUsers = new Map(eligibleUsers.map((user) => [user.id, user]));
  const nativeMessages = nativeDevices.flatMap((device) => {
    if (!nativeUsers.has(device.userId)) return [];
    const isFrench = device.locale === "fr";
    const date = new Intl.DateTimeFormat(isFrench ? "fr-FR" : "ar-DZ", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Algiers"
    }).format(meeting.startDateTime);
    return [{
      token: device.fcmToken,
      title: isFrench ? "📅 Réunion à venir" : "📅 اجتماع قادم",
      body: `${meeting.title}\n${date}${meeting.location ? ` · ${meeting.location}` : ""}`,
      section: "meetings"
    }];
  });
  try {
    const nativeResult = await sendNativePush(nativeMessages);
    if (!nativeResult.configured && nativeMessages.length) console.error("[AdminMeetingPush] Native meeting notifications were skipped: FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    if (nativeResult.failed) console.error(`[AdminMeetingPush] ${nativeResult.failed} native notification(s) failed.`);
  } catch (error) {
    console.error("[AdminMeetingPush] Native notifications failed.", error);
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true }
  });
  const targets = subscriptions.filter((subscription) => isAllowedPushEndpoint(subscription.endpoint));
  if (targets.length === 0 || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;

  const { buildPushPayload } = await import("@block65/webcrypto-web-push");
  const results = await Promise.allSettled(targets.map(async (subscription) => {
    const isFrench = subscription.locale === "fr";
    const date = new Intl.DateTimeFormat(isFrench ? "fr-FR" : "ar-DZ", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Algiers"
    }).format(meeting.startDateTime);
    const payload = buildPushPayload({
      data: JSON.stringify({
        title: isFrench ? "📅 Réunion à venir" : "📅 اجتماع قادم",
        body: `${meeting.title}\n${date}${meeting.location ? ` · ${meeting.location}` : ""}`,
        tag: `meeting-${meeting.startDateTime.getTime()}`,
        url: `/${isFrench ? "fr" : "ar"}/dashboard/calendar`
      }),
      options: { ttl: 60 * 60 * 24, urgency: "high" }
    }, {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth }
    }, {
      subject: env.VAPID_SUBJECT!,
      publicKey: env.VAPID_PUBLIC_KEY!,
      privateKey: env.VAPID_PRIVATE_KEY!
    });

    const response = await fetch(subscription.endpoint, { ...payload, redirect: "manual" });
    if (response.status === 404 || response.status === 410) {
      await db.pushSubscription.delete({ where: { id: subscription.id } });
      return;
    }
    if (!response.ok) throw new Error(`Push provider returned HTTP ${response.status}.`);
  }));

  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) console.error(`[AdminMeetingPush] ${failed} of ${targets.length} meeting alert(s) failed.`);
}
