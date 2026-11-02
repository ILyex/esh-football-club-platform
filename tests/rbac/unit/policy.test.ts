import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { db, store, reset, type RoleRow, type UserTeamRow } from "../mocks/db";
import {
  resolveTeamScope,
  scopeIncludesTeam,
  teamIdWhere,
  describeScopeKind,
  UNRESTRICTED_SCOPE,
  NO_TEAMS_SCOPE,
  type TeamScope,
  type ScopeKind,
  type ScopeSubjectUser
} from "@/lib/authz/policy";

beforeEach(reset);

const user = (over: Partial<ScopeSubjectUser> = {}): ScopeSubjectUser => ({ id: "u1", roleKey: "coach", permissions: [], ...over });
const role = (r: RoleRow) => store.roles.push(r);
const assign = (rows: UserTeamRow[]) => store.userTeams.push(...rows);

// ---------------------------------------------------------------- resolveTeamScope
test("only the super-admin wildcard is unrestricted regardless of teamScoped or assignments", async () => {
  role({ key: "coach", teamScoped: true });
  assign([{ userId: "u1", teamId: "team-a" }]);
  const scope = await resolveTeamScope(db, user({ roleKey: "super_admin", permissions: ["*"] }));
  assert.deepEqual(scope, UNRESTRICTED_SCOPE);
});

test("a non-teamScoped role is unrestricted (existing role behavior preserved exactly)", async () => {
  role({ key: "coach", teamScoped: false });
  const scope = await resolveTeamScope(db, user());
  assert.deepEqual(scope, UNRESTRICTED_SCOPE);
});

test("an unknown role fails closed to no teams instead of inferring an unrestricted role", async () => {
  // No role row seeded at all — missing role metadata cannot grant access.
  const scope = await resolveTeamScope(db, user({ roleKey: "does-not-exist" }));
  assert.deepEqual(scope, NO_TEAMS_SCOPE);
});

test("a teamScoped role with zero UserTeam rows fails closed to NO teams (not to unrestricted)", async () => {
  role({ key: "coach", teamScoped: true });
  const scope = await resolveTeamScope(db, user());
  assert.deepEqual(scope, NO_TEAMS_SCOPE);
  assert.equal(scope.restricted, true);
  if (scope.restricted) assert.deepEqual(scope.teamIds, []);
});

test("a teamScoped role is restricted to exactly its assigned teams — one team", async () => {
  role({ key: "coach", teamScoped: true });
  assign([{ userId: "u1", teamId: "team-a" }]);
  const scope = await resolveTeamScope(db, user());
  assert.deepEqual(scope, { restricted: true, teamIds: ["team-a"] });
});

test("a teamScoped role can be restricted to multiple teams (multi-team staff/coach support)", async () => {
  role({ key: "coach", teamScoped: true });
  assign([
    { userId: "u1", teamId: "team-a" },
    { userId: "u1", teamId: "team-b" }
  ]);
  const scope = await resolveTeamScope(db, user());
  assert.deepEqual(scope, { restricted: true, teamIds: ["team-a", "team-b"] });
});

test("assignments belonging to OTHER users never leak into this user's scope", async () => {
  role({ key: "coach", teamScoped: true });
  assign([
    { userId: "someone-else", teamId: "team-a" },
    { userId: "u1", teamId: "team-b" }
  ]);
  const scope = await resolveTeamScope(db, user());
  assert.deepEqual(scope, { restricted: true, teamIds: ["team-b"] });
});

test("resolveTeamScope reads fresh from the database every call — no caching across calls (simulates an admin adding/removing an assignment between two requests)", async () => {
  role({ key: "coach", teamScoped: true });
  const before = await resolveTeamScope(db, user());
  assert.deepEqual(before, NO_TEAMS_SCOPE);
  assign([{ userId: "u1", teamId: "team-a" }]);
  const after = await resolveTeamScope(db, user());
  assert.deepEqual(after, { restricted: true, teamIds: ["team-a"] });
});

// ---------------------------------------------------------------- scopeIncludesTeam (pure)
test("scopeIncludesTeam: unrestricted always true, including for a null/undefined team", () => {
  assert.equal(scopeIncludesTeam(UNRESTRICTED_SCOPE, "team-a"), true);
  assert.equal(scopeIncludesTeam(UNRESTRICTED_SCOPE, null), true);
  assert.equal(scopeIncludesTeam(UNRESTRICTED_SCOPE, undefined), true);
});
test("scopeIncludesTeam: restricted scope matches only an exact assigned team id", () => {
  const scope: TeamScope = { restricted: true, teamIds: ["team-a", "team-b"] };
  assert.equal(scopeIncludesTeam(scope, "team-a"), true);
  assert.equal(scopeIncludesTeam(scope, "team-b"), true);
  assert.equal(scopeIncludesTeam(scope, "team-c"), false);
});
test("scopeIncludesTeam: restricted scope never matches a record with no team owner (null), even with assignments", () => {
  const scope: TeamScope = { restricted: true, teamIds: ["team-a"] };
  assert.equal(scopeIncludesTeam(scope, null), false);
  assert.equal(scopeIncludesTeam(scope, undefined), false);
});
test("scopeIncludesTeam: NO_TEAMS_SCOPE (fail-closed) matches nothing at all", () => {
  assert.equal(scopeIncludesTeam(NO_TEAMS_SCOPE, "team-a"), false);
  assert.equal(scopeIncludesTeam(NO_TEAMS_SCOPE, null), false);
});

// ---------------------------------------------------------------- teamIdWhere (typed filter helper)
type FakeWhereInput = { teamId?: string | { in: readonly string[] } | null; otherField?: string };
test("teamIdWhere: unrestricted scope produces an empty filter (no restriction added)", () => {
  const where = teamIdWhere<FakeWhereInput>(UNRESTRICTED_SCOPE);
  assert.deepEqual(where, {});
});
test("teamIdWhere: restricted scope produces an 'in' filter over exactly the assigned teams", () => {
  const scope: TeamScope = { restricted: true, teamIds: ["team-a", "team-b"] };
  const where = teamIdWhere<FakeWhereInput>(scope);
  assert.deepEqual(where, { teamId: { in: ["team-a", "team-b"] } });
});
test("teamIdWhere: NO_TEAMS_SCOPE produces an 'in' filter over an empty list (matches nothing — Prisma semantics for `in: []`)", () => {
  const where = teamIdWhere<FakeWhereInput>(NO_TEAMS_SCOPE);
  assert.deepEqual(where, { teamId: { in: [] } });
});

// ---------------------------------------------------------------- ScopeKind exhaustiveness
test("describeScopeKind covers all five ScopeKind variants (compile-time exhaustive switch + runtime spot check)", () => {
  const kinds: ScopeKind[] = ["PUBLIC", "CLUB_WIDE", "TEAM_OWNED", "VIA_RELATION", "SENSITIVE_ADMIN"];
  for (const k of kinds) assert.equal(typeof describeScopeKind(k), "string");
});

// ---------------------------------------------------------------- source-level guards
const ROOT = join(__dirname, "..", "..", "..");
const policySource = readFileSync(join(ROOT, "src/lib/authz/policy.ts"), "utf8");

test("policy.ts contains no `Record<string, unknown>` authorization shortcut as actual code (comments mentioning the anti-pattern by name are fine)", () => {
  const codeOnly = policySource
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "")) // strip // comments; policy.ts uses only line comments
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, ""); // strip any /* */ block comments defensively
  assert.equal(/Record<\s*string\s*,\s*unknown\s*>/.test(codeOnly), false, "found outside comments");
});
test("policy.ts is wired into server code only — never into a Client Component", () => {
  // This test used to assert that policy.ts was imported by NOTHING (the P1
  // "foundation only" state). P4 wired it into the mobile API, the search
  // service and the mutation guards, so the invariant now is the one that
  // matters for security: team-scope resolution is server-only and must never
  // end up in a browser bundle.
  function walkTs(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry as string);
      if (statSync(full).isDirectory()) {
        results.push(...walkTs(full));
      } else if (/\.(ts|tsx)$/.test(entry as string)) {
        results.push(full);
      }
    }
    return results;
  }
  const rootDir = join(ROOT, "src");
  const importers = walkTs(rootDir).filter((file) => {
    const src = readFileSync(file, "utf8") as string;
    return src.includes("@/lib/authz/policy") && file.replace(/\\/g, "/") !== "src/lib/authz/policy.ts";
  });
  assert.ok(importers.length > 0, "policy.ts must be used by the app, not left as dead foundation code");
  const clientImporters = importers.filter((file) => (readFileSync(file, "utf8") as string).includes('"use client"'));
  assert.deepEqual(clientImporters, [], "no Client Component may import the authorization policy directly");
  // The module itself must stay server-only so a mistake fails the build.
  assert.match(readFileSync(join(ROOT, "src/lib/authz/policy.ts"), "utf8") as string, /^import "server-only";/m);
});
test("Role.teamScoped defaults to false in schema.prisma (existing role behavior preserved)", () => {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /teamScoped\s+Boolean\s+@default\(false\)/);
});
test("UserTeam and StaffTeam declare a composite primary key (database-level uniqueness, not application-only)", () => {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const userTeam = schema.match(/model UserTeam \{[\s\S]*?\n\}/)![0];
  const staffTeam = schema.match(/model StaffTeam \{[\s\S]*?\n\}/)![0];
  assert.match(userTeam, /@@id\(\[userId,\s*teamId\]\)/, "UserTeam must have @@id([userId, teamId])");
  assert.match(staffTeam, /@@id\(\[staffId,\s*teamId\]\)/, "StaffTeam must have @@id([staffId, teamId])");
  // Neither table may ALSO declare a separate @@unique — the composite PK is the sole uniqueness mechanism, avoiding a redundant/conflicting constraint.
  assert.equal(/@@unique/.test(userTeam), false);
  assert.equal(/@@unique/.test(staffTeam), false);
});
test("Staff.userId is nullable and unique (at most one Staff per User; most Staff have none)", () => {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /userId\s+String\?\s+@unique/);
});
test("schema change against the pre-P1 v3 reference is purely additive (0 lines removed)", (t) => {
  // Uses scripts/reference-v3-schema.prisma — an exact, hash-verified copy of
  // the pre-P1 v3 schema.prisma shipped INSIDE this same package (see the P1
  // migration script, which relies on this same file for baselining). This
  // replaces an earlier version of this test that depended on an external
  // delivery artifact (a zip outside the repo) and silently returned/passed
  // when that zip wasn't present — which could look like "verified" when
  // nothing had actually been checked. A project-local, shipped reference
  // file removes that external dependency entirely.
  const referencePath = join(ROOT, "scripts/reference-v3-schema.prisma");
  if (!existsSync(referencePath)) {
    // Honest, visible skip — not a silent pass. Node's test runner reports
    // this distinctly from a passing assertion, so "this invariant was
    // verified" can never be inferred from a green run when the reference
    // file is missing (which would itself be a packaging bug worth fixing).
    t.skip(`scripts/reference-v3-schema.prisma not found at ${referencePath} — additive-diff invariant NOT verified this run`);
    return;
  }
  const reference = readFileSync(referencePath, "utf8");
  const current = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const norm = (l: string) => l.trim().replace(/\s+/g, " ");
  const referenceLines = reference.split("\n");
  const currentLineSet = new Set(current.split("\n").map(norm));
  // Line-presence check (not a positional diff): every line that existed in
  // the pre-P1 schema must still be present verbatim somewhere in the current
  // schema (normalized for whitespace formatting).
  const missing = referenceLines.filter((line) => line.trim() !== "" && !currentLineSet.has(norm(line)));
  assert.deepEqual(missing, [], "lines present in the pre-P1 v3 schema but missing from the current schema (should be empty — additive only)");
});
