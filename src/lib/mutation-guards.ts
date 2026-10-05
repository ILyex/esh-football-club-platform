import { getSessionOrThrow, ForbiddenError, UnauthenticatedError } from "@/lib/permissions";
import { resolveTeamScope } from "@/lib/authz/policy";
import { db } from "@/lib/db";

// ============================================================================
// P4 — RESOURCE TEAM SCOPING & MUTATION GUARDS
// ----------------------------------------------------------------------------
// Low-level scope primitives for server actions, route handlers, and data
// mutations. These helpers enforce live UserTeam authorization boundaries:
//
//   1. getMutationScopeContext(): Resolves caller identity and live UserTeam scope.
//   2. assertTeamScope(): Validates that target resource teamId is writable/readable.
//   3. assertDualTeamScope(): Validates both source and destination teams for
//      cross-team moves (e.g. moving a Player between categories).
//
// These primitives do NOT replace RBAC permissions, domain rules, or entity
// integrity checks. They provide the authoritative team-boundary assertion.
// ============================================================================

export interface ResourceScopeContext {
  userId: string;
  isUnrestricted: boolean;
  authorizedTeamIds: string[];
}

export interface ScopeOptions {
  /**
   * If true, teamId === null (club-wide resource) is permitted for restricted
   * users (e.g. reading club-wide documents, public competitions).
   * If false (default), teamId === null is reserved for unrestricted administrators.
   */
  allowClubWide?: boolean;
}

/**
 * Resolves the authenticated actor and their authoritative UserTeam scope.
 * Fails closed if the caller is not authenticated.
 */
export async function getMutationScopeContext(): Promise<ResourceScopeContext> {
  const sessionUser = await getSessionOrThrow();
  const scope = await resolveTeamScope(db, sessionUser);
  return {
    userId: sessionUser.id,
    isUnrestricted: !scope.restricted,
    authorizedTeamIds: scope.restricted ? [...scope.teamIds] : []
  };
}

/**
 * Asserts that targetTeamId is within the actor's authorized scope.
 * - Unrestricted users can mutate any team, and club-wide (null).
 * - Restricted users:
 *     - If targetTeamId is null: allowed ONLY when options.allowClubWide is true;
 *       otherwise rejected (restricted users cannot mutate club-wide resources).
 *     - If targetTeamId is string: MUST be in authorizedTeamIds.
 */
export function assertTeamScope(
  context: ResourceScopeContext,
  targetTeamId: string | null | undefined,
  resourceName: string,
  options: ScopeOptions = {}
): void {
  if (context.isUnrestricted) {
    return;
  }

  if (targetTeamId === null || targetTeamId === undefined) {
    if (options.allowClubWide) {
      return;
    }
    throw new ForbiddenError(`scope.club_wide_restricted:${resourceName}`);
  }

  if (!context.authorizedTeamIds.includes(targetTeamId)) {
    throw new ForbiddenError(`scope.unauthorized_team:${resourceName}`);
  }
}

/**
 * Asserts dual-scope permission for cross-team moves (e.g. Player transfer).
 * For restricted users, BOTH the source team and the destination team must
 * be explicitly present in authorizedTeamIds.
 */
export function assertDualTeamScope(
  context: ResourceScopeContext,
  fromTeamId: string | null | undefined,
  toTeamId: string | null | undefined,
  resourceName: string
): void {
  if (context.isUnrestricted) {
    return;
  }

  // Source scope assertion
  if (fromTeamId === null || fromTeamId === undefined) {
    throw new ForbiddenError(`scope.club_wide_restricted_source:${resourceName}`);
  }
  if (!context.authorizedTeamIds.includes(fromTeamId)) {
    throw new ForbiddenError(`scope.unauthorized_source_team:${resourceName}`);
  }

  // Destination scope assertion
  if (toTeamId === null || toTeamId === undefined) {
    throw new ForbiddenError(`scope.club_wide_restricted_destination:${resourceName}`);
  }
  if (!context.authorizedTeamIds.includes(toTeamId)) {
    throw new ForbiddenError(`scope.unauthorized_destination_team:${resourceName}`);
  }
}
