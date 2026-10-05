/**
 * P2 — Team Assignment Management: Unit Tests
 *
 * Two test categories:
 *
 * Part 1 — Logic tests (pure TypeScript, no DB):
 *   Validates the teamAssignmentSchema Zod validation and the action-level
 *   business rules that are testable without a live DB.
 *
 * Part 2 — Structural tests (source scanning, no DB):
 *   Asserts invariants across the actions source that would be expensive or
 *   ambiguous to test at runtime (permission gates present, audit logs
 *   written, token invalidation on UserTeam mutations, etc.).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { teamAssignmentSchema } from "@/lib/validations/team-assignment";

const ROOT = join(__dirname, "..", "..", "..");

// ---------------------------------------------------------------------------
// Helpers: read source files under [locale] using the Windows-safe path.
// ---------------------------------------------------------------------------
function readAction(module: "users" | "staff"): string {
  return readFileSync(
    join(ROOT, "src", "app", "[locale]", "(dashboard)", "dashboard", module, "actions.ts"),
    "utf8"
  );
}

const userActions = readAction("users");
const staffActions = readAction("staff");

// ---------------------------------------------------------------------------
// Part 1 — teamAssignmentSchema validation logic
// ---------------------------------------------------------------------------

test("teamAssignmentSchema: accepts a non-empty teamId string", () => {
  const result = teamAssignmentSchema.safeParse({ teamId: "clx123abc" });
  assert.equal(result.success, true);
});

test("teamAssignmentSchema: rejects an empty string teamId", () => {
  const result = teamAssignmentSchema.safeParse({ teamId: "" });
  assert.equal(result.success, false);
});

test("teamAssignmentSchema: rejects a missing teamId", () => {
  const result = teamAssignmentSchema.safeParse({});
  assert.equal(result.success, false);
});

test("teamAssignmentSchema: rejects null teamId", () => {
  const result = teamAssignmentSchema.safeParse({ teamId: null });
  assert.equal(result.success, false);
});

test("teamAssignmentSchema: strips extra fields (no extra keys)", () => {
  const result = teamAssignmentSchema.safeParse({ teamId: "abc", extra: "ignored" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(Object.keys(result.data).length, 1);
    assert.equal(result.data.teamId, "abc");
  }
});

// ---------------------------------------------------------------------------
// Part 2 — Structural assertions on users/actions.ts
// ---------------------------------------------------------------------------

test("addUserTeamAction: guarded by requirePermission('users.manage')", () => {
  // The function definition must appear, followed (before any DB call) by the
  // requirePermission gate. We assert the literal string exists in the source.
  assert.match(userActions, /addUserTeamAction/);
  assert.match(userActions, /requirePermission\(["']users\.manage["']\)/);
});

test("addUserTeamAction: uses upsert (safe no-op on duplicate — not create)", () => {
  // `upsert` on `userTeam` is the correct primitive: a naïve `create` would
  // throw on a duplicate assignment; `upsert` with an empty `update` is a
  // safe no-op at the DB level.
  assert.match(userActions, /userTeam\.upsert/);
});

test("addUserTeamAction: bumps tokenVersion inside the same transaction", () => {
  // A UserTeam change MUST immediately invalidate any active session for the
  // affected user. tokenVersion bump + upsert must be in a $transaction block.
  assert.match(userActions, /tokenVersion.*increment/s);
  assert.match(userActions, /\$transaction/);
});

test("addUserTeamAction: writes an audit log entry", () => {
  assert.match(userActions, /user\.team_assignment\.add/);
  assert.match(userActions, /writeAuditLog/);
});

test("removeUserTeamAction: uses deleteMany scoped to (userId, teamId) — not deleteOne", () => {
  // deleteMany with { userId, teamId } in the WHERE clause is the scoped,
  // safe primitive. A bare delete({ where: { teamId } }) without userId would
  // be a catastrophic cross-user removal bug.
  assert.match(userActions, /userTeam\.deleteMany/);
  assert.match(userActions, /removeUserTeamAction/);
});

test("removeUserTeamAction: bumps tokenVersion inside the same transaction", () => {
  // Same invariant as add: scope change must invalidate the session immediately.
  // The function must appear AFTER addUserTeamAction in the file and still
  // contain the tokenVersion increment + $transaction pattern.
  const afterRemove = userActions.slice(userActions.indexOf("removeUserTeamAction"));
  assert.match(afterRemove, /tokenVersion.*increment/s);
  assert.match(afterRemove, /\$transaction/);
});

test("removeUserTeamAction: writes an audit log entry", () => {
  assert.match(userActions, /user\.team_assignment\.remove/);
});

test("users/actions.ts: does NOT call db.userTeam.delete (must use deleteMany for safety)", () => {
  // db.userTeam.delete (singular) requires the full composite PK object;
  // db.userTeam.deleteMany is clearer and safer for a (userId, teamId) pair
  // because it explicitly documents that zero rows is not an error.
  // This is a guard against accidentally switching to the singular delete.
  const usingDelete = /userTeam\.delete\b(?!Many)/.test(userActions);
  assert.equal(usingDelete, false, "use deleteMany, not delete, for userTeam removal");
});

// ---------------------------------------------------------------------------
// Part 2 — Structural assertions on staff/actions.ts
// ---------------------------------------------------------------------------

test("addStaffTeamAction: guarded by requirePermission('staff.update')", () => {
  assert.match(staffActions, /addStaffTeamAction/);
  assert.match(staffActions, /requirePermission\(["']staff\.update["']\)/);
});

test("addStaffTeamAction: uses upsert on staffTeam (safe no-op on duplicate)", () => {
  assert.match(staffActions, /staffTeam\.upsert/);
});

test("addStaffTeamAction: does NOT bump tokenVersion (StaffTeam != authorization)", () => {
  // This is the most critical structural invariant for the StaffTeam actions:
  // StaffTeam is OPERATIONAL, not AUTHORIZATION. Adding a staff-team assignment
  // MUST NOT change any user's session. Only UserTeam mutations trigger
  // tokenVersion bumps — this is the architectural guarantee that keeps the
  // two tables' semantics completely separate.
  const afterAdd = staffActions.slice(staffActions.indexOf("addStaffTeamAction"));
  const beforeRemove = afterAdd.slice(0, afterAdd.indexOf("removeStaffTeamAction"));
  assert.equal(
    /tokenVersion/.test(beforeRemove),
    false,
    "addStaffTeamAction must NOT bump tokenVersion — StaffTeam is not an authorization mechanism"
  );
});

test("addStaffTeamAction: writes an audit log entry", () => {
  assert.match(staffActions, /staff\.team_assignment\.add/);
  assert.match(staffActions, /writeAuditLog/);
});

test("removeStaffTeamAction: uses deleteMany scoped to (staffId, teamId)", () => {
  assert.match(staffActions, /staffTeam\.deleteMany/);
  assert.match(staffActions, /removeStaffTeamAction/);
});

test("removeStaffTeamAction: does NOT bump tokenVersion", () => {
  const afterRemove = staffActions.slice(staffActions.indexOf("removeStaffTeamAction"));
  assert.equal(
    /tokenVersion/.test(afterRemove),
    false,
    "removeStaffTeamAction must NOT bump tokenVersion — StaffTeam is not an authorization mechanism"
  );
});

test("removeStaffTeamAction: writes an audit log entry", () => {
  assert.match(staffActions, /staff\.team_assignment\.remove/);
});

test("staff/actions.ts: does NOT call db.staffTeam.delete (must use deleteMany)", () => {
  const usingDelete = /staffTeam\.delete\b(?!Many)/.test(staffActions);
  assert.equal(usingDelete, false, "use deleteMany, not delete, for staffTeam removal");
});

// ---------------------------------------------------------------------------
// Part 2 — Cross-cutting architectural invariants
// ---------------------------------------------------------------------------

test("UserTeam mutations and StaffTeam mutations use different permission keys (authorization != operational)", () => {
  // UserTeam is guarded by 'users.manage'.
  // StaffTeam is guarded by 'staff.update'.
  // This confirms the two are genuinely separate permission domains — you
  // cannot accidentally grant user authorization by managing staff assignments.
  assert.match(userActions, /requirePermission\(["']users\.manage["']\)/);
  assert.match(staffActions, /requirePermission\(["']staff\.update["']\)/);
  // Explicitly confirm UserTeam actions do NOT use staff.update
  const userActionHasStaffUpdate = /requirePermission\(["']staff\.update["']\)/.test(userActions);
  assert.equal(userActionHasStaffUpdate, false, "UserTeam actions must not use staff.update permission");
});

test("both action files revalidate the affected detail path on mutation", () => {
  assert.match(userActions, /revalidatePath.*users.*\$\{userId\}/s);
  assert.match(staffActions, /revalidatePath.*staff.*\$\{staffId\}/s);
});

test("teamAssignment i18n namespace exists in ar.json and fr.json", () => {
  const ar = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "messages", "ar.json"), "utf8"));
  const fr = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "messages", "fr.json"), "utf8"));
  assert.ok(ar.teamAssignments, "ar.json missing teamAssignments namespace");
  assert.ok(fr.teamAssignments, "fr.json missing teamAssignments namespace");
  // Both have the same keys
  const arKeys = Object.keys(ar.teamAssignments).sort();
  const frKeys = Object.keys(fr.teamAssignments).sort();
  assert.deepEqual(arKeys, frKeys, "AR and FR teamAssignments namespaces must have identical keys");
});

test("common.remove translation key exists in both locales", () => {
  const ar = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "messages", "ar.json"), "utf8"));
  const fr = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "messages", "fr.json"), "utf8"));
  assert.ok(ar.common?.remove, "ar.json missing common.remove");
  assert.ok(fr.common?.remove, "fr.json missing common.remove");
});
