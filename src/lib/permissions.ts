import "server-only";
import { cache } from "react";
import { getRequestAuthSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";

// ============================================================================
// RBAC ENFORCEMENT — SERVER-SIDE ONLY (spec section 41: "لا تعتمد على Frontend فقط")
// ----------------------------------------------------------------------------
// Hiding a Delete button in the UI is NOT access control. Every Server
// Action and every Route Handler in this project MUST call requirePermission()
// (or getSessionOrThrow()) before touching the database or the file storage
// layer. The `"server-only"` import above makes it a build error to
// accidentally import this file from a Client Component, which is one more
// guardrail against permission checks silently being skipped on the client.
// ============================================================================

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Forbidden: missing permission "${permission}"`);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
};

/**
 * Platform programmer access follows the existing application convention:
 * an explicit developer role, or the immutable super-admin wildcard role.
 */
export function isProgrammer(user: Pick<SessionUser, "roleKey" | "permissions">): boolean {
  return user.roleKey === "developer" || (user.roleKey === "super_admin" && user.permissions.includes("*"));
}

/**
 * Finance "programmer" capability: editing or deleting an already-posted
 * financial row is an engineering operation, not a business permission.
 *
 * SECURITY: this used to be decided by `user.email.includes("dev")` in four
 * separate Server Actions, which meant any self-provisioned account whose
 * address happened to contain "dev" (e.g. dave@…) could rewrite the ledger.
 * The only accepted proofs now are the immutable super-admin wildcard, the
 * explicit `developer` role, or the dedicated `finance.programmer` permission
 * granted to the DEV role. No email/name heuristic may ever be reintroduced.
 */
export function isFinanceProgrammer(user: Pick<SessionUser, "roleKey" | "permissions">): boolean {
  return isProgrammer(user) || user.permissions.includes("finance.programmer");
}

/** Returns the current session's user, or throws UnauthenticatedError. */
export const getSessionOrThrow = cache(async (): Promise<SessionUser> => {
  const session = await getRequestAuthSession();
  const user = session?.user as ({ id?: unknown; roleKey?: unknown; permissions?: unknown } & Record<string, unknown>) | null | undefined;
  if (
    !user ||
    (session as { invalid?: unknown } | null)?.invalid === true ||
    typeof user.id !== "string" ||
    typeof user.roleKey !== "string" ||
    !Array.isArray(user.permissions) ||
    user.permissions.some((permission) => typeof permission !== "string")
  ) {
    throw new UnauthenticatedError();
  }
  return user as unknown as SessionUser;
});

/** True if the user's role grants this permission key (or "*" super-admin wildcard). */
export function hasPermission(user: SessionUser, permissionKey: string): boolean {
  // The wildcard is reserved for the immutable super-admin role. A malformed
  // or manually altered role assignment must not become a privilege-escalation
  // path just because its permission rows contain "*".
  const isSuperAdminWildcard = user.roleKey === "super_admin" && user.permissions.includes("*");
  if (permissionKey === "*") return isSuperAdminWildcard;
  // Coaches and assistant coaches manage the player roster for their assigned
  // teams when their role also includes players.update. Keep this compatibility
  // rule explicit for accounts provisioned before role permissions sync.
  const coachRosterCreate = permissionKey === "players.create" &&
    (user.roleKey === "coach" || user.roleKey === "assistant_coach") &&
    user.permissions.includes("players.update");
  if (coachRosterCreate) return true;
  return isSuperAdminWildcard || user.permissions.includes(permissionKey);
}

/**
 * Throws ForbiddenError if the current session lacks `permissionKey`.
 * Use at the top of every Server Action / Route Handler that mutates or
 * reads non-public data, e.g.:
 *
 *   const user = await requirePermission("players.create");
 */
export async function requirePermission(permissionKey: string): Promise<SessionUser> {
  const user = await getSessionOrThrow();
  if (!hasPermission(user, permissionKey)) {
    // Record authenticated authorization denials for security review. The denial
    // remains authoritative even if audit storage is temporarily unavailable.
    try {
      await writeAuditLog({
        userId: user.id,
        action: "authorization.denied",
        entityType: "Permission",
        changes: { permission: permissionKey }
      });
    } catch {
      // Never turn a denied request into an allowed request because logging failed.
    }
    throw new ForbiddenError(permissionKey);
  }
  return user;
}

/** Page-only permission guard: render a localized 403 page for denied visits. */
export async function requirePagePermission(permissionKey: string, locale: string): Promise<SessionUser> {
  try {
    return await requirePermission(permissionKey);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    const safeLocale = locale === "fr" ? "fr" : "ar";
    redirect(`/${safeLocale}/access-denied?code=403`);
  }
}

/**
 * Document classification -> required permission mapping (spec section 27).
 * Contracts, correspondence, meeting minutes and administrative documents
 * require the elevated "documents.view.restricted" permission even for users
 * who otherwise hold generic "documents.view" — this is what keeps Coach and
 * Media Manager roles out of sensitive administrative paperwork by default.
 */
export function requiredPermissionForDocument(classification: "PUBLIC" | "INTERNAL" | "RESTRICTED"): string {
  if (classification === "RESTRICTED") return "documents.view.restricted";
  return "documents.view";
}

/** Helper for Route Handlers: converts thrown auth errors into HTTP responses. */
export function toHttpErrorResponse(error: unknown): Response | null {
  if (error instanceof UnauthenticatedError) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
