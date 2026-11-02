import "server-only";

import { createHash, createHmac } from "node:crypto";
import { generateChallenge, validateChallenge, type ValidateChallengeBody } from "capjs-core";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDeploymentEnvironment } from "@/lib/deployment-environment";
import { getTrustedClientIp } from "@/lib/security/client-ip";

const LOGIN_SCOPE = "esh-login-v1";
const TOKEN_PREFIX = "cap:login-token:";
const NONCE_PREFIX = "cap:login-challenge:";

export type CapVerificationResult = "disabled" | "verified" | "rejected" | "unavailable";
export type CaptchaAuditEvent = "challenge_issued" | "rate_limited" | "challenge_solved" | "challenge_rejected" | "token_accepted" | "token_rejected" | "unavailable";

/** Records only aggregate-worthy outcomes; never persist CAPTCHA tokens, emails, or raw client addresses. */
export async function recordCaptchaAuditEvent(event: CaptchaAuditEvent): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: null,
        action: `security.captcha.${event}`,
        entityType: "CAPTCHA",
        deploymentEnvironment: getDeploymentEnvironment(),
        changes: { flow: "login" }
      }
    });
  } catch {
    // Telemetry must never change whether a valid solve or login is accepted.
  }
}

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
  // Trusted-proxy aware: spoofable headers no longer create a fresh challenge
  // bucket per request.
  const address = getTrustedClientIp(request) ?? "unknown";
  const ipHash = createHash("sha256").update(address.slice(0, 128)).digest("hex");
  const limit = await checkRateLimit({ key: `cap:challenge-ip:${ipHash}`, limit: 40, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    await recordCaptchaAuditEvent("rate_limited");
    return null;
  }

  const challenge = await generateChallenge(secret, {
    scope: LOGIN_SCOPE,
    expiresMs: 5 * 60 * 1000,
    // Keep the native Cap flow quick on low-power phones and slower networks.
    // Login is additionally protected by per-IP challenge and credential
    // rate limits; the optional instrumentation stage was timing out in real
    // browsers after the proof-of-work had already reached 99%.
    challengeCount: 30,
    challengeSize: 32,
    challengeDifficulty: 3
  });
  await recordCaptchaAuditEvent("challenge_issued");
  return challenge;
}

export async function redeemLoginChallenge(value: unknown) {
  if (!isLoginCaptchaEnabled()) throw new Error("CAPTCHA is disabled");
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    await recordCaptchaAuditEvent("challenge_rejected");
    return { success: false as const, error: "invalid_challenge" };
  }

  const secret = await getCaptchaSecret();
  const result = await validateChallenge(secret, value as ValidateChallengeBody, {
    scope: LOGIN_SCOPE,
    tokenTtlMs: 10 * 60 * 1000,
    consumeNonce: consumeChallengeNonce
  });
  if (!result.success || !result.tokenKey) {
    await recordCaptchaAuditEvent("challenge_rejected");
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

  await recordCaptchaAuditEvent("challenge_solved");
  return { success: true as const, token: result.token, expires: result.expires };
}

/** A valid solve is single-use, including when auth is called directly. */
export async function verifyLoginCaptcha(token: string): Promise<CapVerificationResult> {
  if (!isLoginCaptchaEnabled()) return "disabled";
  if (token.length < 12 || token.length > 256) {
    void recordCaptchaAuditEvent("token_rejected");
    return "rejected";
  }

  const [id, verificationSecret, ...extra] = token.split(":");
  if (!id || !verificationSecret || extra.length > 0 || !/^[a-f0-9]{16}$/i.test(id) || !/^[a-f0-9]{30}$/i.test(verificationSecret)) {
    void recordCaptchaAuditEvent("token_rejected");
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
    const verified = consumed.count === 1;
    // CAPTCHA telemetry is best-effort and should not delay credential
    // verification once the single-use token has already been consumed.
    void recordCaptchaAuditEvent(verified ? "token_accepted" : "token_rejected");
    return verified ? "verified" : "rejected";
  } catch {
    void recordCaptchaAuditEvent("unavailable");
    return "unavailable";
  }
}
