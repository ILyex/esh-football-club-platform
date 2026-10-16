import { z } from "zod";
import { getPushRuntimeEnv, fanoutMatchPush, deliverMatchPush } from "@/lib/push/match-push";

const messageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fanout"), outboxId: z.string().min(8).max(64) }),
  z.object({ kind: z.literal("delivery"), outboxId: z.string().min(8).max(64), subscriptionId: z.string().min(8).max(64) })
]);

function constantTimeEqual(actual: string, expected: string): boolean {
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);
  if (!expected || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function POST(request: Request) {
  const env = await getPushRuntimeEnv();
  const auth = request.headers.get("authorization") ?? "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.CRON_SECRET || !constantTimeEqual(supplied, env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_message" }, { status: 400 });
  try {
    if (parsed.data.kind === "fanout") await fanoutMatchPush(parsed.data.outboxId);
    else await deliverMatchPush(parsed.data.outboxId, parsed.data.subscriptionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[MatchPush] Queue message will be retried.", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "push_processing_failed" }, { status: 503 });
  }
}
