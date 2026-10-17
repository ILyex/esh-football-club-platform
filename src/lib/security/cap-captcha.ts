import "server-only";

import { createHash, createHmac } from "node:crypto";
import { generateChallenge, validateChallenge, type ValidateChallengeBody } from "capjs-core";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const LOGIN_SCOPE = "esh-login-v1";
const TOKEN_PREFIX = "cap:login-token:";
const NONCE_PREFIX = "cap:login-challenge:";

export type CapVerificationResult = "disabled" | "verified" | "rejected" | "unavailable";

export function isLoginCaptchaEnabled(): boolean {
  return process.env.NODE_ENV === "production" ||
    process.env.CAPTCHA_ENABLED === "true" ||
    process.env.CAPTCHA_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === "1";
}

async function getCaptchaSecret(): Promise<string> {
  const dedicatedSecret = process.env.CAP_SECRET?.trim();
  if (dedicatedSecret && dedicatedSecret.length >= 32) return dedicatedSecret;

  // AUTH_SECRET is already a required high-entropy production secret. Derive
  // a purpose-specific key so Cap needs no separate account or service secret.
  const authSecret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!authSecret || authSecret.length < 32) throw new Error("CAPTCHA signing secret is unavailable");
  return createHmac("sha256", authSecret).update("esh-platform:cap-core:login:v1").digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function consumeChallengeNonce(signatureHex: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  try {
    await db.rateLimitBucket.create({
      data: {
        key: `${NONCE_PREFIX}${signatureHex}`,
        count: 1,
        windowStartedAt: now,
        expiresAt: new Date(now.getTime() + Math.max(1, ttlMs)),
        updatedAt: now
      }
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

export async function createLoginChallenge(request: Request) {
  if (!isLoginCaptchaEnabled()) throw new Error("CAPTCHA is disabled");
  const secret = await getCaptchaSecret();
  const address = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ipHash = createHash("sha256").update(address.slice(0, 128)).digest("hex");
  const limit = await checkRateLimit({ key: `cap:challenge-ip:${ipHash}`, limit: 40, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return null;

  return generateChallenge(secret, {
    scope: LOGIN_SCOPE,
    expiresMs: 5 * 60 * 1000,
    instrumentation: true
  });
}

export async function redeemLoginChallenge(value: unknown) {
  if (!isLoginCaptchaEnabled()) throw new Error("CAPTCHA is disabled");
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false as const, error: "invalid_challenge" };
  }

  const secret = await getCaptchaSecret();
  const result = await validateChallenge(secret, value as ValidateChallengeBody, {
    scope: LOGIN_SCOPE,
    tokenTtlMs: 10 * 60 * 1000,
    consumeNonce: consumeChallengeNonce
  });
  if (!result.success || !result.tokenKey) {
    return { success: false as const, error: "verification_failed" };
  }

  const now = new Date();
  await db.rateLimitBucket.create({
    data: {
      key: `${TOKEN_PREFIX}${result.tokenKey}`,
      count: 0,
      windowStartedAt: now,
      expiresAt: new Date(result.expires),
      updatedAt: now
    }
  });

  return { success: true as const, token: result.token, expires: result.expires };
}

/** A valid solve is single-use, including when auth is called directly. */
export async function verifyLoginCaptcha(token: string): Promise<CapVerificationResult> {
  if (!isLoginCaptchaEnabled()) return "disabled";
  if (token.length < 12 || token.length > 256) return "rejected";

  const [id, verificationSecret, ...extra] = token.split(":");
  if (!id || !verificationSecret || extra.length > 0 || !/^[a-f0-9]{16}$/i.test(id) || !/^[a-f0-9]{30}$/i.test(verificationSecret)) {
    return "rejected";
  }

  const tokenHash = createHash("sha256").update(verificationSecret).digest("hex");
  const tokenKey = `${id}:${tokenHash}`;
  try {
    const consumed = await db.rateLimitBucket.updateMany({
      where: {
        key: `${TOKEN_PREFIX}${tokenKey}`,
        count: 0,
        expiresAt: { gt: new Date() }
      },
      data: { count: 1 }
    });
    return consumed.count === 1 ? "verified" : "rejected";
  } catch {
    return "unavailable";
  }
}
