import { getPushRuntimeEnv } from "@/lib/push/match-push";

export async function GET() {
  const env = await getPushRuntimeEnv();
  return Response.json({ enabled: Boolean(env.VAPID_PUBLIC_KEY), publicKey: env.VAPID_PUBLIC_KEY ?? null }, {
    headers: { "Cache-Control": "no-store" }
  });
}
