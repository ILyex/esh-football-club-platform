import { db } from "../src/lib/db";

/**
 * Prepare the shared database for club handover.
 *
 * Structural/auth tables are intentionally retained so the administrator can
 * log in immediately. Every operational/content/integration table is truncated
 * with PostgreSQL's dependency-aware CASCADE inside one transaction.
 */
const keepTables = ["_prisma_migrations", "User", "Role", "Permission", "RolePermission", "Team", "ClubSettings"];

async function main() {
  const keepSql = keepTables.map((name) => `'${name.replaceAll("'", "''")}'`).join(", ");
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      DO $$
      DECLARE item record;
      BEGIN
        FOR item IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename NOT IN (${keepSql})
        LOOP
          EXECUTE format('TRUNCATE TABLE %I CASCADE', item.tablename);
        END LOOP;
      END $$;
    `);
    // Keep only the super-admin login(s); remove seeded/demo staff accounts.
    await tx.$executeRawUnsafe(`
      DELETE FROM "User"
      WHERE "roleId" NOT IN (SELECT id FROM "Role" WHERE key = 'super_admin');
    `);
  });
  console.log("Handover reset completed. Structural and administrator data were retained; operational data is empty.");
}

main().catch((error) => {
  console.error("Handover reset failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});
