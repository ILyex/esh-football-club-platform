"use server";

import { cookies } from "next/headers";
import { getSessionOrThrow, ForbiddenError } from "@/lib/permissions";
import { TEAM_SWITCHER_COOKIE_NAME } from "@/lib/team-context";
import { db } from "@/lib/db";
import { resolveTeamScope } from "@/lib/authz/policy";
import { validateTeamSwitch, sanitizeReturnTo } from "@/lib/team-switcher-security";
import { redirect } from "next/navigation";

// ============================================================================
// P3 — Secure Team Switcher Server Action
// ----------------------------------------------------------------------------
// Enforces server-side authorization on every team switch request:
//  - Authenticates the caller via getSessionOrThrow()
//  - Resolves live TeamScope from the database via resolveTeamScope()
//  - Enforces that restricted users can NEVER switch to "ALL"
//  - Enforces that restricted users can ONLY switch to their assigned active teams
//  - Enforces that unrestricted users can only switch to "ALL" or existing active teams
//  - Prevents open redirects via sanitizeReturnTo()
//  - Never modifies the cookie before authorization succeeds
// ============================================================================

export async function setCurrentTeamAction(formData: FormData) {
  const user = await getSessionOrThrow();
  const rawTeamId = formData.get("teamId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId.trim() : "ALL";
  const locale = String(formData.get("locale") ?? "ar");
  const returnTo = sanitizeReturnTo(formData.get("returnTo"), `/${locale}/dashboard`);

  // Authoritative scope and active teams resolution from database
  const [scope, activeTeams] = await Promise.all([
    resolveTeamScope(db, user),
    db.team.findMany({
      where: { active: true },
      select: { id: true, active: true }
    })
  ]);

  const validation = validateTeamSwitch(scope, teamId, activeTeams);
  if (!validation.allowed) {
    // Invariants A, B, C, E, H: Reject unauthorized switch attempt fail-closed
    throw new ForbiddenError("teams.switch");
  }

  const store = await cookies();
  store.set(TEAM_SWITCHER_COOKIE_NAME, validation.resolvedTeamId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });

  redirect(returnTo);
}
