import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fafPlayerLicenceSchema, fafMatchFixtureSchema } from "@/lib/integrations/faf/schemas";
import {
  normalizeLicenceNumber,
  mapFafPositionToPrisma,
  mapFafCategoryToPrisma,
  mapFafPlayerStatusToPrisma
} from "@/lib/integrations/faf/normalizer";
import {
  shouldUpdateFieldFromFAF,
  PLAYER_AUTHORITY_RULES
} from "@/lib/integrations/faf/authority-matrix";
import { FAFMockAdapter, FAFHttpAdapter, setFAFClient, getFAFClient } from "@/lib/integrations/faf/client";
import { syncFAFPlayers, getFAFIntegrationStatus } from "@/lib/integrations/faf/sync-service";
import {
  encryptData,
  decryptData,
  FAFSessionManagerImpl,
  FAFSessionManager
} from "@/lib/integrations/faf/session-manager";
import { store, reset } from "../mocks/db";
import type { SessionUser } from "@/lib/permissions";
import type { TeamScope } from "@/lib/authz/policy";

// Ensure test environment encryption key is available
process.env.FAF_SESSION_ENCRYPTION_KEY = process.env.FAF_SESSION_ENCRYPTION_KEY || "test-secret-key-32-chars-minimum-length-for-faf!";

// ============================================================================
// PHASE 10B — FAF CONNECT INTEGRATION & SECURITY TEST SUITE
// ============================================================================

test("FAF Validation: fafPlayerLicenceSchema accepts valid Algerian federation licence", () => {
  const valid = {
    licenceNumber: "26-001452/LRFT",
    firstName: "Youcef",
    lastName: "Belaili",
    dateOfBirth: "2002-05-14",
    nationality: "Algérienne",
    category: "SENIOR",
    status: "VALID"
  };

  const parsed = fafPlayerLicenceSchema.parse(valid);
  assert.equal(parsed.licenceNumber, "26-001452/LRFT");
  assert.equal(parsed.firstName, "Youcef");
  assert.equal(parsed.status, "VALID");
});

test("FAF Validation: rejects malformed licence numbers and future birth dates", () => {
  // Invalid licence characters
  assert.throws(
    () =>
      fafPlayerLicenceSchema.parse({
        licenceNumber: "26; DROP TABLE Players; --",
        firstName: "Test",
        lastName: "Player",
        dateOfBirth: "2000-01-01",
        category: "SENIOR"
      }),
    /Licence contains invalid characters/
  );

  // Future birth date
  assert.throws(
    () =>
      fafPlayerLicenceSchema.parse({
        licenceNumber: "26-009999",
        firstName: "Future",
        lastName: "Player",
        dateOfBirth: "2099-01-01",
        category: "SENIOR"
      }),
    /Date of birth must be a valid past date/
  );
});

test("FAF Security: rejects SSRF attempts in external photo URLs", () => {
  const hostileHosts = [
    "http://localhost:8080/avatar.jpg",
    "http://127.0.0.1:3000/api/keys",
    "http://192.168.1.1/admin/pic.png",
    "http://10.0.0.1/internal.jpg"
  ];

  for (const hostileUrl of hostileHosts) {
    assert.throws(
      () =>
        fafPlayerLicenceSchema.parse({
          licenceNumber: "26-008888",
          firstName: "Photo",
          lastName: "Test",
          dateOfBirth: "2001-01-01",
          category: "SENIOR",
          photoUrl: hostileUrl
        }),
      /SSRF protection/
    );
  }
});

test("FAF Authority Matrix: local notes and contracts are strictly immune to FAF overwrite", () => {
  assert.equal(PLAYER_AUTHORITY_RULES["internalNotes"], "ESH_AUTHORITATIVE");
  assert.equal(PLAYER_AUTHORITY_RULES["contracts"], "ESH_AUTHORITATIVE");
  assert.equal(PLAYER_AUTHORITY_RULES["salary"], "ESH_AUTHORITATIVE");
  assert.equal(PLAYER_AUTHORITY_RULES["tacticalRating"], "ESH_AUTHORITATIVE");

  assert.equal(shouldUpdateFieldFromFAF("Player", "internalNotes"), false);
  assert.equal(shouldUpdateFieldFromFAF("Player", "contracts"), false);
  assert.equal(shouldUpdateFieldFromFAF("Player", "salary"), false);

  // Federation official attributes are FAF authoritative
  assert.equal(shouldUpdateFieldFromFAF("Player", "status"), true);
  assert.equal(shouldUpdateFieldFromFAF("Player", "licenceNumber"), true);
});

test("FAF Normalizer: accurately maps regional FAF categories and positions to Prisma enums", () => {
  // Category mapping
  assert.equal(mapFafCategoryToPrisma("Senior"), "SENIOR");
  assert.equal(mapFafCategoryToPrisma("U19"), "U20");
  assert.equal(mapFafCategoryToPrisma("U-20 Réserve"), "U20");
  assert.equal(mapFafCategoryToPrisma("U-17"), "U17");
  assert.equal(mapFafCategoryToPrisma("U15 Régionale"), "U15");

  // Position mapping
  assert.equal(mapFafPositionToPrisma("Gardien de but"), "GOALKEEPER");
  assert.equal(mapFafPositionToPrisma("Défenseur central"), "DEFENDER");
  assert.equal(mapFafPositionToPrisma("Milieu récupérateur"), "MIDFIELDER");
  assert.equal(mapFafPositionToPrisma("Attaquant de pointe"), "FORWARD");

  // Licence normalization
  assert.equal(normalizeLicenceNumber("  26-001234 / lrft  "), "26-001234/LRFT");
});

test("FAF RBAC: Unauthorized user without players.manage is rejected from triggering sync", async () => {
  const unauthorizedUser: SessionUser = {
    id: "user-fan",
    name: "Fan",
    email: "fan@esh.dz",
    roleKey: "fan",
    roleName: "Fan",
    permissions: ["news.view"]
  };
  const scope: TeamScope = { restricted: false };

  await assert.rejects(
    () => syncFAFPlayers(unauthorizedUser, scope),
    /Unauthorized: players.manage or settings.manage permission required/
  );
});

test("FAF Team Scoping: Restricted coach only synchronizes players of their assigned team", async () => {
  reset();
  const mockAdapter = new FAFMockAdapter();

  // Team A (Senior) and Team B (U17)
  store.team!.push(
    { id: "team-senior", name: "ESH Seniors", category: "SENIOR", active: true },
    { id: "team-u17", name: "ESH U17", category: "U17", active: true }
  );

  // Incoming FAF roster with 1 Senior and 1 U17 player
  mockAdapter.mockPlayers = [
    {
      licenceNumber: "26-001111",
      firstName: "Senior",
      lastName: "Player",
      dateOfBirth: "2000-01-01",
      nationality: "Algérienne",
      category: "SENIOR",
      status: "VALID"
    },
    {
      licenceNumber: "26-002222",
      firstName: "Youth",
      lastName: "Player",
      dateOfBirth: "2009-01-01",
      nationality: "Algérienne",
      category: "U17",
      status: "VALID"
    }
  ];
  setFAFClient(mockAdapter);

  // Coach restricted strictly to Team U17
  const coachU17: SessionUser = {
    id: "coach-u17",
    name: "Coach U17",
    email: "coach.u17@esh.dz",
    roleKey: "coach",
    roleName: "Coach",
    permissions: ["players.manage"]
  };
  const scopeU17: TeamScope = { restricted: true, teamIds: ["team-u17"] };

  const result = await syncFAFPlayers(coachU17, scopeU17);

  // Only the U17 player should be processed; Senior player must be skipped without cross-team leakage
  assert.equal(result.details.playersProcessed, 1);
  assert.equal(result.recordsCreated, 1);

  const createdPlayers = store.player!;
  assert.equal(createdPlayers.length, 1);
  assert.equal(createdPlayers[0].teamId, "team-u17");
  assert.equal(createdPlayers[0].lastName, "Player");
});

test("FAF Idempotency: Multiple sync runs do not create duplicate records", async () => {
  reset();
  const mockAdapter = new FAFMockAdapter();

  store.team!.push({ id: "team-senior", name: "ESH Seniors", category: "SENIOR", active: true });

  mockAdapter.mockPlayers = [
    {
      licenceNumber: "26-005555",
      firstName: "Idempotent",
      lastName: "Tester",
      dateOfBirth: "2001-04-10",
      nationality: "Algérienne",
      category: "SENIOR",
      status: "VALID"
    }
  ];
  setFAFClient(mockAdapter);

  const admin: SessionUser = {
    id: "admin-1",
    name: "Admin",
    email: "admin@esh.dz",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["*"]
  };
  const scope: TeamScope = { restricted: false };

  // First sync: Creates record
  const res1 = await syncFAFPlayers(admin, scope);
  assert.equal(res1.recordsCreated, 1);
  assert.equal(res1.recordsUpdated, 0);
  assert.equal(store.player!.length, 1);

  // Second sync: Does not create duplicate
  const res2 = await syncFAFPlayers(admin, scope);
  assert.equal(res2.recordsCreated, 0);
  assert.equal(res2.recordsUnchanged, 1);
  assert.equal(store.player!.length, 1, "Player count must remain 1 (no duplicates)");
});

test("FAF Conflict Detection: Detects team mismatch and preserves local ESH assignment", async () => {
  reset();
  const mockAdapter = new FAFMockAdapter();

  store.team!.push(
    { id: "team-senior", name: "ESH Seniors", category: "SENIOR", active: true },
    { id: "team-u20", name: "ESH U20", category: "U20", active: true }
  );

  // Pre-existing ESH player assigned to Team Senior
  store.player!.push({
    id: "p-existing",
    slug: "karim-ziani-2004",
    firstName: "Karim",
    lastName: "Ziani",
    dateOfBirth: new Date("2004-03-15"),
    nationality: "Algérienne",
    status: "ACTIVE",
    teamId: "team-senior"
  });

  // Incoming FAF record assigns player to U20 instead of Senior
  mockAdapter.mockPlayers = [
    {
      licenceNumber: "26-007777",
      firstName: "Karim",
      lastName: "Ziani",
      dateOfBirth: "2004-03-15",
      nationality: "Algérienne",
      category: "U20",
      status: "VALID"
    }
  ];
  setFAFClient(mockAdapter);

  const admin: SessionUser = {
    id: "admin-1",
    name: "Admin",
    email: "admin@esh.dz",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["*"]
  };

  const result = await syncFAFPlayers(admin, { restricted: false });

  // Conflict must be detected and local team assignment preserved
  assert.equal(result.conflictsDetected, 1);
  const conflictAudit = store.auditLog!.find((a) => a.action === "FAF_CONFLICT_DETECTED");
  assert.ok(conflictAudit);
  assert.equal(conflictAudit.changes?.field, "teamId");
  assert.equal(conflictAudit.changes?.resolution, "PRESERVE_ESH");

  const player = store.player!.find((p) => p.id === "p-existing");
  assert.equal(player?.teamId, "team-senior", "Must preserve local team assignment");
});

test("FAF Health Diagnostics: getFAFIntegrationStatus returns clean diagnostics without crashing", async () => {
  const status = await getFAFIntegrationStatus();
  assert.ok(typeof status.configured === "boolean");
  assert.ok(typeof status.connected === "boolean");
  assert.ok(typeof status.connectionMessage === "string");
  assert.ok(typeof status.latencyMs === "number");
});

// ============================================================================
// PHASE 10B — SESSION LIFECYCLE, CRYPTO & SECURITY HARDENING TESTS
// ============================================================================

test("FAF Crypto: AES-256-GCM encryption, decryption, and tamper resistance", () => {
  const secretPayload = "test-session-token-random-xyz-789";

  // 1. Encryption format: ivHex:authTagHex:encryptedHex
  const encrypted = encryptData(secretPayload);
  const parts = encrypted.split(":");
  assert.equal(parts.length, 3, "Encrypted output must have exactly 3 parts (IV, Tag, Cipher)");
  assert.equal(parts[0].length, 24, "IV must be 12 bytes (24 hex characters)");
  assert.equal(parts[1].length, 32, "Auth Tag must be 16 bytes (32 hex characters)");

  // 2. Decryption integrity
  const decrypted = decryptData(encrypted);
  assert.equal(decrypted, secretPayload, "Decrypted payload must match original");

  // 3. Unique IV: encrypting same plaintext twice produces different cipher strings
  const encrypted2 = encryptData(secretPayload);
  assert.notEqual(encrypted, encrypted2, "Each encryption must use a fresh random IV");

  // 4. Tamper resistance: modified ciphertext must fail closed
  const flippedCipherByte = parts[2].slice(-2) === "ff" ? "00" : "ff";
  const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}${flippedCipherByte}`;
  assert.throws(() => decryptData(tamperedCipher), /Unsupported state or unable to authenticate data/);

  // 5. Tamper resistance: modified auth tag must fail closed
  const flippedTagByte = parts[1].slice(-2) === "00" ? "ff" : "00";
  const tamperedTag = `${parts[0]}:${parts[1].slice(0, -2)}${flippedTagByte}:${parts[2]}`;
  assert.throws(() => decryptData(tamperedTag), /Unsupported state or unable to authenticate data/);
});

test("FAF Session Persistence: Encrypted session file preserves credentials across manager instances", async () => {
  const tempSessionFile = path.join(os.tmpdir(), `test-faf-session-${Date.now()}.enc`);

  try {
    const manager1 = new FAFSessionManagerImpl(tempSessionFile);
    assert.equal(await manager1.getSession(), null, "Initial session must be null");

    // Mock fetch for validation call inside updateSession
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(null, {
        status: 200,
        headers: {}
      });
    }) as any;

    try {
      const secretCookie = "0386sodcu14v9jil0lggda67j7";
      const statusDto = await manager1.updateSession(secretCookie, "14DLG9D");

      assert.equal(statusDto.status, "AUTHENTICATED");
      assert.equal(statusDto.isConfigured, true);
      assert.equal(statusDto.clubCode, "14DLG9D");

      // Verify file exists on disk and does NOT contain raw secret cookie
      assert.ok(fs.existsSync(tempSessionFile), "Session file must be written to disk");
      const diskContent = fs.readFileSync(tempSessionFile, "utf8");
      assert.ok(!diskContent.includes(secretCookie), "Disk file must be encrypted, NEVER raw cookie");

      // Verify cross-instance persistence: instantiate a brand new manager instance
      const manager2 = new FAFSessionManagerImpl(tempSessionFile);
      const loadedCookie = await manager2.getSession();
      assert.equal(loadedCookie, secretCookie, "Second manager instance must read and decrypt session from disk");

      // Invalidation cleans up disk and memory
      await manager2.invalidateSession();
      assert.ok(!fs.existsSync(tempSessionFile), "Invalidate must remove session file from disk");
      assert.equal(await manager2.getSession(), null, "Session must be null after invalidation");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    if (fs.existsSync(tempSessionFile)) {
      try { fs.unlinkSync(tempSessionFile); } catch {}
    }
  }
});

test("FAF Session Lifecycle: Status transitions accurately calculate remaining idle window", async () => {
  const tempSessionFile = path.join(os.tmpdir(), `test-faf-lifecycle-${Date.now()}.enc`);

  try {
    const manager = new FAFSessionManagerImpl(tempSessionFile);

    // 1. Unconfigured
    const unconfigStatus = await manager.getStatus();
    assert.equal(unconfigStatus.status, "NOT_CONFIGURED");
    assert.equal(unconfigStatus.isConfigured, false);
    assert.equal(unconfigStatus.authenticatedAt, null);

    // 2. Active Session
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(null, {
        status: 200,
        headers: {}
      });
    }) as any;

    try {
      await manager.updateSession("active_cookie_val_123");
      const activeStatus = await manager.getStatus();
      assert.equal(activeStatus.status, "AUTHENTICATED");
      assert.equal(activeStatus.isConfigured, true);
      assert.ok(activeStatus.expiresInMinutes !== null && activeStatus.expiresInMinutes > 20);

      // 3. Status override verification
      const expiringStatus = await manager.getStatus("EXPIRING", "Expiring soon");
      assert.equal(expiringStatus.status, "EXPIRING");
      assert.equal(expiringStatus.message, "Expiring soon");

      const expiredStatus = await manager.getStatus("EXPIRED", "Session expired");
      assert.equal(expiredStatus.status, "EXPIRED");
      assert.equal(expiredStatus.message, "Session expired");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    if (fs.existsSync(tempSessionFile)) {
      try { fs.unlinkSync(tempSessionFile); } catch {}
    }
  }
});

test("FAF Secret Protection: Session DTO and audit logs never expose raw cookie", async () => {
  const tempSessionFile = path.join(os.tmpdir(), `test-faf-secrets-${Date.now()}.enc`);
  const sensitiveCookie = "super_confidential_phpsessid_99999";

  try {
    const manager = new FAFSessionManagerImpl(tempSessionFile);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(null, { status: 200 });
    }) as any;

    try {
      const dto = await manager.updateSession(sensitiveCookie, "14DLG9D");

      // Verify DTO fields
      const dtoKeys = Object.keys(dto);
      assert.ok(!dtoKeys.includes("sessionCookie"), "FAFSessionDTO must NOT have sessionCookie property");
      assert.ok(!dtoKeys.includes("cookie"), "FAFSessionDTO must NOT have cookie property");

      const serializedDto = JSON.stringify(dto);
      assert.ok(!serializedDto.includes(sensitiveCookie), "Serialized DTO must never leak the secret session cookie");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    if (fs.existsSync(tempSessionFile)) {
      try { fs.unlinkSync(tempSessionFile); } catch {}
    }
  }
});

test("FAF Fail-Closed Policy: Headless re-authentication refuses automated bypass and requires human", async () => {
  const manager = new FAFSessionManagerImpl();
  const reauthResult = await manager.reauthenticate();

  assert.equal(reauthResult.success, false, "Automated re-authentication must never claim success");
  assert.equal(reauthResult.status, "REAUTH_REQUIRED", "Status must be REAUTH_REQUIRED");
  assert.equal(reauthResult.requiresHuman, true, "Must require human verification due to Google reCAPTCHA");
  assert.ok(reauthResult.message.includes("Google reCAPTCHA"), "Message must explain reCAPTCHA requirement");
});

test("FAF Sync Fail-Closed: Expired session returns AUTH_REQUIRED status and logs audit without retry storm", async () => {
  reset();
  const httpAdapter = new FAFHttpAdapter();
  setFAFClient(httpAdapter);

  const originalFetch = globalThis.fetch;
  // Mock fetch: FAF redirects to login.php (expired session)
  globalThis.fetch = (async () => {
    return new Response(null, {
      status: 302,
      headers: { Location: "https://www.fafconnect.dz/login.php" }
    });
  }) as any;

  try {
    // Bootstrap active session to test expiration during sync
    await FAFSessionManager.updateSession("temp_active_session_cookie");

    const adminUser: SessionUser = {
      id: "admin-faf-sync",
      name: "Admin User",
      email: "admin@esh.dz",
      roleKey: "super_admin",
      roleName: "Admin",
      permissions: ["players.manage"]
    };

    const result = await syncFAFPlayers(adminUser, { restricted: false });

    // Must fail closed with AUTH_REQUIRED without throwing unhandled exception
    assert.equal(result.status, "AUTH_REQUIRED");
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0].includes("re-authentication"));

    // Verify audit log captured the auth failure event
    const authRequiredAudit = store.auditLog!.find((a) => a.action === "FAF_SYNC_AUTH_REQUIRED");
    assert.ok(authRequiredAudit, "Must write FAF_SYNC_AUTH_REQUIRED audit log entry");
    assert.equal(authRequiredAudit.userId, "admin-faf-sync");
  } finally {
    globalThis.fetch = originalFetch;
    await FAFSessionManager.invalidateSession();
    // Restore mock adapter for subsequent tests
    setFAFClient(new FAFMockAdapter());
  }
});
