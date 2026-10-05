import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEnvironment } from "@/lib/env";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

// ============================================================================
// PHASE 13 — PRODUCTION READINESS & OPERATIONAL HARDENING TEST SUITE
// ============================================================================

test("Production Readiness: validateEnvironment enforces database URI requirements", () => {
  // Missing DATABASE_URL
  const missingDb = validateEnvironment({
    NODE_ENV: "production",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
    CRON_SECRET: "a-very-long-production-cron-secret-key-32-chars"
  });
  assert.equal(missingDb.ok, false);
  assert.ok(missingDb.issues.some((i) => i.includes("DATABASE_URL is required")));

  // Non-Postgres DATABASE_URL
  const invalidDb = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "mysql://user:pass@localhost:3306/db",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
    CRON_SECRET: "a-very-long-production-cron-secret-key-32-chars"
  });
  assert.equal(invalidDb.ok, false);
  assert.ok(invalidDb.issues.some((i) => i.includes("must be a valid PostgreSQL connection URI")));
});

test("Production Readiness: validateEnvironment rejects weak and placeholder AUTH_SECRET in production", () => {
  // Placeholder from .env.example
  const placeholder = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "replace-with-a-random-32-byte-secret",
    CRON_SECRET: "valid-production-cron-secret-123456789"
  });
  assert.equal(placeholder.ok, false);
  assert.ok(placeholder.issues.some((i) => i.includes("insecure default or placeholder")));

  // Too short (< 32 characters)
  const shortSecret = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "too-short",
    CRON_SECRET: "valid-production-cron-secret-123456789"
  });
  assert.equal(shortSecret.ok, false);
  assert.ok(shortSecret.issues.some((i) => i.includes("insufficient entropy")));
});

test("Production Readiness: validateEnvironment enforces CRON_SECRET in production", () => {
  const missingCron = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus"
  });
  assert.equal(missingCron.ok, false);
  assert.ok(missingCron.issues.some((i) => i.includes("CRON_SECRET is strictly required in production")));
});

test("Production Readiness: validateEnvironment enforces private vs public bucket isolation", () => {
  const sharedBucket = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
    CRON_SECRET: "valid-production-cron-secret-123456789",
    STORAGE_PRIVATE_BUCKET: "same-bucket",
    STORAGE_PUBLIC_BUCKET: "same-bucket"
  });
  assert.equal(sharedBucket.ok, false);
  assert.ok(sharedBucket.issues.some((i) => i.includes("must NOT be the same bucket")));
});

test("Production Readiness: validateEnvironment validates Google OAuth & token encryption key requirements", () => {
  const missingKey = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
    CRON_SECRET: "valid-production-cron-secret-123456789",
    GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "client-secret"
  });
  assert.equal(missingKey.ok, false);
  assert.ok(missingKey.issues.some((i) => i.includes("GMAIL_TOKEN_ENCRYPTION_KEY is required")));
});

test("Production Readiness: validateEnvironment passes with fully configured valid production setup", () => {
  const validProduction = validateEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
    AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
    CRON_SECRET: "valid-production-cron-secret-123456789",
    STORAGE_PRIVATE_BUCKET: "esh-private-docs",
    STORAGE_PUBLIC_BUCKET: "esh-public-media"
  });
  assert.equal(validProduction.ok, true);
  assert.equal(validProduction.issues.length, 0);
});

test("Production Readiness: shared checkRateLimit blocks excess requests and supports reset", async () => {
  const testKey = "ip:192.0.2.1";
  await resetRateLimit(testKey);

  // Limit: 3 requests per 10 seconds
  const res1 = await checkRateLimit({ key: testKey, limit: 3, windowMs: 10000 });
  assert.equal(res1.allowed, true);
  assert.equal(res1.remaining, 2);

  const res2 = await checkRateLimit({ key: testKey, limit: 3, windowMs: 10000 });
  assert.equal(res2.allowed, true);
  assert.equal(res2.remaining, 1);

  const res3 = await checkRateLimit({ key: testKey, limit: 3, windowMs: 10000 });
  assert.equal(res3.allowed, true);
  assert.equal(res3.remaining, 0);

  // 4th request must be blocked
  const res4 = await checkRateLimit({ key: testKey, limit: 3, windowMs: 10000 });
  assert.equal(res4.allowed, false);
  assert.equal(res4.remaining, 0);

  // Resetting key allows immediate request
  await resetRateLimit(testKey);
  const res5 = await checkRateLimit({ key: testKey, limit: 3, windowMs: 10000 });
  assert.equal(res5.allowed, true);
  assert.equal(res5.remaining, 2);
});
