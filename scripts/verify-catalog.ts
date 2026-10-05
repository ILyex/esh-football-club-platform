import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Tables
  const tables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  // 2. Enums
  const enums: Array<{ typname: string; enumlabel: string }> = await prisma.$queryRawUnsafe(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `);

  // 3. P1 columns & constraints
  const roleCols: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Role' AND column_name = 'teamScoped';
  `);

  const staffCols: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Staff' AND column_name = 'userId';
  `);

  // 4. P5 columns on Notification
  const notifCols: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Notification' AND column_name IN ('teamId', 'dedupKey');
  `);

  // 5. BackgroundJob columns
  const bgJobCols: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'BackgroundJob'
    ORDER BY ordinal_position;
  `);

  // 6. Unique constraints
  const uniqueConstraints: Array<{ constraint_name: string; table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT conname AS constraint_name, conrelid::regclass::text AS table_name
    FROM pg_constraint
    WHERE contype = 'u' AND connamespace = 'public'::regnamespace
    ORDER BY table_name, constraint_name;
  `);

  // 7. _prisma_migrations
  const migrations: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }> = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY started_at;
  `);

  console.log("=== LIVE POSTGRESQL CATALOG VERIFICATION ===");
  console.log("TABLE_COUNT:", tables.length);
  console.log("TABLES:", tables.map(t => t.table_name).join(", "));
  console.log("P1_ROLE_TEAM_SCOPED:", roleCols);
  console.log("P1_STAFF_USER_ID:", staffCols);
  console.log("P5_NOTIF_COLUMNS:", notifCols);
  console.log("P5_BACKGROUND_JOB_COLUMNS:", bgJobCols.map(c => c.column_name).join(", "));
  
  const jobStatusLabels = enums.filter(e => e.typname === "JobStatus").map(e => e.enumlabel);
  const jobPriorityLabels = enums.filter(e => e.typname === "JobPriority").map(e => e.enumlabel);
  console.log("P5_JOB_STATUS_ENUM:", jobStatusLabels);
  console.log("P5_JOB_PRIORITY_ENUM:", jobPriorityLabels);

  console.log("MIGRATIONS_IN_DB:", migrations.map(m => ({
    name: m.migration_name,
    finished: m.finished_at !== null,
    rolled_back: m.rolled_back_at !== null
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
