import { test } from "node:test";
import assert from "node:assert/strict";
import { getAuthorizedCommands } from "@/lib/commands/command-registry";
import { getAttentionItems } from "@/lib/commands/attention-service";
import { store, reset } from "../mocks/db";
import type { SessionUser } from "@/lib/permissions";
import type { TeamScope } from "@/lib/authz/policy";

// ============================================================================
// PHASE 9B — SMART COMMAND CENTER & ATTENTION SIGNALS TEST SUITE
// ============================================================================

test("Command Registry RBAC: Unauthorized navigation and actions are strictly filtered out", () => {
  const restrictedUser: SessionUser = {
    id: "user-coach-1",
    name: "Coach Kamel",
    email: "kamel@esh.dz",
    roleKey: "coach",
    roleName: "Coach",
    permissions: ["players.view", "matches.view", "training.view"]
  };

  const { navigation, actions } = getAuthorizedCommands(restrictedUser, "fr");

  const navHrefs = navigation.map((n) => n.href);
  const actHrefs = actions.map((a) => a.href);

  // Allowed
  assert.ok(navHrefs.includes("/fr/dashboard/players"));
  assert.ok(navHrefs.includes("/fr/dashboard/matches"));
  assert.ok(navHrefs.includes("/fr/dashboard/training"));

  // Strictly prohibited (no finance, users, roles, settings, audit)
  assert.ok(!navHrefs.includes("/fr/dashboard/finance"));
  assert.ok(!navHrefs.includes("/fr/dashboard/finance/expenses"));
  assert.ok(!navHrefs.includes("/fr/dashboard/finance/treasury"));
  assert.ok(!navHrefs.includes("/fr/dashboard/users"));
  assert.ok(!navHrefs.includes("/fr/dashboard/roles"));
  assert.ok(!navHrefs.includes("/fr/dashboard/settings"));
  assert.ok(!navHrefs.includes("/fr/dashboard/jobs"));
  assert.ok(!navHrefs.includes("/fr/dashboard/audit-logs"));

  // Prohibited actions
  assert.ok(!actHrefs.includes("/fr/dashboard/finance/expenses/new"));
  assert.ok(!actHrefs.includes("/fr/dashboard/finance/treasury/new"));
  assert.ok(!actHrefs.includes("/fr/dashboard/users/new"));
});

test("Command Registry Super-Admin: Receives full navigation and action catalogue", () => {
  const adminUser: SessionUser = {
    id: "user-admin-1",
    name: "Admin Principal",
    email: "admin@esh.dz",
    roleKey: "super_admin",
    roleName: "Administrateur",
    permissions: ["*"]
  };

  const { navigation, actions } = getAuthorizedCommands(adminUser, "ar");

  assert.ok(navigation.length >= 15);
  assert.ok(actions.length >= 10);

  // All sensitive routes are accessible
  const navHrefs = navigation.map((n) => n.href);
  assert.ok(navHrefs.includes("/ar/dashboard/finance"));
  assert.ok(navHrefs.includes("/ar/dashboard/users"));
  assert.ok(navHrefs.includes("/ar/dashboard/roles"));
  assert.ok(navHrefs.includes("/ar/dashboard/jobs"));
});

test("Command Registry Localization: Correctly produces Arabic RTL and French LTR titles", () => {
  const user: SessionUser = {
    id: "user-1",
    name: "User",
    email: "user@esh.dz",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["*"]
  };

  const arCommands = getAuthorizedCommands(user, "ar");
  const frCommands = getAuthorizedCommands(user, "fr");

  const arPlayersNav = arCommands.navigation.find((n) => n.id === "nav-players");
  const frPlayersNav = frCommands.navigation.find((n) => n.id === "nav-players");

  assert.equal(arPlayersNav?.title, "اللاعبون");
  assert.equal(frPlayersNav?.title, "Joueurs");
});

test("Attention Signals: Contracts expiring within 30 days are gated by contracts.view & TeamScope", async () => {
  reset();
  const now = new Date();
  const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  // Contract on Team A
  store.contract!.push({
    id: "c-1",
    type: "Professional",
    status: "ACTIVE",
    endDate: inTenDays,
    teamId: "team-a"
  });

  // Contract on Team B
  store.contract!.push({
    id: "c-2",
    type: "Professional",
    status: "ACTIVE",
    endDate: inTenDays,
    teamId: "team-b"
  });

  // 1. User without contracts.view receives 0 contract attention items
  const unauthorizedUser: SessionUser = {
    id: "user-no-contracts",
    name: "User",
    email: "user@esh.dz",
    roleKey: "staff",
    roleName: "Staff",
    permissions: ["players.view"]
  };
  const unauthScope: TeamScope = { restricted: false };
  const itemsUnauth = await getAttentionItems(unauthorizedUser, "ar", unauthScope);
  assert.equal(itemsUnauth.find((i) => i.id === "att-expiring-contracts"), undefined);

  // 2. User with contracts.view restricted to Team A receives count = 1 (only Team A contract)
  const coachA: SessionUser = {
    id: "user-coach-a",
    name: "Coach Team A",
    email: "coach.a@esh.dz",
    roleKey: "coach",
    roleName: "Coach",
    permissions: ["contracts.view"]
  };
  const scopeTeamA: TeamScope = { restricted: true, teamIds: ["team-a"] };
  const itemsCoachA = await getAttentionItems(coachA, "ar", scopeTeamA);
  const contractItem = itemsCoachA.find((i) => i.id === "att-expiring-contracts");

  assert.ok(contractItem);
  assert.equal(contractItem.count, 1, "Must only count contracts belonging to assigned team");
});

test("Attention Signals: Draft expenses are gated by finance.view and TeamScope", async () => {
  reset();
  // Draft expense on Team A
  store.expense!.push({
    id: "exp-draft-a",
    referenceNumber: "EXP-DRAFT-1",
    amount: 25000,
    status: "DRAFT",
    teamId: "team-a"
  });

  // Draft expense on Team B
  store.expense!.push({
    id: "exp-draft-b",
    referenceNumber: "EXP-DRAFT-2",
    amount: 50000,
    status: "DRAFT",
    teamId: "team-b"
  });

  // 1. User without finance.view
  const nonFinanceUser: SessionUser = {
    id: "user-coach",
    name: "Coach",
    email: "coach@esh.dz",
    roleKey: "coach",
    roleName: "Coach",
    permissions: ["players.view"]
  };
  const itemsNonFinance = await getAttentionItems(nonFinanceUser, "ar", { restricted: false });
  assert.equal(itemsNonFinance.find((i) => i.id === "att-draft-expenses"), undefined);

  // 2. Finance user restricted to Team A
  const financeUserTeamA: SessionUser = {
    id: "user-finance-a",
    name: "Finance Manager A",
    email: "finance.a@esh.dz",
    roleKey: "finance",
    roleName: "Finance",
    permissions: ["finance.view"]
  };
  const itemsFinanceA = await getAttentionItems(financeUserTeamA, "fr", { restricted: true, teamIds: ["team-a"] });
  const draftExpenseItem = itemsFinanceA.find((i) => i.id === "att-draft-expenses");

  assert.ok(draftExpenseItem);
  assert.equal(draftExpenseItem.count, 1, "Must only count draft expenses belonging to assigned team");
});

test("Attention Signals: Failed jobs are only visible to settings.manage", async () => {
  reset();
  store.backgroundJob!.push({
    id: "job-failed-1",
    queue: "notifications",
    status: "FAILED",
    payload: {},
    attempts: 3
  });

  // Standard staff user
  const staffUser: SessionUser = {
    id: "user-staff",
    name: "Staff",
    email: "staff@esh.dz",
    roleKey: "staff",
    roleName: "Staff",
    permissions: ["players.view", "documents.view"]
  };
  const itemsStaff = await getAttentionItems(staffUser, "ar", { restricted: false });
  assert.equal(itemsStaff.find((i) => i.id === "att-failed-jobs"), undefined);

  // Admin user with settings.manage
  const adminUser: SessionUser = {
    id: "user-admin",
    name: "Admin",
    email: "admin@esh.dz",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["settings.manage"]
  };
  const itemsAdmin = await getAttentionItems(adminUser, "ar", { restricted: false });
  const jobItem = itemsAdmin.find((i) => i.id === "att-failed-jobs");
  assert.ok(jobItem);
  assert.equal(jobItem.count, 1);
  assert.equal(jobItem.severity, "danger");
});
