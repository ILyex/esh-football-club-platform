#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ============================================================================
// PHASE 13 — PRODUCTION SUPER ADMIN BOOTSTRAP SCRIPT
// ----------------------------------------------------------------------------
// Run with:
//   ADMIN_EMAIL="admin@esh-club.dz" ADMIN_PASSWORD="<secure-pwd>" npx tsx scripts/bootstrap-admin.ts
//
// Safe for production: Idempotent, enforces minimum 12-char passwords,
// associates the user with the system 'super_admin' role, and never outputs
// the plain-text password.
// ============================================================================

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.argv[2] || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || "";
  const name = process.env.ADMIN_NAME || process.argv[4] || "ESH Super Admin";

  if (!z.string().email().max(254).safeParse(email).success) {
    console.error("❌ Error: Valid ADMIN_EMAIL is required.");
    console.error("Usage: ADMIN_EMAIL=user@domain.dz ADMIN_PASSWORD=secret npx tsx scripts/bootstrap-admin.ts");
    process.exit(1);
  }

  const passwordBytes = new TextEncoder().encode(password).length;
  if (password.length < 12 || passwordBytes > 72) {
    console.error("❌ Error: ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.");
    process.exit(1);
  }

  // Ensure super_admin role exists
  const superAdminRole = await db.role.findUnique({
    where: { key: "super_admin" }
  });

  if (!superAdminRole) {
    console.error("❌ Error: 'super_admin' role not found in database. Please run migrations and seed first:");
    console.error("  npm run db:migrate:deploy && npm run db:seed");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      roleId: superAdminRole.id
    },
    create: {
      email,
      name,
      passwordHash,
      roleId: superAdminRole.id
    }
  });

  console.log(`\n✅ Production Super Admin successfully provisioned!`);
  console.log(`   User ID : ${user.id}`);
  console.log(`   Email   : ${user.email}`);
  console.log(`   Role    : super_admin (Full System Access)`);
  console.log(`\n🔒 Security reminder: Ensure ADMIN_PASSWORD is cleared from your shell history or CI environment.\n`);
}

main()
  .catch((err) => {
    console.error("❌ Fatal bootstrap error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
