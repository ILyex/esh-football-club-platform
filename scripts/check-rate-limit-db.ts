import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

function loadLocalDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => /^\s*DATABASE_URL\s*=/.test(item));
  if (!line) throw new Error("DATABASE_URL is required for the integration check");
  process.env.DATABASE_URL = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  loadLocalDatabaseUrl();
  const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!/test/i.test(databaseName)) throw new Error("Refusing rate-limit integration check: database name must contain 'test'");

  const { db } = await import("../src/lib/db");
  const { checkRateLimit, resetRateLimit } = await import("../src/lib/rate-limit");
  const key = `prelaunch-check:${randomUUID()}`;
  try {
    const results = await Promise.all(Array.from({ length: 5 }, () => checkRateLimit({ key, limit: 3, windowMs: 30_000 })));
    if (results.filter((result) => result.allowed).length !== 3 || results.filter((result) => !result.allowed).length !== 2) {
      throw new Error("Concurrent rate-limit check returned an unexpected result");
    }
    process.stdout.write("PostgreSQL atomic limiter integration verified: 3 allowed, 2 blocked\n");
  } finally {
    await resetRateLimit(key);
    await db.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Rate-limit integration check failed"}\n`);
  process.exitCode = 1;
});
