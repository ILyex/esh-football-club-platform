import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveTeamScope, type TeamScope, type ScopeSubjectUser } from "@/lib/authz/policy";
import {
  resolveActiveTeamId,
  filterAuthorizedTeams,
  NO_TEAM_SCOPE_ID
} from "@/lib/team-switcher-security";
import type { TeamCategory } from "@prisma/client";

// ============================================================================
// P3 — Centralized, Authorization-Aware Team Context
// ----------------------------------------------------------------------------
// The dashboard-wide "Team Switcher" persists the user's active team view in
// an HTTP cookie.
//
// In P3, the cookie and URL parameters are treated as UNTRUSTED client input:
//  - Every lookup resolves the authenticated caller's live TeamScope.
//  - Unrestricted users can view ALL teams (activeTeamId = null -> no filter)
//    or any specific active team.
//  - Restricted users can NEVER view ALL teams. If their cookie or URL parameter
//    is "ALL", unauthorized, or missing, resolution fails closed to their
//    first assigned active team.
//  - If a restricted user has ZERO assigned teams (or assignments were revoked),
//    resolution returns NO_TEAM_SCOPE_ID ("__NO_TEAM_SCOPE__") which matches 0
//    database records — completely eliminating cross-team IDOR and "ALL" bypass.
// ============================================================================

const COOKIE_NAME = "esh_current_team";

export type AuthorizedTeam = {
  id: string;
  name: string;
  shortName: string | null;
  category: TeamCategory;
  birthYearFrom: number | null;
  birthYearTo: number | null;
  active: boolean;
};

export type UserTeamContext = {
  user: ScopeSubjectUser | null;
  scope: TeamScope;
  authorizedTeams: AuthorizedTeam[];
  activeTeamId: string | null;
  canSelectAll: boolean;
};

/**
 * Resolves the full team context for the current request, accounting for
 * the authenticated user, live database TeamScope, and active teams.
 *
 * @param requestedTeamId Optional explicit override (e.g. from URL `sp.team`).
 *                        If omitted, reads the `esh_current_team` cookie.
 */
export async function resolveUserTeamContext(requestedTeamId?: string | null): Promise<UserTeamContext> {
  const [session, allTeams, cookieStore] = await Promise.all([
    auth(),
    db.team.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        category: true,
        birthYearFrom: true,
        birthYearTo: true,
        active: true
      },
      orderBy: { category: "asc" }
    }),
    cookies()
  ]);

  const rawUser = session?.user && !(session as any).invalid ? (session.user as any) : null;

  if (!rawUser) {
    return {
      user: null,
      scope: { restricted: true, teamIds: [] },
      authorizedTeams: [],
      activeTeamId: null,
      canSelectAll: false
    };
  }

  const user: ScopeSubjectUser = {
    id: rawUser.id,
    roleKey: rawUser.roleKey,
    permissions: rawUser.permissions ?? []
  };

  const scope = await resolveTeamScope(db, user);
  const authorizedTeams = filterAuthorizedTeams(scope, allTeams);
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;

  const activeTeamId = resolveActiveTeamId(
    scope,
    cookieValue,
    requestedTeamId,
    allTeams
  );

  return {
    user,
    scope,
    authorizedTeams,
    activeTeamId,
    canSelectAll: !scope.restricted
  };
}

/**
 * Returns the validated active team ID for the current user:
 *   - For unrestricted users: returns the active team ID, or `null` if "ALL" is selected.
 *   - For restricted users: returns an authorized active team ID, or `NO_TEAM_SCOPE_ID`
 *     if zero teams are assigned. It NEVER returns `null` for a restricted user.
 */
export async function getCurrentTeamId(requestedTeamId?: string | null): Promise<string | null> {
  const ctx = await resolveUserTeamContext(requestedTeamId);
  return ctx.activeTeamId;
}

/**
 * Returns the effective team ID for database `where: { teamId }` clauses:
 *   - Unrestricted user with ALL selected: returns `undefined` (omits `{ teamId }` filter).
 *   - Unrestricted user with specific team: returns that `teamId`.
 *   - Restricted user: ALWAYS returns an authorized team ID or `NO_TEAM_SCOPE_ID`.
 *     It NEVER returns `undefined` for a restricted user.
 */
export async function getEffectiveTeamId(requestedTeamId?: string | null): Promise<string | undefined> {
  const ctx = await resolveUserTeamContext(requestedTeamId);
  if (!ctx.scope.restricted) {
    return ctx.activeTeamId ?? undefined;
  }
  return ctx.activeTeamId ?? NO_TEAM_SCOPE_ID;
}

/**
 * Returns only the active teams authorized for the current user:
 *   - Unrestricted users: all active teams.
 *   - Restricted users: only active teams present in their UserTeam assignments.
 */
export async function getAuthorizedTeams(): Promise<AuthorizedTeam[]> {
  const ctx = await resolveUserTeamContext();
  return ctx.authorizedTeams;
}

export { COOKIE_NAME as TEAM_SWITCHER_COOKIE_NAME, NO_TEAM_SCOPE_ID };
