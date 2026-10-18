import "server-only";

import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { isLoginCaptchaEnabled, verifyLoginCaptcha } from "@/lib/security/cap-captcha";

/** Credential verifier shared by Auth.js and the first-party native app. */
export async function authenticatePlatformCredentials(raw: Record<string, unknown> | undefined, request: Request) {
  if (isLoginCaptchaEnabled()) {
    const captchaResult = await verifyLoginCaptcha(String(raw?.captchaToken ?? ""));
    if (captchaResult !== "verified") {
      const error = new CredentialsSignin();
      error.code = captchaResult === "unavailable" ? "captcha_unavailable" : "captcha_required";
      throw error;
    }
  }

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const ipCandidates = [
    request.headers.get("x-real-ip")?.trim(),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ];
  const clientIp = ipCandidates.find((candidate) => candidate && /^[a-fA-F0-9:.]{1,64}$/.test(candidate)) ?? null;
  const accountHash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const accountKey = Array.from(new Uint8Array(accountHash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const windowMs = 15 * 60 * 1000;
  const accountLimitKey = `login:credentials:account:${accountKey}`;
  const ipLimitKey = clientIp ? `login:credentials:ip:${clientIp}` : null;
  const accountLimit = { key: accountLimitKey, limit: 10, windowMs };
  const ipLimit = ipLimitKey ? { key: ipLimitKey, limit: 30, windowMs } : null;
  const [accountResult, ipResult] = await Promise.all([
    checkRateLimit(accountLimit),
    ipLimit ? checkRateLimit(ipLimit) : Promise.resolve(null)
  ]);
  if (!accountResult.allowed || (ipResult !== null && !ipResult.allowed)) {
    const error = new CredentialsSignin();
    error.code = "rate_limited";
    throw error;
  }

  const user = await db.user.findUnique({
    where: { email, deletedAt: null },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  });
  const hashToCompare = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinva";
  const passwordMatches = await bcrypt.compare(password, hashToCompare);
  if (!user || !user.isActive || !passwordMatches) {
    await writeAuditLog({ userId: user?.id ?? null, action: "auth.login_failed", entityType: "User", entityId: user?.id ?? null });
    return null;
  }

  const loginTime = new Date();
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: loginTime, lastSeenAt: loginTime } });
  await writeAuditLog({ userId: user.id, action: "auth.login_success", entityType: "User", entityId: user.id });
  await resetRateLimit(accountLimitKey);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? undefined,
    roleKey: user.role.key,
    roleName: user.role.name,
    tokenVersion: user.tokenVersion,
    rememberMe: raw?.rememberMe === "true" || raw?.rememberMe === true,
    permissions: user.role.permissions.map((rp) => rp.permission.key).filter((key) => key !== "*" || user.role.key === "super_admin")
  };
}
