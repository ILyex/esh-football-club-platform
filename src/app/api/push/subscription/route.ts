import { TeamCategory } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPushRuntimeEnv, isAllowedPushEndpoint, sha256Hex } from "@/lib/push/match-push";
import { checkRateLimit } from "@/lib/rate-limit";

const subscriptionSchema = z.object({
  deviceToken: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
  locale: z.enum(["ar", "fr"]),
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
      auth: z.string().regex(/^[A-Za-z0-9_-]{20,32}$/)
    })
  })
});

const deleteSchema = z.object({
  deviceToken: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
  endpoint: z.string().url().max(2048)
});

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_288) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const sourceAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitKey = await sha256Hex(sourceAddress);
  const rateLimit = await checkRateLimit({ key: `push-subscribe:${rateLimitKey}`, limit: 15, windowMs: 60_000 });
  if (!rateLimit.allowed) return Response.json({ error: "rate_limited" }, { status: 429 });
  const env = await getPushRuntimeEnv();
  if (!env.VAPID_PUBLIC_KEY) return Response.json({ error: "push_unavailable" }, { status: 503 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.subscription.endpoint)) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const { subscription, deviceToken, locale } = parsed.data;
  const [endpointHash, ownerTokenHash] = await Promise.all([
    sha256Hex(subscription.endpoint),
    sha256Hex(deviceToken)
  ]);
  const existing = await db.pushSubscription.findUnique({ where: { endpointHash }, select: { id: true, ownerTokenHash: true } });
  if (existing && existing.ownerTokenHash !== ownerTokenHash) {
    return Response.json({ error: "subscription_owned_by_another_device" }, { status: 409 });
  }

  const categories = Object.values(TeamCategory).map((category) => ({ category }));
  if (existing) {
    await db.$transaction([
      db.pushSubscription.update({
        where: { id: existing.id },
        data: { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, locale }
      }),
      db.pushSubscriptionCategory.deleteMany({ where: { subscriptionId: existing.id } }),
      db.pushSubscriptionCategory.createMany({ data: categories.map((row) => ({ ...row, subscriptionId: existing.id })) })
    ]);
  } else {
    await db.pushSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        endpointHash,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ownerTokenHash,
        locale,
        categories: { create: categories }
      }
    });
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }
  const [endpointHash, ownerTokenHash] = await Promise.all([
    sha256Hex(parsed.data.endpoint),
    sha256Hex(parsed.data.deviceToken)
  ]);
  await db.pushSubscription.deleteMany({ where: { endpointHash, ownerTokenHash } });
  return new Response(null, { status: 204 });
}
