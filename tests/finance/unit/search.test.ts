import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchQuery,
  calculateRelevanceScore,
  executeGlobalSearch
} from "@/lib/search/search-service";
import { store, reset } from "../mocks/db";
import { session } from "../mocks/auth";

// ============================================================================
// PHASE 9A — GLOBAL SEARCH SECURITY, RBAC & TEAM SCOPING TEST SUITE
// ============================================================================

test("Search Query Normalization: trims, collapses whitespace, bounds length", () => {
  assert.equal(normalizeSearchQuery("   "), "");
  assert.equal(normalizeSearchQuery("  Mohamed   Ali  "), "Mohamed Ali");
  const hugeQuery = "A".repeat(120);
  assert.equal(normalizeSearchQuery(hugeQuery).length, 80);
});

test("Search Relevance Scoring: exact > prefix > token > substring", () => {
  const exact = calculateRelevanceScore("Youcef", "Youcef");
  const prefix = calculateRelevanceScore("Youcef Belaili", "Youcef");
  const token = calculateRelevanceScore("Capitaine Youcef", "Youcef");
  const sub = calculateRelevanceScore("Bayoucef", "Youcef");

  assert.equal(exact, 100);
  assert.equal(prefix, 75);
  assert.equal(token, 50);
  assert.equal(sub, 25);
  assert.ok(exact > prefix && prefix > token && token > sub);
});

test("Short/Empty Query Guard: never performs search on queries shorter than 2 characters", async () => {
  const emptyRes = await executeGlobalSearch("");
  assert.equal(emptyRes.totalResults, 0);
  assert.equal(emptyRes.groups.length, 0);

  const singleCharRes = await executeGlobalSearch("a");
  assert.equal(singleCharRes.totalResults, 0);
  assert.equal(singleCharRes.groups.length, 0);
});

test("RBAC Boundary: Finance records are never exposed without finance.view permission", async () => {
  reset();
  // Populate store with an expense
  store.expense!.push({
    id: "exp-1",
    referenceNumber: "EXP-2026-001",
    description: "Ballons de match",
    amount: 15000,
    payeeName: "Fournisseur Sport",
    status: "POSTED",
    teamId: "team-1"
  });

  // User WITHOUT finance.view permission
  session.user = {
    id: "user-coach",
    name: "Coach",
    email: "coach@esh.dz",
    roleKey: "coach",
    roleName: "Coach",
    permissions: ["players.view", "matches.view"]
  };

  const result = await executeGlobalSearch("Ballons");
  const financeGroup = result.groups.find((g) => g.key === "finance");

  // Must not disclose Finance category or records
  assert.equal(financeGroup, undefined, "Finance group must not be returned to unauthorized user");
  assert.equal(result.totalResults, 0);
});

test("RBAC Boundary: Restricted documents are filtered out without documents.view.restricted", async () => {
  reset();
  store.document!.push(
    {
      id: "doc-pub",
      name: "Règlement Intérieur 2026",
      classification: "PUBLIC",
      category: "REGULATION",
      status: "APPROVED",
      teamId: null
    },
    {
      id: "doc-sec",
      name: "Rapport Médical Secret 2026",
      classification: "RESTRICTED",
      category: "MEDICAL",
      status: "APPROVED",
      teamId: null
    }
  );

  // User with basic documents.view but WITHOUT documents.view.restricted
  session.user = {
    id: "user-staff",
    name: "Staff Member",
    email: "staff@esh.dz",
    roleKey: "staff",
    roleName: "Staff",
    permissions: ["documents.view"]
  };

  // Unrestricted team scope
  store.role!.push({ key: "staff", teamScoped: false });

  const result = await executeGlobalSearch("2026");
  const docGroup = result.groups.find((g) => g.key === "documents");

  assert.ok(docGroup);
  const foundNames = docGroup.items.map((i) => i.title);
  assert.ok(foundNames.includes("Règlement Intérieur 2026"));
  assert.ok(!foundNames.includes("Rapport Médical Secret 2026"), "Restricted document must not be exposed");
});

test("Team Scoping: Restricted user cannot discover players or records of other teams", async () => {
  reset();
  // Team A and Team B
  store.team!.push(
    { id: "team-a", name: "ESH Seniors", category: "SENIOR", active: true },
    { id: "team-b", name: "ESH U19", category: "U19", active: true }
  );

  // Player on Team A and Player on Team B
  store.player!.push(
    {
      id: "p-a",
      firstName: "Karim",
      lastName: "Ziani",
      teamId: "team-a",
      position: "MIDFIELDER",
      shirtNumber: 10,
      team: { name: "ESH Seniors", category: "SENIOR" }
    },
    {
      id: "p-b",
      firstName: "Karim",
      lastName: "Matmour",
      teamId: "team-b",
      position: "FORWARD",
      shirtNumber: 7,
      team: { name: "ESH U19", category: "U19" }
    }
  );

  // User restricted to Team A
  session.user = {
    id: "user-coach-a",
    name: "Coach Seniors",
    email: "coach.a@esh.dz",
    roleKey: "coach-restricted",
    roleName: "Coach Restricted",
    permissions: ["players.view"]
  };
  store.role!.push({ key: "coach-restricted", teamScoped: true });
  store.userTeam!.push({ userId: "user-coach-a", teamId: "team-a" });

  const result = await executeGlobalSearch("Karim");
  const playerGroup = result.groups.find((g) => g.key === "players");

  assert.ok(playerGroup);
  assert.equal(playerGroup.count, 1);
  assert.equal(playerGroup.items[0].id, "p-a");
  assert.equal(playerGroup.items[0].title, "Karim Ziani");
});

test("Team Scoping: Restricted user with zero assigned teams receives 0 team-owned records", async () => {
  reset();
  store.player!.push({
    id: "p-1",
    firstName: "Ahmed",
    lastName: "Bensaid",
    teamId: "team-1",
    position: "FORWARD",
    shirtNumber: 9
  });

  // User with teamScoped=true but ZERO userTeam rows
  session.user = {
    id: "user-revoked",
    name: "Revoked Coach",
    email: "revoked@esh.dz",
    roleKey: "coach-revoked",
    roleName: "Coach Revoked",
    permissions: ["players.view"]
  };
  store.role!.push({ key: "coach-revoked", teamScoped: true });

  const result = await executeGlobalSearch("Ahmed");
  const playerGroup = result.groups.find((g) => g.key === "players");
  assert.equal(playerGroup, undefined, "Revoked user must discover zero team-owned records");
  assert.equal(result.totalResults, 0);
});

test("Multilingual & Case-Insensitive Search: matches Arabic and French queries", async () => {
  reset();
  store.news!.push({
    id: "news-ar",
    status: "PUBLISHED",
    category: "MATCH",
    translations: [
      { locale: "ar", title: "انتصار مستحق لأمل سيدي حسني في الديربي" },
      { locale: "fr", title: "Victoire méritée de l'ESH dans le derby" }
    ]
  });

  session.user = {
    id: "user-admin",
    name: "Admin",
    email: "admin@esh.dz",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["*"]
  };
  store.role!.push({ key: "admin", teamScoped: false });

  // 1. Search in Arabic
  const resAr = await executeGlobalSearch("انتصار", { locale: "ar" });
  const newsArGroup = resAr.groups.find((g) => g.key === "news");
  assert.ok(newsArGroup);
  assert.equal(newsArGroup.items[0].id, "news-ar");
  assert.match(newsArGroup.items[0].title, /انتصار/);

  // 2. Search in French
  const resFr = await executeGlobalSearch("victoire", { locale: "fr" });
  const newsFrGroup = resFr.groups.find((g) => g.key === "news");
  assert.ok(newsFrGroup);
  assert.equal(newsFrGroup.items[0].id, "news-ar");
  assert.match(newsFrGroup.items[0].title, /Victoire/);
});
