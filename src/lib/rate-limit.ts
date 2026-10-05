import "server-only";
import { db } from "@/lib/db";

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
}

let nextCleanupAt = 0;

/** Atomically consumes a shared PostgreSQL rate-limit slot.
 * A single UPSERT serializes requests for each key across Node processes.
 */
export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate limit configuration");
  }

  // Keep the table bounded after expired attacker-generated keys. The index
  // makes this small batch cleanup cheap and each process runs it at most once
  // every five minutes.
  const now = Date.now();
  if (now >= nextCleanupAt) {
    nextCleanupAt = now + 5 * 60 * 1000;
    await db.$executeRaw`
      WITH expired AS (
        SELECT "key" FROM "RateLimitBucket"
        WHERE "expiresAt" < NOW()
        ORDER BY "expiresAt"
        LIMIT 500
      )
      DELETE FROM "RateLimitBucket" AS bucket
      USING expired
      WHERE bucket."key" = expired."key"
    `;
  }

  const rows = await db.$queryRaw<Array<{ count: number; resetTimeMs: bigint }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStartedAt", "expiresAt", "updatedAt")
    VALUES (${key}, 1, NOW(), NOW() + (${windowMs} * INTERVAL '1 millisecond'), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN NOW() ELSE "RateLimitBucket"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW()
        THEN NOW() + (${windowMs} * INTERVAL '1 millisecond') ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = NOW()
    RETURNING "count", (EXTRACT(EPOCH FROM "expiresAt") * 1000)::bigint AS "resetTimeMs"
  `;

  const row = rows[0];
  if (!row) throw new Error("Rate limit operation returned no result");
  const count = Number(row.count);
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetTimeMs: Number(row.resetTimeMs)
  };
}

/** Clear an account-specific bucket after successful authentication. */
export async function resetRateLimit(key: string): Promise<void> {
  await db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${key}`;
}
