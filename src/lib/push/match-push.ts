import "server-only";
import type { Prisma, TeamCategory } from "@prisma/client";

import { db } from "@/lib/db";
import { sendNativePush } from "@/lib/push/firebase-native-push";

type QueueMessage = { kind: "fanout"; outboxId: string } | { kind: "delivery"; outboxId: string; subscriptionId: string };
type QueueBinding = {
  send(message: QueueMessage): Promise<unknown>;
  sendBatch(messages: Array<{ body: QueueMessage }>): Promise<unknown>;
};
type RuntimeEnv = {
  GOAL_PUSH_QUEUE?: QueueBinding;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  CRON_SECRET?: string;
};

export async function getPushRuntimeEnv(): Promise<RuntimeEnv> {
  if (process.env.DENO_DEPLOY !== "true" && process.env.DEPLOY_TARGET === "cloudflare") {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const context = await getCloudflareContext({ async: true });
      return context.env as unknown as RuntimeEnv;
    } catch {
      // Fall through to standard environment variables outside a Worker request.
    }
  }
  return {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    CRON_SECRET: process.env.CRON_SECRET
  };
}

export async function createMatchPushOutbox(
  tx: Pick<Prisma.TransactionClient, "matchPushOutbox">,
  input: {
    dedupKey: string;
    matchId: string;
    matchEventId?: string | null;
    kind: "MATCH_STARTED" | "GOAL" | "MATCH_FINISHED";
    payload: Record<string, string | number | null>;
  }
) {
  return tx.matchPushOutbox.upsert({
    where: { dedupKey: input.dedupKey },
    update: {},
    create: {
      ...input,
      matchEventId: input.matchEventId ?? null,
      payload: input.payload
    },
    select: { id: true }
  });
}

async function queueOutbox(outboxId: string, force = false): Promise<boolean> {
  const env = await getPushRuntimeEnv();
  if (!env.GOAL_PUSH_QUEUE) return false;

  const now = new Date();
  const claimed = await db.matchPushOutbox.updateMany({
    where: {
      id: outboxId,
      OR: [
        { queuedAt: null },
        ...(force ? [{ queuedAt: { lt: new Date(now.getTime() - 2 * 60_000) } }] : [])
      ]
    },
    data: { queuedAt: now }
  });
  if (!claimed.count) return true;

  try {
    await env.GOAL_PUSH_QUEUE.send({ kind: "fanout", outboxId });
    return true;
  } catch (error) {
    await db.matchPushOutbox.updateMany({ where: { id: outboxId, queuedAt: now }, data: { queuedAt: null } });
    console.error("[MatchPush] Queue publish failed; outbox remains available for retry.", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export async function enqueueMatchPushOutbox(outboxId: string): Promise<void> {
  try {
    await queueOutbox(outboxId);
  } catch (error) {
    // The domain mutation and outbox record already committed together. A
    // transient dispatch problem must not tell the operator that the match
    // save failed; the scheduled flush retries unqueued outbox rows.
    console.error("[MatchPush] Outbox dispatch deferred for scheduled retry.", error instanceof Error ? error.message : "unknown error");
  }
}

/** Recovery path for a publish failure or a producer interruption after commit. */
export async function flushPendingMatchPushOutbox(limit = 20): Promise<number> {
  const staleBefore = new Date(Date.now() - 2 * 60_000);
  const pending = await db.matchPushOutbox.findMany({
    where: { OR: [{ queuedAt: null }, { queuedAt: { lt: staleBefore } }] },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: { id: true }
  });
  const env = await getPushRuntimeEnv();
  if (!env.GOAL_PUSH_QUEUE) {
    let processed = 0;
    for (const outbox of pending) {
      const claimedAt = new Date();
      const claim = await db.matchPushOutbox.updateMany({
        where: { id: outbox.id, OR: [{ queuedAt: null }, { queuedAt: { lt: staleBefore } }] },
        data: { queuedAt: claimedAt }
      });
      if (!claim.count) continue;
      try {
        await fanoutMatchPush(outbox.id);
        processed++;
      } catch (error) {
        await db.matchPushOutbox.updateMany({ where: { id: outbox.id, queuedAt: claimedAt }, data: { queuedAt: null } });
        console.error("[MatchPush] Database-backed delivery failed; outbox remains available for retry.", error instanceof Error ? error.message : "unknown error");
      }
    }
    return processed;
  }

  let enqueued = 0;
  for (const outbox of pending) {
    if (await queueOutbox(outbox.id, true)) enqueued++;
  }
  return enqueued;
}

const PUSH_ENDPOINT_HOSTS = [
  "fcm.googleapis.com",
  "fcm-xmpp.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "web.push.apple.com"
];

export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const hostname = url.hostname.toLowerCase();
    return PUSH_ENDPOINT_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function fanoutMatchPush(outboxId: string): Promise<void> {
  const [outbox, env] = await Promise.all([
    db.matchPushOutbox.findUnique({ where: { id: outboxId }, select: { id: true, kind: true, payload: true } }),
    getPushRuntimeEnv()
  ]);
  if (!outbox) return;
  const payload = outbox.payload as { category?: string; teamId?: string };
  const subscribers = await db.pushSubscription.findMany({
    where: { categories: { some: { category: payload.category as TeamCategory } } },
    select: { id: true }
  });

  // Native app devices are independent of Web Push subscriptions. Restrict
  // alerts to active match operators and enforce team-scoped role assignments.
  const devices = await db.nativePushDevice.findMany({
    where: {
      user: {
        isActive: true,
        deletedAt: null,
        role: {
          key: { in: ["super_admin", "president", "developer", "director", "sporting_director", "team_manager"] },
          OR: [
            { permissions: { some: { permission: { key: "*" } } } },
            {
              AND: [
                { permissions: { some: { permission: { key: "matches.view" } } } },
                { permissions: { some: { permission: { key: { in: ["matches.update", "matches.report"] } } } } }
              ]
            }
          ]
        }
      }
    },
    select: {
      fcmToken: true,
      locale: true,
      user: { select: { role: { select: { teamScoped: true, key: true } }, teamAssignments: { select: { teamId: true } } } }
    }
  });
  const nativeMessages = devices.flatMap((device) => {
    const role = device.user.role;
    const canAccessTeam = role.key === "super_admin" || !role.teamScoped || Boolean(payload.teamId && device.user.teamAssignments.some((assignment) => assignment.teamId === payload.teamId));
    if (!canAccessTeam) return [];
    const localized = buildNotification(outbox, device.locale);
    return [{ token: device.fcmToken, title: localized.title, body: localized.body, section: "matches", tag: localized.tag }];
  });
  if (nativeMessages.length) {
    const nativeResult = await sendNativePush(nativeMessages);
    if (!nativeResult.configured) {
      console.error("[MatchPush] Native match notifications were skipped: FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    } else if (nativeResult.failed) {
      throw new Error(`${nativeResult.failed} native match notification(s) failed.`);
    }
  }

  const batchSize = 100;
  for (let start = 0; start < subscribers.length; start += batchSize) {
    const batch = subscribers.slice(start, start + batchSize);
    if (!env.GOAL_PUSH_QUEUE) {
      // Deno Deploy has no managed queue. The durable outbox row is the queue;
      // delivery records make retries idempotent if a batch partially fails.
      const outcomes = await Promise.allSettled(batch.map(({ id }) => deliverMatchPush(outboxId, id)));
      if (outcomes.some((outcome) => outcome.status === "rejected")) {
        throw new Error("One or more database-backed push deliveries failed.");
      }
      continue;
    }
    const messages = batch.map(({ id }) => ({
      body: { kind: "delivery" as const, outboxId, subscriptionId: id }
    }));
    await env.GOAL_PUSH_QUEUE.sendBatch(messages);
  }
}

const CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  SENIOR: { ar: "الأكابر", fr: "Séniors" },
  U20: { ar: "U20", fr: "U20" },
  U17: { ar: "U17", fr: "U17" },
  U15: { ar: "U15", fr: "U15" }
};

function buildNotification(outbox: {
  id: string;
  kind: string;
  payload: unknown;
}, locale: string) {
  const payload = outbox.payload as {
    matchId: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number | null;
    awayScore: number | null;
    minute?: number | null;
    side?: "HOME" | "AWAY";
    category?: string;
  };
  const isAr = locale === "ar";
  const teamLabel = CATEGORY_LABELS[payload.category ?? "SENIOR"]?.[isAr ? "ar" : "fr"] ?? payload.category ?? "";
  const home = payload.homeTeamName;
  const away = payload.awayTeamName;
  const score = `${payload.homeScore ?? 0} – ${payload.awayScore ?? 0}`;
  let title: string;
  let body: string;

  if (outbox.kind === "MATCH_STARTED") {
    title = isAr ? "بدأت المباراة ⚽" : "Le match commence ⚽";
    body = `${home} ${score} ${away} · ${teamLabel}`;
  } else if (outbox.kind === "MATCH_FINISHED") {
    title = isAr ? "انتهت المباراة 🏁" : "Match terminé 🏁";
    body = `${home} ${score} ${away} · ${teamLabel}`;
  } else {
    const scoringTeam = payload.side === "HOME" ? home : away;
    title = isAr ? "هدف جديد ⚽" : "Nouveau but ⚽";
    body = isAr
      ? `${scoringTeam} · ${home} ${score} ${away}${payload.minute != null ? ` · الدقيقة ${payload.minute}` : ""}`
      : `${scoringTeam} · ${home} ${score} ${away}${payload.minute != null ? ` · ${payload.minute}e` : ""}`;
  }

  return {
    title,
    body,
    url: `/${isAr ? "ar" : "fr"}/matches/${encodeURIComponent(payload.matchId)}`,
    tag: `esh-match-${outbox.id}`
  };
}

export async function deliverMatchPush(outboxId: string, subscriptionId: string): Promise<void> {
  const [outbox, subscription, env] = await Promise.all([
    db.matchPushOutbox.findUnique({ where: { id: outboxId }, select: { id: true, kind: true, payload: true } }),
    db.pushSubscription.findUnique({ where: { id: subscriptionId } }),
    getPushRuntimeEnv()
  ]);
  if (!outbox || !subscription) return;
  const priorDelivery = await db.matchPushDelivery.findUnique({
    where: { outboxId_subscriptionId: { outboxId, subscriptionId } },
    select: { id: true }
  });
  if (priorDelivery) return;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("Web Push VAPID keys are not configured.");
  }
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    await db.pushSubscription.delete({ where: { id: subscriptionId } });
    return;
  }

  const { buildPushPayload } = await import("@block65/webcrypto-web-push");
  const notification = buildNotification(outbox, subscription.locale);
  const pushPayload = await buildPushPayload({
    data: JSON.stringify(notification),
    options: { ttl: 90, urgency: "high", topic: outbox.id.slice(-32) }
  }, {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth }
  }, {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  });

  const response = await fetch(subscription.endpoint, { ...pushPayload, redirect: "manual" });
  if (response.status === 404 || response.status === 410) {
    await db.pushSubscription.delete({ where: { id: subscriptionId } });
    return;
  }
  if (!response.ok) throw new Error(`Push provider returned HTTP ${response.status}.`);

  try {
    await db.matchPushDelivery.create({ data: { outboxId, subscriptionId } });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
  }
}
