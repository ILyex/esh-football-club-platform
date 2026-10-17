import { z } from "zod";
import { db } from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { getPushRuntimeEnv, isAllowedPushEndpoint, sha256Hex } from "@/lib/push/match-push";

const subscriptionSchema = z.object({
  locale: z.enum(["ar", "fr"]),
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
      auth: z.string().regex(/^[A-Za-z0-9_-]{20,32}$/)
    })
  })
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

async function getFieldOperator() {
  const user = await requirePermission("matches.view");
  if (!hasPermission(user, "matches.update") && !hasPermission(user, "matches.report")) {
    return null;
  }
  return user;
}

export async function GET() {
  const [user, env] = await Promise.all([getFieldOperator(), getPushRuntimeEnv()]);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const subscriptions = await db.pushSubscription.findMany({ where: { userId: user.id }, select: { endpointHash: true } });
  return Response.json({
    enabled: Boolean(env.VAPID_PUBLIC_KEY),
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
    endpointHashes: subscriptions.map((subscription) => subscription.endpointHash)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await getFieldOperator();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_288) return Response.json({ error: "payload_too_large" }, { status: 413 });

  const env = await getPushRuntimeEnv();
  if (!env.VAPID_PUBLIC_KEY) return Response.json({ error: "push_unavailable" }, { status: 503 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.subscription.endpoint)) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data.subscription;
  const endpointHash = await sha256Hex(endpoint);
  const existing = await db.pushSubscription.findUnique({
    where: { endpointHash },
    select: { id: true, userId: true, ownerTokenHash: true }
  });
  if (existing?.userId && existing.userId !== user.id) {
    return Response.json({ error: "subscription_owned_by_another_user" }, { status: 409 });
  }

  const ownerTokenHash = existing?.ownerTokenHash ?? await sha256Hex(`esh-admin-push:${user.id}:${endpointHash}`);
  if (existing) {
    await db.pushSubscription.update({
      where: { id: existing.id },
      data: { endpoint, p256dh: keys.p256dh, auth: keys.auth, locale: parsed.data.locale, userId: user.id }
    });
  } else {
    await db.pushSubscription.create({
      data: { endpoint, endpointHash, p256dh: keys.p256dh, auth: keys.auth, ownerTokenHash, locale: parsed.data.locale, userId: user.id }
    });
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await getFieldOperator();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = z.object({ endpoint: z.string().url().max(2048) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) return Response.json({ error: "invalid_subscription" }, { status: 400 });
  await db.pushSubscription.updateMany({ where: { userId: user.id, endpointHash: await sha256Hex(parsed.data.endpoint) }, data: { userId: null } });
  return new Response(null, { status: 204 });
}
