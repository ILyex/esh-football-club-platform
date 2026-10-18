import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/permissions";

const TOKEN_ISSUER = "esh-matchday-native";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const REMEMBERED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const ADMIN_ROLE_KEYS = new Set(["super_admin", "president", "developer", "director", "sporting_director", "team_manager", "coach", "assistant_coach"]);

export type NativePrincipal = SessionUser & { tokenVersion: number; image: string | null; licenseNumber: string | null; firstName: string | null; lastName: string | null; dateOfBirth: Date | null; bloodGroup: string | null };

function sessionKey(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Native session signing is not configured.");
  return createHmac("sha256", secret).update("esh-platform:native-session:v1").digest("hex");
}

export function canUseNativeMatchday(user: Pick<NativePrincipal, "roleKey" | "permissions">): boolean {
  if (!ADMIN_ROLE_KEYS.has(user.roleKey)) return false;
  const superAdminWildcard = user.roleKey === "super_admin" && user.permissions.includes("*");
  return (user.permissions.includes("matches.view") && (user.permissions.includes("matches.update") || user.permissions.includes("matches.report") || superAdminWildcard)) ||
    user.permissions.includes("meetings.view") || user.permissions.includes("calendar.manage") || user.permissions.includes("training.manage") ||
    user.permissions.includes("news.create") || user.permissions.includes("announcements.manage") || user.permissions.includes("meetings.schedule") || superAdminWildcard;
}

export async function createNativeSessionToken(
  user: Pick<NativePrincipal, "id" | "tokenVersion">,
  rememberMe = false
): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (rememberMe ? REMEMBERED_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: TOKEN_ISSUER, sub: user.id, tv: user.tokenVersion, iat: now, exp: expiresAt, jti: randomBytes(16).toString("hex") })).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", sessionKey()).update(input).digest("base64url");
  const token = `${input}.${signature}`;
  const expires = new Date(expiresAt * 1000);
  await db.nativeSession.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: expires } });
  return { token, expiresAt: expires.toISOString() };
}

export async function getNativePrincipal(request: Request): Promise<NativePrincipal | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payloadPart, signature] = parts;
  if (!header || !payloadPart || !signature) return null;
  const input = `${header}.${payloadPart}`;
  const expected = createHmac("sha256", sessionKey()).update(input).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims: { iss?: unknown; sub?: unknown; tv?: unknown; exp?: unknown };
  try { claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")); } catch { return null; }
  if (claims.iss !== TOKEN_ISSUER || typeof claims.sub !== "string" || typeof claims.tv !== "number" || !Number.isInteger(claims.tv) || typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const storedSession = await db.nativeSession.findFirst({ where: { tokenHash, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!storedSession) return null;

  const user = await db.user.findUnique({
    where: { id: claims.sub, deletedAt: null },
    select: {
      id: true, name: true, email: true, isActive: true, image: true, licenseNumber: true, firstName: true, lastName: true, dateOfBirth: true, bloodGroup: true, tokenVersion: true,
      role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } }
    }
  });
  if (!user || !user.isActive || user.tokenVersion !== claims.tv) return null;
  const permissions = user.role.permissions.map(({ permission }) => permission.key).filter((key) => key !== "*" || user.role.key === "super_admin");
  const principal: NativePrincipal = {
    id: user.id, name: user.name, email: user.email, roleKey: user.role.key, roleName: user.role.name,
    permissions, tokenVersion: user.tokenVersion, image: user.image, licenseNumber: user.licenseNumber,
    firstName: user.firstName, lastName: user.lastName, dateOfBirth: user.dateOfBirth, bloodGroup: user.bloodGroup
  };
  return canUseNativeMatchday(principal) ? principal : null;
}

export async function revokeNativeSession(request: Request, userId: string): Promise<void> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return;
  await db.nativeSession.updateMany({
    where: { tokenHash: createHash("sha256").update(token).digest("hex"), userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
