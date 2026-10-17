import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createLoginChallenge, recordCaptchaAuditEvent, redeemLoginChallenge } from "@/lib/security/cap-captcha";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const { action } = await context.params;
  try {
    if (action === "challenge") {
      const challenge = await createLoginChallenge(request);
      if (!challenge) {
        return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    if (action === "redeem") {
      const address = request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
      const addressHash = createHash("sha256").update(address.slice(0, 128)).digest("hex");
      const requestLimit = await checkRateLimit({ key: `cap:redeem-ip:${addressHash}`, limit: 60, windowMs: 10 * 60 * 1000 });
      if (!requestLimit.allowed) {
        await recordCaptchaAuditEvent("rate_limited");
        return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
      }

      const bodyText = await request.text();
      if (bodyText.length > 512_000) {
        await recordCaptchaAuditEvent("challenge_rejected");
        return NextResponse.json({ success: false, error: "invalid_challenge" }, { status: 413 });
      }
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        await recordCaptchaAuditEvent("challenge_rejected");
        return NextResponse.json({ success: false, error: "invalid_challenge" }, { status: 400 });
      }

      const result = await redeemLoginChallenge(body);
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  } catch {
    await recordCaptchaAuditEvent("unavailable");
    return NextResponse.json({ success: false, error: "captcha_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
