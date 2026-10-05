// ============================================================================
// P3 — Team Switcher Security Logic
// ----------------------------------------------------------------------------
// Pure, deterministic security evaluation for team switching and active team
// resolution. Decoupled from Next.js request headers and Auth.js so that every
// invariant (A through H) is 100% testable in automated unit tests without
// requiring mock request pipelines.
//
// Invariants enforced:
//   Invariant A: A user can only switch to an authorized team.
//   Invariant B: A client cannot grant itself team access by submitting a
//                different teamId (direct request / form tampering).
//   Invariant C: An unauthorized team ID must never become the user's active team.
//   Invariant D: The team switcher must not expose unauthorized teams.
//   Invariant E: A deleted/nonexistent/inactive team cannot become active.
//   Invariant F: Removing a user's team assignment cannot leave them with an
//                invalid authorized state (immediate fail-closed).
//   Invariant G: Team switching must not grant permissions the user does not possess.
//   Invariant H: Team switching must not bypass existing RBAC or team scoping.
// ============================================================================

import type { TeamScope } from "@/lib/authz/policy";

/**
 * Sentinel ID returned when a restricted user has ZERO authorized teams.
 * When used in a database filter `where: { teamId: NO_TEAM_SCOPE_ID }`, Prisma
 * returns exactly 0 records — ensuring complete fail-closed behavior across
 * every consumer in the application.
 */
export const NO_TEAM_SCOPE_ID = "__NO_TEAM_SCOPE__";

export type MinimalTeam = {
  id: string;
  name?: string;
  category?: string;
  active?: boolean;
};

export type SwitchValidationResult =
  | { allowed: true; resolvedTeamId: string }
  | { allowed: false; reason: "UNAUTHENTICATED" | "RESTRICTED_ALL_DENIED" | "UNAUTHORIZED_TEAM" | "NONEXISTENT_OR_INACTIVE" };

/**
 * Validates a team switch request against the caller's authoritative TeamScope.
 *
 * Rules:
 *   1. For restricted users (role.teamScoped === true):
 *      - "ALL" is unconditionally REJECTED.
 *      - Empty or whitespace teamId is REJECTED.
 *      - Target team must be explicitly present in `scope.teamIds`.
 *      - Target team must exist and be active in `activeTeams`.
 *   2. For unrestricted users (role.teamScoped === false or "*" permission):
 *      - "ALL" is ALLOWED.
 *      - Specific teamId must exist and be active in `activeTeams`.
 */
export function validateTeamSwitch(
  scope: TeamScope,
  requestedTeamId: string | null | undefined,
  activeTeams: readonly MinimalTeam[]
): SwitchValidationResult {
  const teamId = typeof requestedTeamId === "string" ? requestedTeamId.trim() : "";
  if (!teamId) {
    return { allowed: false, reason: "NONEXISTENT_OR_INACTIVE" };
  }

  const activeTeamIds = new Set(activeTeams.filter((t) => t.active !== false).map((t) => t.id));

  if (scope.restricted) {
    // Invariant A & Invariant H: Restricted users can never switch to "ALL"
    if (teamId === "ALL") {
      return { allowed: false, reason: "RESTRICTED_ALL_DENIED" };
    }

    // Invariant B & Invariant C: Target team must be in user's assigned scope
    if (!scope.teamIds.includes(teamId)) {
      return { allowed: false, reason: "UNAUTHORIZED_TEAM" };
    }

    // Invariant E: Target team must exist and be active
    if (!activeTeamIds.has(teamId)) {
      return { allowed: false, reason: "NONEXISTENT_OR_INACTIVE" };
    }

    return { allowed: true, resolvedTeamId: teamId };
  }

  // Unrestricted user:
  if (teamId === "ALL") {
    return { allowed: true, resolvedTeamId: "ALL" };
  }

  // Invariant E: Specific team must exist and be active
  if (!activeTeamIds.has(teamId)) {
    return { allowed: false, reason: "NONEXISTENT_OR_INACTIVE" };
  }

  return { allowed: true, resolvedTeamId: teamId };
}

/**
 * Resolves the authoritative active team ID from untrusted inputs (cookie, URL parameter).
 *
 * Guaranteed Behavior:
 *   - For unrestricted users:
 *     - If candidate is "ALL", missing, or invalid: returns `null` (means unrestricted / ALL teams).
 *     - If candidate is an existing active team: returns that `teamId`.
 *   - For restricted users:
 *     - If assigned zero active teams: returns `NO_TEAM_SCOPE_ID` (fails closed, matches 0 records).
 *     - If candidate matches an assigned active team: returns candidate.
 *     - If candidate is "ALL", unauthorized, nonexistent, or missing:
 *       FAILS CLOSED to the user's first assigned active team. It NEVER returns `null`,
 *       because consumers interpret `null` as "unrestricted / all teams".
 */
export function resolveActiveTeamId(
  scope: TeamScope,
  cookieTeamId: string | null | undefined,
  urlTeamId: string | null | undefined,
  activeTeams: readonly MinimalTeam[]
): string | null {
  const activeList = activeTeams.filter((t) => t.active !== false);
  const activeSet = new Set(activeList.map((t) => t.id));

  // Determine candidate team: explicit URL parameter takes precedence over cookie if provided
  const candidate = (urlTeamId !== undefined && urlTeamId !== null && urlTeamId !== "")
    ? urlTeamId.trim()
    : (cookieTeamId !== undefined && cookieTeamId !== null && cookieTeamId !== "")
      ? cookieTeamId.trim()
      : null;

  if (!scope.restricted) {
    // Unrestricted user:
    if (!candidate || candidate === "ALL") {
      return null; // represents ALL
    }
    return activeSet.has(candidate) ? candidate : null;
  }

  // Restricted user:
  const authorizedActive = activeList.filter((t) => scope.teamIds.includes(t.id));

  // Invariant F: If user has 0 assigned active teams (e.g. assignment removed) -> fail closed
  if (authorizedActive.length === 0) {
    return NO_TEAM_SCOPE_ID;
  }

  // Invariant B & C: If candidate is authorized and active, accept it
  if (candidate && candidate !== "ALL" && authorizedActive.some((t) => t.id === candidate)) {
    return candidate;
  }

  // Invariant A & H: Unauthorized candidate or "ALL" -> fail closed to first authorized team.
  // NEVER return null or undefined for a restricted user!
  return authorizedActive[0]?.id ?? NO_TEAM_SCOPE_ID;
}

/**
 * Filters the list of all teams to only those authorized for the current scope.
 *
 * Invariant D: The team switcher must not expose unauthorized teams.
 */
export function filterAuthorizedTeams<T extends MinimalTeam>(
  scope: TeamScope,
  allTeams: readonly T[]
): T[] {
  const activeTeams = allTeams.filter((t) => t.active !== false);
  if (!scope.restricted) {
    return activeTeams as T[];
  }
  return activeTeams.filter((t) => scope.teamIds.includes(t.id)) as T[];
}

/**
 * Sanitizes returnTo parameter to prevent open-redirect vulnerabilities.
 * Only allows local, relative paths (e.g., `/ar/dashboard`, `/fr/dashboard/players`).
 */
export function sanitizeReturnTo(rawReturnTo: unknown, fallback: string): string {
  if (
    typeof rawReturnTo === "string" &&
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//") &&
    !rawReturnTo.startsWith("/\\")
  ) {
    return rawReturnTo;
  }
  return fallback;
}
