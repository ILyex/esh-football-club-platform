import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const tacticalPlansMigration = "20261016110000_tactical_plans";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function normalizeConstraint(value) {
  return value.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

async function verifyExistingTacticalPlanTable(prisma) {
  const columns = await prisma.$queryRawUnsafe(
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

  const indexes = await prisma.$queryRawUnsafe(
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

  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint WHERE conrelid = to_regclass('"TacticalPlan"')`
  );
  const actualConstraints = new Map(constraints.map((constraint) => [
    constraint.conname,
    { type: constraint.contype, definition: normalizeConstraint(constraint.definition) }
  ]));
  const expectedConstraints = [
    ["TacticalPlan_pkey", "p", "primary key (id)"],
    ["TacticalPlan_teamId_fkey", "f", "foreign key (teamid) references team(id) on delete set null on update cascade"],
    ["TacticalPlan_creatorId_fkey", "f", "foreign key (creatorid) references user(id) on delete cascade on update cascade"]
  ];
  const constraintMismatches = expectedConstraints.filter(([name, type, definition]) => {
    const actual = actualConstraints.get(name);
    return !actual || actual.type !== type || actual.definition !== definition;
  });
  if (constraintMismatches.length) {
    throw new Error(`Existing TacticalPlan table is missing matching constraints: ${constraintMismatches.map(([name]) => name).join(", ")}`);
  }
}

if (process.env.VERCEL_ENV !== "production") {
  console.log("Skipping production database migrations outside Vercel production.");
} else {
  const prisma = new PrismaClient();
  try {
    const migrationRows = await prisma.$queryRawUnsafe(
      `SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = $1`,
      tacticalPlansMigration
    );
    const isApplied = migrationRows.some((row) => row.finished_at && !row.rolled_back_at);
    if (!isApplied) {
      console.log(`Checking pre-existing schema before reconciling ${tacticalPlansMigration}.`);
      await verifyExistingTacticalPlanTable(prisma);
      run("npx", ["prisma", "migrate", "resolve", "--applied", tacticalPlansMigration]);
      console.log(`Verified and recorded ${tacticalPlansMigration} as already applied.`);
    }
  } finally {
    await prisma.$disconnect();
  }

  run("npm", ["run", "db:migrate:deploy"]);
}
