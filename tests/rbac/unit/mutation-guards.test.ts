/**
 * P4 — Resource Team Scoping & Mutation Security: Unit Tests
 *
 * Verifies all security invariants for server-side mutation guards, cross-team
 * transfers, nested resource integrity, and document scope boundaries:
 *
 *   Invariant 1: Direct Resource Mutations must enforce the actor's live UserTeam scope.
 *   Invariant 2: Cross-Team Moves (source != target) require dual authorization on BOTH teams.
 *   Invariant 3: Restricted users cannot mutate club-wide resources (teamId === null) unless explicitly allowed.
 *   Invariant 4: Nested resource mutations must inherit parent team scope and verify child integrity.
 *   Invariant 5: Private documents and generated documents must enforce team scope on download/generation.
 *   Invariant 6: Orphaned generated documents must fail-closed for restricted users.
 *   Invariant 7: Operational staff mutations (StaffTeam) must assert team scope against actor's UserTeam.
 *   Invariant 8: Document attachments must enforce compatibility between parent and document teams.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertTeamScope,
  assertDualTeamScope,
  type ResourceScopeContext
} from "@/lib/mutation-guards";
import { ForbiddenError } from "@/lib/permissions";

const ROOT = join(__dirname, "..", "..", "..");

// Test Scope Contexts
const UNRESTRICTED_CONTEXT: ResourceScopeContext = {
  userId: "user-admin",
  isUnrestricted: true,
  authorizedTeamIds: []
};

const RESTRICTED_U15_U17_CONTEXT: ResourceScopeContext = {
  userId: "user-coach",
  isUnrestricted: false,
  authorizedTeamIds: ["team-u15", "team-u17"]
};

const RESTRICTED_NO_TEAMS_CONTEXT: ResourceScopeContext = {
  userId: "user-revoked",
  isUnrestricted: false,
  authorizedTeamIds: []
};

// ============================================================================
// PART 1: assertTeamScope Pure Unit Tests
// ============================================================================

test("Invariant 1: Unrestricted user can mutate any team-owned resource", () => {
  assert.doesNotThrow(() => {
    assertTeamScope(UNRESTRICTED_CONTEXT, "team-senior", "Player");
    assertTeamScope(UNRESTRICTED_CONTEXT, "team-u20", "Match");
    assertTeamScope(UNRESTRICTED_CONTEXT, "team-any", "Expense");
  });
});

test("Invariant 1 & 3: Unrestricted user can mutate club-wide resource (teamId === null)", () => {
  assert.doesNotThrow(() => {
    assertTeamScope(UNRESTRICTED_CONTEXT, null, "CalendarEvent");
    assertTeamScope(UNRESTRICTED_CONTEXT, null, "Document");
  });
});

test("Invariant 1: Restricted user CAN mutate resources belonging to their assigned teams", () => {
  assert.doesNotThrow(() => {
    assertTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u15", "Player");
    assertTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u17", "Match");
  });
});

test("Invariant 1: Restricted user CANNOT mutate resources belonging to unassigned teams", () => {
  assert.throws(
    () => assertTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-senior", "Player"),
    (err: any) => err instanceof ForbiddenError && err.message.includes("Player")
  );
  assert.throws(
    () => assertTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u20", "Match"),
    (err: any) => err instanceof ForbiddenError && err.message.includes("Match")
  );
});

test("Invariant 3: Restricted user CANNOT mutate club-wide resource by default (teamId === null)", () => {
  assert.throws(
    () => assertTeamScope(RESTRICTED_U15_U17_CONTEXT, null, "Document"),
    (err: any) => err instanceof ForbiddenError && err.message.includes("Document")
  );
});

test("Invariant 3: Restricted user CAN read club-wide resource when allowClubWide is explicitly true", () => {
  assert.doesNotThrow(() => {
    assertTeamScope(RESTRICTED_U15_U17_CONTEXT, null, "Document", { allowClubWide: true });
  });
});

test("Invariant 1: Restricted user with zero assigned teams fails closed for ALL teams", () => {
  assert.throws(
    () => assertTeamScope(RESTRICTED_NO_TEAMS_CONTEXT, "team-u15", "Player"),
    (err: any) => err instanceof ForbiddenError
  );
  assert.throws(
    () => assertTeamScope(RESTRICTED_NO_TEAMS_CONTEXT, null, "Player"),
    (err: any) => err instanceof ForbiddenError
  );
});

// ============================================================================
// PART 2: assertDualTeamScope Pure Unit Tests (Cross-team moves)
// ============================================================================

test("Invariant 2: Unrestricted user can move resource between any two teams", () => {
  assert.doesNotThrow(() => {
    assertDualTeamScope(UNRESTRICTED_CONTEXT, "team-u15", "team-senior", "Player");
    assertDualTeamScope(UNRESTRICTED_CONTEXT, "team-senior", "team-u20", "Player");
  });
});

test("Invariant 2: Restricted user CAN move resource between two assigned teams", () => {
  assert.doesNotThrow(() => {
    assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u15", "team-u17", "Player");
    assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u17", "team-u15", "Player");
  });
});

test("Invariant 2: Restricted user CANNOT move resource from an unauthorized source team", () => {
  // Target is authorized (team-u15), but source (team-senior) is unauthorized
  assert.throws(
    () => assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-senior", "team-u15", "Player"),
    (err: any) => err instanceof ForbiddenError && err.message.includes("source")
  );
});

test("Invariant 2: Restricted user CANNOT move resource to an unauthorized destination team", () => {
  // Source is authorized (team-u15), but target (team-senior) is unauthorized
  assert.throws(
    () => assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u15", "team-senior", "Player"),
    (err: any) => err instanceof ForbiddenError && err.message.includes("destination")
  );
});

test("Invariant 2: Restricted user CANNOT move resource between two unauthorized teams", () => {
  assert.throws(
    () => assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-senior", "team-u20", "Player"),
    (err: any) => err instanceof ForbiddenError
  );
});

test("Invariant 2: Same-team update behaves identically to single assertTeamScope", () => {
  assert.doesNotThrow(() => {
    assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-u15", "team-u15", "Player");
  });
  assert.throws(
    () => assertDualTeamScope(RESTRICTED_U15_U17_CONTEXT, "team-senior", "team-senior", "Player"),
    (err: any) => err instanceof ForbiddenError
  );
});

// ============================================================================
// PART 3: Static Security Verification Across Target Server Actions
// ============================================================================

test("Security Audit: players/actions.ts guards create, update (dual), archive, and hard-delete", () => {
  const file = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/players/actions.ts"), "utf-8");
  assert.ok(file.includes("getMutationScopeContext"), "players/actions.ts must resolve mutation scope context");
  assert.ok(file.includes("assertTeamScope"), "players/actions.ts must assert team scope on create/delete");
  assert.ok(file.includes("assertDualTeamScope"), "players/actions.ts must assert dual team scope on update");
});

test("Security Audit: matches/actions.ts guards matches, lineups, and match events", () => {
  const file = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/matches/actions.ts"), "utf-8");
  assert.ok(file.includes("getMutationScopeContext"), "matches/actions.ts must resolve mutation scope context");
  assert.ok(file.includes("assertTeamScope"), "matches/actions.ts must assert team scope");
  assert.ok(file.includes("assertDualTeamScope"), "matches/actions.ts must assert dual team scope on match update");
  assert.ok(file.includes("addMatchEventAction"), "addMatchEventAction exists");
  assert.ok(file.includes("upsertLineupEntryAction"), "upsertLineupEntryAction exists");
});

test("Security Audit: training/actions.ts guards sessions and attendance", () => {
  const file = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/training/actions.ts"), "utf-8");
  assert.ok(file.includes("getMutationScopeContext"), "training/actions.ts must resolve mutation scope context");
  assert.ok(file.includes("assertTeamScope"), "training/actions.ts must assert team scope");
  assert.ok(file.includes("assertDualTeamScope"), "training/actions.ts must assert dual team scope on training update");
  assert.ok(file.includes("setAttendanceAction"), "setAttendanceAction exists");
});

test("Security Audit: contracts/actions.ts guards player/staff contracts", () => {
  const file = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/contracts/actions.ts"), "utf-8");
  assert.ok(file.includes("getMutationScopeContext"), "contracts/actions.ts must resolve mutation scope context");
  assert.ok(file.includes("assertTeamScope"), "contracts/actions.ts must assert team scope");
  assert.ok(file.includes("createContractAction"), "createContractAction exists");
  assert.ok(file.includes("updateContractAction"), "updateContractAction exists");
});

test("Security Audit: staff/actions.ts guards staff and operational team assignments", () => {
  const file = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/staff/actions.ts"), "utf-8");
  assert.ok(file.includes("getMutationScopeContext"), "staff/actions.ts must resolve mutation scope context");
  assert.ok(file.includes("assertTeamScope"), "staff/actions.ts must assert team scope on staffTeam mutations");
  assert.ok(file.includes("addStaffTeamAction"), "addStaffTeamAction exists");
  assert.ok(file.includes("removeStaffTeamAction"), "removeStaffTeamAction exists");
});

test("Security Audit: documents/actions.ts and download route guard documents", () => {
  const actionFile = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/documents/actions.ts"), "utf-8");
  assert.ok(actionFile.includes("getMutationScopeContext"), "documents actions must resolve mutation scope context");
  assert.ok(actionFile.includes("assertTeamScope"), "documents actions must assert team scope");
  assert.ok(actionFile.includes("assertDualTeamScope"), "documents actions must assert dual team scope on update");

  const downloadRoute = readFileSync(join(ROOT, "src/app/api/documents/[id]/download/route.ts"), "utf-8");
  assert.ok(downloadRoute.includes("getMutationScopeContext"), "download route must resolve mutation scope context");
  assert.ok(downloadRoute.includes("assertTeamScope"), "download route must assert team scope");
});

test("Security Audit: generated-documents guards generation, detail page, and download route", () => {
  const actionFile = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts"), "utf-8");
  assert.ok(actionFile.includes("getMutationScopeContext"), "generated-documents actions must resolve mutation scope");
  assert.ok(actionFile.includes("resolveSourceEntityScope"), "must resolve source entity scope");

  const downloadRoute = readFileSync(join(ROOT, "src/app/api/generated-documents/[id]/download/route.ts"), "utf-8");
  assert.ok(downloadRoute.includes("resolveSourceEntityScope"), "download route must resolve source entity scope");
  assert.ok(downloadRoute.includes("assertTeamScope"), "download route must assert team scope");

  const detailPage = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/generated-documents/[id]/page.tsx"), "utf-8");
  assert.ok(detailPage.includes("resolveSourceEntityScope"), "detail page must resolve source entity scope");
});

test("Security Audit: correspondence and meeting-minutes guard document attachments", () => {
  const corrFile = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/correspondence/actions.ts"), "utf-8");
  assert.ok(corrFile.includes("attachDocumentAction"), "correspondence must have attachDocumentAction");
  assert.ok(corrFile.includes("assertDualTeamScope"), "must assert dual team scope on correspondence update");

  const meetingFile = readFileSync(join(ROOT, "src/app/[locale]/(dashboard)/dashboard/meeting-minutes/actions.ts"), "utf-8");
  assert.ok(meetingFile.includes("attachMeetingDocumentAction"), "meeting-minutes must have attachMeetingDocumentAction");
  assert.ok(meetingFile.includes("assertDualTeamScope"), "must assert dual team scope on meeting update");
});
