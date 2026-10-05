import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { sanitizeReturnTo } from "@/lib/team-switcher-security";
import { isSafeExternalUrl, fafPlayerLicenceSchema } from "@/lib/integrations/faf/schemas";

// ============================================================================
// PHASE 12 — COMPREHENSIVE SECURITY AUDIT & REMEDIATION TEST SUITE
// ============================================================================

test("Security Audit FINDING-02: sanitizeReturnTo rejects open redirect vectors", () => {
  const fallback = "/dashboard";

  // Hostile / external targets
  assert.equal(sanitizeReturnTo("https://evil.com/phish", fallback), fallback);
  assert.equal(sanitizeReturnTo("http://attacker.org", fallback), fallback);
  assert.equal(sanitizeReturnTo("//evil.com", fallback), fallback);
  assert.equal(sanitizeReturnTo("/\\evil.com", fallback), fallback);
  assert.equal(sanitizeReturnTo("javascript:alert(1)", fallback), fallback);
  assert.equal(sanitizeReturnTo(null, fallback), fallback);
  assert.equal(sanitizeReturnTo(undefined, fallback), fallback);
  assert.equal(sanitizeReturnTo({}, fallback), fallback);

  // Legitimate internal paths
  assert.equal(sanitizeReturnTo("/dashboard", fallback), "/dashboard");
  assert.equal(sanitizeReturnTo("/ar/dashboard/players", fallback), "/ar/dashboard/players");
  assert.equal(sanitizeReturnTo("/fr/dashboard/matches?team=1", fallback), "/fr/dashboard/matches?team=1");
});

test("Security Audit FINDING-03: isSafeExternalUrl blocks SSRF cloud metadata and loopback vectors", () => {
  const hostileUrls = [
    // AWS / GCP / Azure Cloud Metadata Service (Critical SSRF Vector)
    "http://169.254.169.254/latest/meta-data/",
    "http://169.254.169.254/computeMetadata/v1/",
    "https://169.254.1.1/secret",
    // Loopback variations
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.2:9000",
    "http://127.1:80",
    "http://0.0.0.0:8000",
    // IPv6 loopback and link-local
    "http://[::1]/admin",
    "http://[fe80::1]/config",
    // Private IPv4 ranges (RFC 1918)
    "http://10.0.0.5/api",
    "http://192.168.1.1/router",
    "http://172.16.0.1/internal",
    "http://172.31.255.254/db",
    // Intranet domains
    "http://corp.internal/photo.jpg",
    "http://service.local/photo.jpg",
    "http://database.lan/pic.png",
    // Dangerous protocols
    "ftp://example.com/pic.png",
    "file:///etc/passwd"
  ];

  for (const url of hostileUrls) {
    assert.equal(isSafeExternalUrl(url), false, `Expected ${url} to be rejected by SSRF filter`);
    assert.throws(
      () =>
        fafPlayerLicenceSchema.parse({
          licenceNumber: "26-001234",
          firstName: "Audit",
          lastName: "Test",
          dateOfBirth: "2000-01-01",
          category: "SENIOR",
          photoUrl: url
        }),
      /SSRF protection/,
      `Expected fafPlayerLicenceSchema to reject photoUrl: ${url}`
    );
  }

  // Safe public URLs must pass
  assert.equal(isSafeExternalUrl("https://faf.dz/photos/player1.jpg"), true);
  assert.equal(isSafeExternalUrl("https://images.unsplash.com/photo-123.jpg"), true);
  assert.equal(isSafeExternalUrl("http://cdn.fifa.com/assets/badge.png"), true);
});

test("Security Audit FINDING-04: Cron timing-safe secret comparison prevents timing attacks", () => {
  const secret = "production-cron-secret-key-1234567890";
  const validSecret = "production-cron-secret-key-1234567890";
  const invalidSameLength = "production-cron-secret-key-1234567899";
  const invalidDiffLength = "wrong";

  function verifyCronSecret(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  assert.equal(verifyCronSecret(validSecret, secret), true);
  assert.equal(verifyCronSecret(invalidSameLength, secret), false);
  assert.equal(verifyCronSecret(invalidDiffLength, secret), false);
});
