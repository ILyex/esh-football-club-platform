/**
 * P3 — Team Switcher Security: Automated Unit Tests
 *
 * Verifies all security invariants for team switching and active team resolution:
 *   Invariant A: A user can only switch to an authorized team.
 *   Invariant B: A client cannot grant itself team access by submitting a different teamId.
 *   Invariant C: An unauthorized team ID must never become the user's active team.
 *   Invariant D: The team switcher must not expose unauthorized teams.
 *   Invariant E: A deleted/nonexistent/inactive team cannot become active.
 *   Invariant F: Removing a user's team assignment immediately fails closed.
 *   Invariant G: Team switching does not grant permissions the user does not possess.
 *   Invariant H: Team switching must not bypass existing RBAC or team scoping.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateTeamSwitch,
  resolveActiveTeamId,
  filterAuthorizedTeams,
  sanitizeReturnTo,
  NO_TEAM_SCOPE_ID,
  type MinimalTeam
} from "@/lib/team-switcher-security";
import type { TeamScope } from "@/lib/authz/policy";

const ROOT = join(__dirname, "..", "..", "..");

// Sample test fixtures
const TEAMS: readonly MinimalTeam[] = [
  { id: "team-senior", category: "SENIOR", active: true },
  { id: "team-u20", category: "U20", active: true },
  { id: "team-u17", category: "U17", active: true },
  { id: "team-u15", category: "U15", active: true },
  { id: "team-inactive", category: "U15", active: false }
];

const UNRESTRICTED: TeamScope = { restricted: false };
const RESTRICTED_U15_U17: TeamScope = { restricted: true, teamIds: ["team-u15", "team-u17"] };
const RESTRICTED_SINGLE_U15: TeamScope = { restricted: true, teamIds: ["team-u15"] };
const RESTRICTED_ZERO_TEAMS: TeamScope = { restricted: true, teamIds: [] };

// ============================================================================
// PART 1: validateTeamSwitch (Invariant A, B, C, E, H)
// ============================================================================

test("Invariant A & E: Unrestricted user can switch to 'ALL'", () => {
  const result = validateTeamSwitch(UNRESTRICTED, "ALL", TEAMS);
  assert.equal(result.allowed, true);
  if (result.allowed) {
    assert.equal(result.resolvedTeamId, "ALL");
  }
});

test("Invariant A & E: Unrestricted user can switch to any active team", () => {
  const result1 = validateTeamSwitch(UNRESTRICTED, "team-senior", TEAMS);
  assert.equal(result1.allowed, true);
  if (result1.allowed) assert.equal(result1.resolvedTeamId, "team-senior");

  const result2 = validateTeamSwitch(UNRESTRICTED, "team-u15", TEAMS);
  assert.equal(result2.allowed, true);
  if (result2.allowed) assert.equal(result2.resolvedTeamId, "team-u15");
});

test("Invariant E: Unrestricted user cannot switch to nonexistent or inactive team", () => {
  const resNonexistent = validateTeamSwitch(UNRESTRICTED, "team-phantom", TEAMS);
  assert.equal(resNonexistent.allowed, false);
  if (!resNonexistent.allowed) assert.equal(resNonexistent.reason, "NONEXISTENT_OR_INACTIVE");

  const resInactive = validateTeamSwitch(UNRESTRICTED, "team-inactive", TEAMS);
  assert.equal(resInactive.allowed, false);
  if (!resInactive.allowed) assert.equal(resInactive.reason, "NONEXISTENT_OR_INACTIVE");
});

test("Invariant A & H: Restricted user can switch to an assigned active team", () => {
  const res1 = validateTeamSwitch(RESTRICTED_U15_U17, "team-u15", TEAMS);
  assert.equal(res1.allowed, true);
  if (res1.allowed) assert.equal(res1.resolvedTeamId, "team-u15");

  const res2 = validateTeamSwitch(RESTRICTED_U15_U17, "team-u17", TEAMS);
  assert.equal(res2.allowed, true);
  if (res2.allowed) assert.equal(res2.resolvedTeamId, "team-u17");
});

test("Invariant A & H: Restricted user can switch between multiple authorized teams", () => {
  const switch1 = validateTeamSwitch(RESTRICTED_U15_U17, "team-u15", TEAMS);
  assert.equal(switch1.allowed, true);
  const switch2 = validateTeamSwitch(RESTRICTED_U15_U17, "team-u17", TEAMS);
  assert.equal(switch2.allowed, true);
});

test("Invariant A & H: Restricted user is REJECTED when attempting to switch to 'ALL'", () => {
  const result = validateTeamSwitch(RESTRICTED_U15_U17, "ALL", TEAMS);
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.reason, "RESTRICTED_ALL_DENIED");
  }
});

test("Invariant B & C: Restricted user is REJECTED when attempting to switch to unassigned team", () => {
  // User only authorized for U15 and U17, attempts to switch to Senior
  const result = validateTeamSwitch(RESTRICTED_U15_U17, "team-senior", TEAMS);
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.reason, "UNAUTHORIZED_TEAM");
  }
});

test("Invariant E: Restricted user is REJECTED when switching to nonexistent team", () => {
  const result = validateTeamSwitch(RESTRICTED_U15_U17, "nonexistent-id", TEAMS);
  assert.equal(result.allowed, false);
});

test("Invariant E: Restricted user is REJECTED when assigned team is inactive", () => {
  const scopeWithInactive: TeamScope = { restricted: true, teamIds: ["team-inactive"] };
  const result = validateTeamSwitch(scopeWithInactive, "team-inactive", TEAMS);
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.reason, "NONEXISTENT_OR_INACTIVE");
  }
});

test("Invariant F: Restricted user with zero assigned teams cannot switch to any team", () => {
  const res1 = validateTeamSwitch(RESTRICTED_ZERO_TEAMS, "team-u15", TEAMS);
  assert.equal(res1.allowed, false);

  const resAll = validateTeamSwitch(RESTRICTED_ZERO_TEAMS, "ALL", TEAMS);
  assert.equal(resAll.allowed, false);
});

test("Negative: Empty or whitespace teamId is rejected", () => {
  assert.equal(validateTeamSwitch(UNRESTRICTED, "", TEAMS).allowed, false);
  assert.equal(validateTeamSwitch(UNRESTRICTED, "   ", TEAMS).allowed, false);
  assert.equal(validateTeamSwitch(RESTRICTED_U15_U17, null, TEAMS).allowed, false);
  assert.equal(validateTeamSwitch(RESTRICTED_U15_U17, undefined, TEAMS).allowed, false);
});

// ============================================================================
// PART 2: resolveActiveTeamId (Invariant A, B, C, F, H)
// ============================================================================

test("Unrestricted user: resolves active team from cookie or defaults to null (ALL)", () => {
  // No cookie -> null (ALL)
  assert.equal(resolveActiveTeamId(UNRESTRICTED, null, null, TEAMS), null);
  // Cookie "ALL" -> null (ALL)
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "ALL", null, TEAMS), null);
  // Cookie with valid team -> returns team
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "team-senior", null, TEAMS), "team-senior");
  // Cookie with invalid team -> falls back to null (ALL)
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "invalid-team", null, TEAMS), null);
  // Cookie with inactive team -> falls back to null (ALL)
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "team-inactive", null, TEAMS), null);
});

test("Unrestricted user: URL parameter overrides cookie", () => {
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "team-senior", "team-u20", TEAMS), "team-u20");
  assert.equal(resolveActiveTeamId(UNRESTRICTED, "team-senior", "ALL", TEAMS), null);
});

test("Invariant A & H: Restricted user with missing or 'ALL' cookie fails closed to authorized team", () => {
  // If cookie is empty or "ALL", NEVER return null for restricted user!
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, null, null, TEAMS), "team-u15");
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "ALL", null, TEAMS), "team-u15");
  assert.equal(resolveActiveTeamId(RESTRICTED_U15_U17, "ALL", null, TEAMS), "team-u17");
});

test("Invariant B & C: Cookie tampering by restricted user fails closed to authorized team", () => {
  // Attacker sets cookie to senior or nonexistent
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "team-senior", null, TEAMS), "team-u15");
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "forged-id-123", null, TEAMS), "team-u15");
});

test("Invariant B & C: URL parameter tampering by restricted user fails closed to authorized team", () => {
  // Attacker navigates to ?team=senior or ?team=ALL
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "team-u15", "team-senior", TEAMS), "team-u15");
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "team-u15", "ALL", TEAMS), "team-u15");
  assert.equal(resolveActiveTeamId(RESTRICTED_SINGLE_U15, "team-u15", "forged-id", TEAMS), "team-u15");
});

test("Restricted user: valid assigned team in cookie or URL is accepted", () => {
  assert.equal(resolveActiveTeamId(RESTRICTED_U15_U17, "team-u17", null, TEAMS), "team-u17");
  assert.equal(resolveActiveTeamId(RESTRICTED_U15_U17, "team-u15", "team-u17", TEAMS), "team-u17");
});

test("Invariant F: Revoked assignment (user with 0 teams) returns NO_TEAM_SCOPE_ID", () => {
  // When a user's team assignment is removed, any cookie or URL param must fail closed
  const result1 = resolveActiveTeamId(RESTRICTED_ZERO_TEAMS, null, null, TEAMS);
  assert.equal(result1, NO_TEAM_SCOPE_ID);

  const result2 = resolveActiveTeamId(RESTRICTED_ZERO_TEAMS, "team-senior", null, TEAMS);
  assert.equal(result2, NO_TEAM_SCOPE_ID);

  const result3 = resolveActiveTeamId(RESTRICTED_ZERO_TEAMS, "team-u15", "team-u15", TEAMS);
  assert.equal(result3, NO_TEAM_SCOPE_ID);
});

// ============================================================================
// PART 3: filterAuthorizedTeams (Invariant D)
// ============================================================================

test("Invariant D: Unrestricted user receives all active teams", () => {
  const filtered = filterAuthorizedTeams(UNRESTRICTED, TEAMS);
  assert.equal(filtered.length, 4); // 4 active teams, 1 inactive excluded
  assert.deepEqual(filtered.map((t) => t.id).sort(), ["team-senior", "team-u15", "team-u17", "team-u20"]);
});

test("Invariant D: Restricted user receives ONLY authorized active teams", () => {
  const filtered = filterAuthorizedTeams(RESTRICTED_U15_U17, TEAMS);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((t) => t.id).sort(), ["team-u15", "team-u17"]);
  // Senior and U20 are completely excluded
  assert.equal(filtered.some((t) => t.id === "team-senior"), false);
  assert.equal(filtered.some((t) => t.id === "team-u20"), false);
});

test("Invariant D: Restricted user with 0 teams receives empty list", () => {
  const filtered = filterAuthorizedTeams(RESTRICTED_ZERO_TEAMS, TEAMS);
  assert.deepEqual(filtered, []);
});

// ============================================================================
// PART 4: sanitizeReturnTo (Open Redirect Protection)
// ============================================================================

test("sanitizeReturnTo: allows valid internal relative paths", () => {
  assert.equal(sanitizeReturnTo("/ar/dashboard", "/ar/dashboard"), "/ar/dashboard");
  assert.equal(sanitizeReturnTo("/fr/dashboard/players", "/ar/dashboard"), "/fr/dashboard/players");
  assert.equal(sanitizeReturnTo("/ar/dashboard/matches?team=team-u15", "/ar/dashboard"), "/ar/dashboard/matches?team=team-u15");
});

test("sanitizeReturnTo: blocks external URLs and protocol-relative paths", () => {
  const fallback = "/ar/dashboard";
  assert.equal(sanitizeReturnTo("https://evil.com", fallback), fallback);
  assert.equal(sanitizeReturnTo("http://evil.com/login", fallback), fallback);
  assert.equal(sanitizeReturnTo("//evil.com", fallback), fallback);
  assert.equal(sanitizeReturnTo("/\\evil.com", fallback), fallback);
  assert.equal(sanitizeReturnTo("javascript:alert(1)", fallback), fallback);
  assert.equal(sanitizeReturnTo(null, fallback), fallback);
  assert.equal(sanitizeReturnTo(undefined, fallback), fallback);
});

// ============================================================================
// PART 5: Structural & Architectural Invariants (Source Scanning)
// ============================================================================

const actionSource = readFileSync(
  join(ROOT, "src", "lib", "actions", "team-switcher.ts"),
  "utf8"
);
const contextSource = readFileSync(
  join(ROOT, "src", "lib", "team-context.ts"),
  "utf8"
);
const layoutSource = readFileSync(
  join(ROOT, "src", "app", "[locale]", "(dashboard)", "dashboard", "layout.tsx"),
  "utf8"
);
const switcherSource = readFileSync(
  join(ROOT, "src", "components", "shared", "team-switcher.tsx"),
  "utf8"
);

test("setCurrentTeamAction: requires authenticated session via getSessionOrThrow()", () => {
  assert.match(actionSource, /await\s+getSessionOrThrow\(\)/);
});

test("setCurrentTeamAction: resolves live scope via resolveTeamScope()", () => {
  assert.match(actionSource, /resolveTeamScope\(db,\s*user\)/);
});

test("setCurrentTeamAction: validates team switch using validateTeamSwitch()", () => {
  assert.match(actionSource, /validateTeamSwitch\(/);
});

test("setCurrentTeamAction: throws ForbiddenError when validation fails", () => {
  assert.match(actionSource, /throw\s+new\s+ForbiddenError\(/);
});

test("setCurrentTeamAction: cookie is ONLY set after authorization passes", () => {
  const validationIdx = actionSource.indexOf("validateTeamSwitch");
  const cookieSetIdx = actionSource.indexOf("store.set(TEAM_SWITCHER_COOKIE_NAME");
  assert.ok(validationIdx !== -1, "validateTeamSwitch must be called");
  assert.ok(cookieSetIdx !== -1, "store.set must be called");
  assert.ok(validationIdx < cookieSetIdx, "Validation must precede cookie setting");
});

test("team-context: defines and exports NO_TEAM_SCOPE_ID sentinel", () => {
  assert.match(contextSource, /export\s*\{[^}]*NO_TEAM_SCOPE_ID[^}]*\}/);
});

test("team-context: exports getEffectiveTeamId()", () => {
  assert.match(contextSource, /export\s+async\s+function\s+getEffectiveTeamId\(/);
});

test("team-context: exports getAuthorizedTeams()", () => {
  assert.match(contextSource, /export\s+async\s+function\s+getAuthorizedTeams\(/);
});

test("layout.tsx: consumes resolveUserTeamContext() for switcher and authorized teams", () => {
  assert.match(layoutSource, /resolveUserTeamContext\(\)/);
  assert.match(layoutSource, /teamCtx\.authorizedTeams/);
});

test("layout.tsx: conditionally renders allTeamsLabel only when canSelectAll is true", () => {
  assert.match(layoutSource, /allTeamsLabel=\{\s*teamCtx\.canSelectAll\s*\?\s*t\("allTeams"\)\s*:\s*null\s*\}/);
});

test("team-switcher.tsx: locks/disables dropdown when user has only 1 team and cannot view all", () => {
  assert.match(switcherSource, /isLocked\s*=\s*teams\.length\s*<=\s*1\s*&&\s*!allTeamsLabel/);
  assert.match(switcherSource, /disabled=\{isLocked\}/);
});
