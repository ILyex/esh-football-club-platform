import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const tacticalPlansMigration = "20261016110000_tactical_plans";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function normalizeConstraint(value) {
  const normalized = value.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
  const actions = normalized.match(/on (?:delete|update) (?:set null|cascade|restrict|no action|set default)/g) ?? [];
  const definition = normalized.replace(/ on (?:delete|update) (?:set null|cascade|restrict|no action|set default)/g, "").trim();
  return [...actions.sort(), definition].join(" ");
}

async function verifyExistingTacticalPlanTable(pool) {
  const { rows: columns } = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'TacticalPlan'`
  );
  const actualColumns = new Map(columns.map((column) => [column.column_name, column]));
  const expectedColumns = {
    id: ["text", "NO"],
    title: ["text", "NO"],
    description: ["text", "YES"],
    formation: ["text", "NO"],
    data: ["jsonb", "NO"],
    teamId: ["text", "YES"],
    creatorId: ["text", "NO"],
    createdAt: ["timestamp without time zone", "NO"],
    updatedAt: ["timestamp without time zone", "NO"]
  };
  const columnMismatches = Object.entries(expectedColumns).filter(([name, [type, nullable]]) => {
    const actual = actualColumns.get(name);
    return !actual || actual.data_type !== type || actual.is_nullable !== nullable;
  });
  if (columnMismatches.length) {
    throw new Error(`Existing TacticalPlan table does not match migration columns: ${columnMismatches.map(([name]) => name).join(", ")}`);
  }

  const { rows: indexes } = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = current_schema() AND tablename = 'TacticalPlan'`
  );
  const indexDefinitions = new Map(indexes.map((index) => [index.indexname, normalizeConstraint(index.indexdef)]));
  const expectedIndexes = [
    ["TacticalPlan_pkey", "(id)"],
    ["TacticalPlan_teamId_updatedAt_idx", "(teamid, updatedat)"],
    ["TacticalPlan_creatorId_updatedAt_idx", "(creatorid, updatedat)"]
  ];
  const indexMismatches = expectedIndexes.filter(([name, fragment]) => !indexDefinitions.get(name)?.includes(fragment));
  if (indexMismatches.length) {
    throw new Error(`Existing TacticalPlan table is missing matching indexes: ${indexMismatches.map(([name]) => name).join(", ")}`);
  }

  let { rows: constraints } = await pool.query(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint WHERE conrelid = to_regclass('"TacticalPlan"')`
  );
  const expectedConstraints = [
    ["TacticalPlan_pkey", "p", "primary key (id)"],
    ["TacticalPlan_teamId_fkey", "f", "foreign key (teamid) references team(id) on delete set null on update cascade"],
    ["TacticalPlan_creatorId_fkey", "f", "foreign key (creatorid) references user(id) on delete cascade on update cascade"]
  ];
  let actualConstraints = new Map(constraints.map((constraint) => [
    constraint.conname,
    { type: constraint.contype, definition: normalizeConstraint(constraint.definition) }
  ]));
  const constraintMismatches = expectedConstraints.filter(([name, type]) => {
    const actual = actualConstraints.get(name);
    return actual && actual.type !== type;
  });
  if (constraintMismatches.length) {
    throw new Error(`Existing TacticalPlan table has conflicting constraints: ${constraintMismatches.map(([name]) => name).join(", ")}`);
  }

  const foreignKeys = [
    {
      name: "TacticalPlan_teamId_fkey",
      expectedDefinition: "foreign key (teamid) references team(id) on delete set null on update cascade",
      orphanQuery: `SELECT EXISTS (SELECT 1 FROM "TacticalPlan" p LEFT JOIN "Team" t ON t."id" = p."teamId" WHERE p."teamId" IS NOT NULL AND t."id" IS NULL) AS has_orphans`,
      addSql: `ALTER TABLE "TacticalPlan" ADD CONSTRAINT "TacticalPlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    },
    {
      name: "TacticalPlan_creatorId_fkey",
      expectedDefinition: "foreign key (creatorid) references user(id) on delete cascade on update cascade",
      orphanQuery: `SELECT EXISTS (SELECT 1 FROM "TacticalPlan" p LEFT JOIN "User" u ON u."id" = p."creatorId" WHERE u."id" IS NULL) AS has_orphans`,
      addSql: `ALTER TABLE "TacticalPlan" ADD CONSTRAINT "TacticalPlan_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    }
  ];
  for (const foreignKey of foreignKeys) {
    const existing = actualConstraints.get(foreignKey.name);
    if (existing?.definition === normalizeConstraint(foreignKey.expectedDefinition)) continue;
    const { rows } = await pool.query(foreignKey.orphanQuery);
    if (rows[0].has_orphans) {
      throw new Error(`Cannot safely add ${foreignKey.name}: TacticalPlan contains orphaned references.`);
    }
    await pool.query("BEGIN");
    try {
      if (existing) await pool.query(`ALTER TABLE "TacticalPlan" DROP CONSTRAINT "${foreignKey.name}"`);
      await pool.query(foreignKey.addSql);
      await pool.query("COMMIT");
      console.log(`${existing ? "Replaced mismatched" : "Added verified missing"} constraint ${foreignKey.name}.`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
  ({ rows: constraints } = await pool.query(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint WHERE conrelid = to_regclass('"TacticalPlan"')`
  ));
  actualConstraints = new Map(constraints.map((constraint) => [
    constraint.conname,
    { type: constraint.contype, definition: normalizeConstraint(constraint.definition) }
  ]));
  const remainingMismatches = expectedConstraints.filter(([name, type, definition]) => {
    const actual = actualConstraints.get(name);
    return !actual || actual.type !== type || actual.definition !== normalizeConstraint(definition);
  });
  if (remainingMismatches.length) {
    throw new Error(`TacticalPlan constraints still differ after reconciliation: ${remainingMismatches.map(([name]) => name).join(", ")}`);
  }
}

async function getPendingMigrations(pool) {
  const migrationsDirectory = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
  const migrationEntries = await readdir(migrationsDirectory, { withFileTypes: true });
  const localMigrationNames = [];
  for (const entry of migrationEntries) {
    if (!entry.isDirectory()) continue;
    const files = await readdir(join(migrationsDirectory, entry.name));
    if (files.includes("migration.sql")) localMigrationNames.push(entry.name);
  }

  const { rows } = await pool.query(
    `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`
  );
  const successfullyApplied = new Set(
    rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name)
  );
  return localMigrationNames.filter((name) => !successfullyApplied.has(name));
}

async function runMigrationsWithLockRetry() {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync("npm", ["run", "db:migrate:deploy"], {
      encoding: "utf8",
      env: process.env
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status === 0) return;

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const isAdvisoryLockTimeout = /Timed out trying to acquire a postgres advisory lock/i.test(output);
    if (!isAdvisoryLockTimeout || attempt === maxAttempts) process.exit(result.status ?? 1);

    const delayMs = attempt * 5_000;
    console.warn(`Another deployment is applying database migrations; retrying in ${delayMs / 1_000}s (${attempt}/${maxAttempts - 1}).`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

if (process.env.VERCEL_ENV !== "production") {
  console.log("Skipping production database migrations outside Vercel production.");
} else {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for production migrations.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  let pendingMigrations;
  try {
    const { rows: migrationRows } = await pool.query(
      `SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = $1`,
      [tacticalPlansMigration]
    );
    const isApplied = migrationRows.some((row) => row.finished_at && !row.rolled_back_at);
    if (!isApplied) {
      console.log(`Checking pre-existing schema before reconciling ${tacticalPlansMigration}.`);
      await verifyExistingTacticalPlanTable(pool);
      run("npx", ["prisma", "migrate", "resolve", "--applied", tacticalPlansMigration]);
      console.log(`Verified and recorded ${tacticalPlansMigration} as already applied.`);
    }
    pendingMigrations = await getPendingMigrations(pool);
  } finally {
    await pool.end();
  }

  if (pendingMigrations.length === 0) {
    console.log("No pending production migrations; skipping Prisma migrate deploy.");
  } else {
    console.log(`Applying ${pendingMigrations.length} pending production migration(s).`);
    await runMigrationsWithLockRetry();
  }
}
