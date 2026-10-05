import "server-only";

// ============================================================================
// AUTHZ POLICY FOUNDATION — P1 (Phase 0 / Sub-phase 0D)
// ----------------------------------------------------------------------------
// STATUS: foundation only. Nothing in this file is imported by any page,
// Server Action, or Route Handler yet. It exists so later phases (P4+) have a
// single, typed place to define how each resource's team scope is computed
// and enforced — see the approved architecture (Phase 0C decision sheet).
//
// What this file deliberately does NOT do, on purpose, in P1:
//   - it does not define policies for any real resource (no Player, Match,
//     Contract, ... entries) — that is resource-enforcement work for later
//     phases, explicitly out of scope here;
//   - it is not called from src/lib/permissions.ts, any page, or any action;
//   - it does not read the Team Switcher cookie (that remains a pure UI
//     convenience per the approved architecture — see team-context.ts);
//   - it does not touch the JWT/session — team scope is always resolved by
//     reading UserTeam fresh, the same way tokenVersion/isActive are already
//     re-checked per request in src/lib/auth.ts, never cached in the token.
//
// Two concerns stay separate everywhere in this file:
//   - Permission  ("can this role do X at all")   — src/lib/permissions.ts,
//     unchanged, still the only source of that answer.
//   - Team scope  ("on which teams")               — this file, new.
// A resource decision always needs both; this file only ever answers the
// second question.
// ============================================================================

// ----------------------------------------------------------------------------
// Resource scope classification
// ----------------------------------------------------------------------------
// Every resource a later phase enforces must be classified as exactly one of
// these. The exhaustiveness is enforced by the switch in `describeScopeKind`
// below — adding a sixth kind without updating that switch is a compile error,
// which is the mechanism that keeps this list authoritative as the project
// grows (mirrors the "no resource ships without an explicit scope decision"
// requirement from the approved architecture).

export type ScopeKind =
  | "PUBLIC" // no authentication-derived restriction at all (public site content)
  | "CLUB_WIDE" // any authenticated user with the relevant permission; never team-restricted
  | "TEAM_OWNED" // the resource carries its own team FK directly
  | "VIA_RELATION" // the resource's team must be resolved through a parent/relation
  | "SENSITIVE_ADMIN"; // never accessible to a team-scoped role, regardless of assignment

/** Exhaustive by construction — a new ScopeKind that isn't handled here fails to compile. */
export function describeScopeKind(kind: ScopeKind): string {
  switch (kind) {
    case "PUBLIC":
      return "No session-derived restriction.";
    case "CLUB_WIDE":
      return "Permission-gated, never team-restricted.";
    case "TEAM_OWNED":
      return "Team resolved from the resource's own team column.";
    case "VIA_RELATION":
      return "Team resolved by following a relation to a team-owned parent.";
    case "SENSITIVE_ADMIN":
      return "Unrestricted access only — never granted to a team-scoped role.";
  }
}

// ----------------------------------------------------------------------------
// A user's resolved team scope
// ----------------------------------------------------------------------------
// The single value every later enforcement point will need. Deliberately NOT
// `Record<string, unknown>` or a bare `string[]` — the discriminated union
// makes "unrestricted" and "restricted to these teams" mutually exclusive and
// exhaustively checkable at the type level, and makes "restricted to zero
// teams" (fail-closed) representable and distinguishable from "unrestricted."

export type TeamScope = { readonly restricted: false } | { readonly restricted: true; readonly teamIds: readonly string[] };

/** The scope every unrestricted (non-teamScoped role, or "*" permission) user gets. Exported as a named constant so call sites read as intent, not a magic literal. */
export const UNRESTRICTED_SCOPE: TeamScope = { restricted: false };

/** The scope a teamScoped user with zero UserTeam rows gets — fail-closed, not "all teams." */
export const NO_TEAMS_SCOPE: TeamScope = { restricted: true, teamIds: [] };

/**
 * Core, pure, fully unit-testable predicate: may `scope` touch a record whose
 * team is `teamId`? `teamId: null` means "a record with no team owner."
 *
 * Fail-closed by construction: an unrestricted scope always returns true; a
 * restricted scope returns true only for an exact membership match, so a null
 * teamId (no owner) and a teamId outside the assigned list both return false.
 * There is no code path in this function that can return true for a
 * restricted scope without an explicit membership match — this is the
 * property later phases' tests must keep proving as resources are added.
 */
export function scopeIncludesTeam(scope: TeamScope, teamId: string | null | undefined): boolean {
  if (!scope.restricted) return true;
  if (!teamId) return false;
  return scope.teamIds.includes(teamId);
}

// ----------------------------------------------------------------------------
// Resolving a user's scope from the database
// ----------------------------------------------------------------------------
// Minimal shape this module needs from Prisma's client — kept as an explicit
// interface (not `any`, not the full generated PrismaClient type) so this
// file has no hard dependency on `@prisma/client` beyond the two lookups it
// actually performs, and so the mock used in this module's own tests can
// implement exactly this surface.

export interface AuthzPrismaClient {
  role: {
    findUnique(args: { where: { key: string }; select: { teamScoped: true } }): Promise<{ teamScoped: boolean } | null>;
  };
  userTeam: {
    findMany(args: { where: { userId: string }; select: { teamId: true } }): Promise<{ teamId: string }[]>;
  };
}

/** The minimal user shape this module needs — a structural subset of permissions.ts's SessionUser, not a re-declaration of it. */
export type ScopeSubjectUser = { readonly id: string; readonly roleKey: string; readonly permissions: readonly string[] };

/**
 * Resolves a user's team scope by reading the database — never the JWT.
 * Consistent with the existing tokenVersion/isActive pattern in auth.ts,
 * which already re-checks live DB state on every request rather than
 * trusting anything cached in the token; this function follows the same
 * precedent for team membership rather than introducing a new caching model.
 *
 * Fail-closed at every branch:
 *   - "*" permission (existing super-admin convention from permissions.ts,
 *     reused as-is, not redefined here) -> UNRESTRICTED_SCOPE.
 *   - role not found -> NO_TEAMS_SCOPE (unknown role data is not evidence of
 *     authorization).
 *   - known role.teamScoped is false -> UNRESTRICTED_SCOPE.
 *   - role.teamScoped is true -> restricted to exactly the UserTeam rows on
 *     record for this user; zero rows -> NO_TEAMS_SCOPE, never a fallback to
 *     unrestricted. A lookup that fails (thrown error) propagates to the
 *     caller rather than being swallowed into an unrestricted default — this
 *     module never catches an error and treats it as "allow."
 */
export async function resolveTeamScope(db: AuthzPrismaClient, user: ScopeSubjectUser): Promise<TeamScope> {
  if (user.roleKey === "super_admin" && user.permissions.includes("*")) return UNRESTRICTED_SCOPE;

  const role = await db.role.findUnique({ where: { key: user.roleKey }, select: { teamScoped: true } });
  if (!role) return NO_TEAMS_SCOPE;
  if (!role.teamScoped) return UNRESTRICTED_SCOPE;

  const assignments = await db.userTeam.findMany({ where: { userId: user.id }, select: { teamId: true } });
  if (assignments.length === 0) return NO_TEAMS_SCOPE;
  return { restricted: true, teamIds: assignments.map((a) => a.teamId) };
}

// ----------------------------------------------------------------------------
// Typed per-resource filter shape (foundation only — no resource uses this yet)
// ----------------------------------------------------------------------------
// Generic over the resource's OWN Prisma `WhereInput` type, so a later phase
// writing e.g. `playerScopeFilter(scope): Prisma.PlayerWhereInput` gets real
// type-checking against the actual generated Prisma types — never a generic
// `Record<string, unknown>`. This type is intentionally minimal: it says what
// shape a resource's scope filter function must have, without this module
// pre-guessing what any specific resource's filter looks like.

export type ScopedWhereBuilder<TWhere> = (scope: TeamScope) => TWhere;

/**
 * For TEAM_OWNED resources whose team column really is named `teamId` and
 * whose Prisma `WhereInput` accepts an `{ teamId?: ... }` shape — the common
 * case covered by the resource-scope matrix (Players, Matches, Training
 * Sessions, Calendar Events, Competitions, Contracts, Documents,
 * Correspondence, Meeting Minutes, Budgets, Expenses). Still fully typed:
 * `TWhere` is constrained to actually have a compatible `teamId` field, so
 * passing a resource whose Prisma type doesn't shape-match is a compile
 * error, not a silent runtime `Record<string, unknown>` pass-through.
 *
 * Not used by any resource yet in P1 — provided so later phases share one
 * correct implementation of "team column equals one of the scope's team ids"
 * instead of five slightly different hand-rolled versions.
 */
export function teamIdWhere<TWhere extends { teamId?: string | { in: readonly string[] } | null }>(scope: TeamScope): Partial<TWhere> {
  if (!scope.restricted) return {};
  // `as Partial<TWhere>` narrows a literal object to the caller's exact WhereInput shape; the generic constraint above is what makes this sound (not a Record<string, unknown> escape hatch — TWhere must already declare a compatible `teamId`).
  return { teamId: { in: scope.teamIds } } as Partial<TWhere>;
}
