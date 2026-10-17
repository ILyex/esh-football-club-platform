import { NextResponse } from "next/server";
import { createLoginChallenge, redeemLoginChallenge } from "@/lib/security/cap-captcha";

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
      const bodyText = await request.text();
      if (bodyText.length > 512_000) {
        return NextResponse.json({ success: false, error: "invalid_challenge" }, { status: 413 });
      }
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
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
    return NextResponse.json({ success: false, error: "captcha_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
