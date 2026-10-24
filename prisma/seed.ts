import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ============================================================================
// SEED DATA (spec sections 40, 58, 59)
// ----------------------------------------------------------------------------
// - Demo document contents are a hand-built minimal valid PDF, never a real
//   personal document, per spec section 58 ("لا تستخدم وثائق شخصية حقيقية").
// - The demo password is read from DEMO_PASSWORD in your .env — never
//   hardcoded/committed (spec section 59). The seed refuses to run without it.
// ============================================================================

const PERMISSIONS: { key: string; group: string; description: string }[] = [
  { key: "*", group: "system", description: "Full access (Super Admin only)" },

  { key: "players.view", group: "players", description: "View players" },
  { key: "player.stats.view", group: "players", description: "View team-scoped player performance and match statistics" },
  { key: "players.create", group: "players", description: "Create players" },
  { key: "players.update", group: "players", description: "Edit players" },
  { key: "players.archive", group: "players", description: "Archive (soft-delete) players" },
  { key: "players.delete", group: "players", description: "Permanently delete players" },

  { key: "staff.view", group: "staff", description: "View staff" },
  { key: "staff.create", group: "staff", description: "Create staff" },
  { key: "staff.update", group: "staff", description: "Edit staff" },
  { key: "staff.delete", group: "staff", description: "Delete staff" },

  { key: "matches.view", group: "matches", description: "View matches" },
  { key: "matches.create", group: "matches", description: "Create matches" },
  { key: "matches.update", group: "matches", description: "Edit matches" },
  { key: "matches.delete", group: "matches", description: "Delete matches" },
  { key: "matches.report", group: "matches", description: "Add lineups/events/match report" },

  { key: "calendar.view", group: "calendar", description: "View calendar" },
  { key: "calendar.manage", group: "calendar", description: "Manage calendar events" },

  { key: "training.view", group: "training", description: "View training sessions" },
  { key: "training.manage", group: "training", description: "Manage training sessions" },

  { key: "competitions.view", group: "competitions", description: "View competitions" },
  { key: "competitions.manage", group: "competitions", description: "Manage competitions" },

  { key: "news.view", group: "news", description: "View news (drafts included)" },
  { key: "news.create", group: "news", description: "Create news" },
  { key: "news.update", group: "news", description: "Edit news" },
  { key: "news.delete", group: "news", description: "Delete news" },
  { key: "news.publish", group: "news", description: "Publish/unpublish/schedule news" },

  { key: "announcements.view", group: "announcements", description: "View announcements" },
  { key: "announcements.manage", group: "announcements", description: "Manage announcements" },

  { key: "gallery.view", group: "gallery", description: "View gallery" },
  { key: "gallery.manage", group: "gallery", description: "Manage albums/media" },

  { key: "documents.view", group: "documents", description: "View non-restricted documents" },
  { key: "documents.view.restricted", group: "documents", description: "View RESTRICTED documents (contracts, correspondence, meeting minutes, admin docs)" },
  { key: "documents.create", group: "documents", description: "Upload documents" },
  { key: "documents.update", group: "documents", description: "Edit document metadata" },
  { key: "documents.delete", group: "documents", description: "Delete documents" },

  { key: "medical.records.view", group: "medical", description: "View confidential per-player medical records" },
  { key: "medical.records.manage", group: "medical", description: "Upload and manage confidential per-player medical records" },

  { key: "templates.view", group: "templates", description: "View document templates" },
  { key: "templates.manage", group: "templates", description: "Upload templates, manage versions and field mappings" },
  { key: "documents.generate", group: "templates", description: "Generate official documents from an active template" },

  // Minimal 3-permission set (not the full 6 the spec offered as candidates):
  // .view for read access, .manage for non-money-moving draft records
  // (budgets, draft expenses, treasury account definitions), .approve for
  // anything that actually posts an expense or moves real money (deposits,
  // withdrawals, reversals) or generates an official financial document.
  { key: "finance.view", group: "finance", description: "View budgets, expenses, treasury accounts and the ledger" },
  { key: "finance.manage", group: "finance", description: "Create/edit budgets and draft expenses, create treasury accounts" },
  { key: "finance.approve", group: "finance", description: "Post expenses, record deposits/withdrawals, reverse transactions, generate financial documents" },
  { key: "finance.budgets", group: "finance", description: "Manage annual budgets, team allocations, and expense tracking" },
  { key: "finance.vouchers", group: "finance", description: "Preview and print official stamped vouchers and expense invoices" },
  { key: "finance.subsidies", group: "finance", description: "Modify club subsidies and treasury opening balance (Programmer/Admin)" },

  { key: "contracts.view", group: "contracts", description: "View contracts" },
  { key: "contracts.manage", group: "contracts", description: "Manage contracts" },

  { key: "correspondence.view", group: "correspondence", description: "View correspondence" },
  { key: "correspondence.manage", group: "correspondence", description: "Manage correspondence" },

  { key: "meetings.view", group: "meetings", description: "View meeting minutes" },
  { key: "meetings.schedule", group: "meetings", description: "Schedule team meetings from the mobile app" },
  { key: "meetings.manage", group: "meetings", description: "Manage meeting minutes" },

  { key: "reports.view", group: "reports", description: "View reports dashboard" },

  { key: "teams.view", group: "teams", description: "View team/category structure" },
  { key: "teams.manage", group: "teams", description: "Edit team/category definitions (birth-year ranges, etc.)" },

  { key: "users.view", group: "users", description: "View users" },
  { key: "users.manage", group: "users", description: "Create/edit/disable users" },

  { key: "roles.manage", group: "roles", description: "Manage roles & permissions" },
  { key: "audit.view", group: "audit", description: "View audit logs" },
  { key: "settings.manage", group: "settings", description: "Manage club settings" },

  // Phase 11 — Official Club Mailbox permissions
  { key: "mail.view", group: "mail", description: "View official club mailbox, threads, and attachments" },
  { key: "mail.send", group: "mail", description: "Send and reply to emails from official mailbox" },
  { key: "mail.manage", group: "mail", description: "Manage official Gmail OAuth connection and settings" },

  // Phase 15 — Player Testing & Performance Engine
  { key: "testing.view", group: "testing", description: "View testing sessions and player performance history" },
  { key: "testing.manage", group: "testing", description: "Create testing sessions, enter measurements and complete sessions" },
  { key: "testing.correct", group: "testing", description: "Correct previously completed test results with an audit log" },
  { key: "testing.manage_definitions", group: "testing", description: "Manage test protocols and performance definitions" },

  // Inventory & Warehouse Equipment
  { key: "inventory.manage", group: "inventory", description: "Manage club inventory, sports gear, and warehouse items" }
];

const ALL_VIEW_PERMS = PERMISSIONS.filter((p) => p.key.endsWith(".view") && p.key !== "medical.records.view" && p.key !== "player.stats.view").map((p) => p.key);

const ROLE_DEFINITIONS: {
  key: string;
  name: string;
  description: string;
  isSystem?: boolean;
  teamScoped?: boolean;
  syncPermissions?: boolean;
  permissions: string[];
}[] = [
  { key: "super_admin", name: "Super Admin", description: "Full system access", isSystem: true, permissions: ["*"] },
  {
    key: "president",
    name: "رئيس الجمعية",
    description: "عرض جميع أقسام المنصة باستثناء إدارة النظام وسجلات الرقابة.",
    syncPermissions: true,
    permissions: [...ALL_VIEW_PERMS.filter((permission) => permission !== "audit.view"), "medical.records.view", "documents.view.restricted"]
  },
  {
    key: "developer",
    name: "DEV",
    description: "Full platform access for development and system administration.",
    // DEV can be removed by a different DEV administrator. Keep only the
    // break-glass super_admin role immutable.
    isSystem: false,
    syncPermissions: true,
    permissions: PERMISSIONS.filter((permission) => permission.key !== "*").map((permission) => permission.key)
  },
  {
    key: "secretary_general",
    name: "الكاتب العام",
    description: "إدارة وثائق الجمعية ومحتوى الموقع ضمن الفئات المعيّنة، دون المالية أو التدريب أو إدارة النظام.",
    teamScoped: true,
    syncPermissions: true,
    permissions: [
      "documents.view", "documents.view.restricted", "documents.create", "documents.update", "documents.delete",
      "templates.view", "templates.manage", "documents.generate",
      "contracts.view", "contracts.manage",
      "correspondence.view", "correspondence.manage",
      "meetings.view", "meetings.manage",
      "news.view", "news.create", "news.update", "news.delete", "news.publish",
      "announcements.view", "announcements.manage",
      "gallery.view", "gallery.manage"
    ]
  },
  {
    key: "director",
    name: "Club Director",
    description: "Club management",
    permissions: [
      "players.view", "players.update",
      "staff.view", "staff.create", "staff.update",
      "matches.view", "calendar.view", "calendar.manage",
      "competitions.view", "competitions.manage",
      "training.view",
      "news.view", "announcements.view", "announcements.manage",
      "gallery.view", "gallery.manage",
      "documents.view", "documents.create", "documents.update", "documents.view.restricted",
      "templates.manage", "documents.generate",
      "contracts.view", "contracts.manage",
      "correspondence.view", "correspondence.manage",
      "meetings.view", "meetings.manage",
      "reports.view", "users.view", "teams.manage",
      "finance.view", "finance.manage", "finance.approve"
    ]
  },
  {
    key: "sporting_director",
    name: "Sporting Director",
    description: "Team and sporting management",
    permissions: [
      "players.view", "players.create", "players.update", "players.archive",
      "staff.view", "staff.create", "staff.update",
      "matches.view", "matches.create", "matches.update", "matches.report",
      "calendar.view", "calendar.manage",
      "competitions.view", "competitions.manage",
      "training.view", "training.manage",
      "testing.view", "testing.manage", "testing.correct", "testing.manage_definitions",
      "documents.view", "documents.generate", "reports.view"
    ]
  },
  {
    key: "team_manager",
    name: "Team Manager",
    description: "Players, matches and calendar",
    permissions: [
      "players.view", "players.create", "players.update", "players.archive",
      "matches.view", "matches.create", "matches.update", "matches.report",
      "calendar.view", "calendar.manage",
      "training.view", "testing.view", "testing.manage", "documents.view", "documents.generate"
    ]
  },
  {
    key: "coach",
    name: "مدرب فئة",
    description: "إدارة تدريبات وإعلانات واجتماعات الفرق المسندة دون إدارة المباريات أو الأخبار.",
    teamScoped: true,
    syncPermissions: true,
    permissions: [
      "players.view", "player.stats.view", "teams.view", "matches.view", "training.view", "training.manage", "calendar.view", "announcements.manage", "meetings.view", "meetings.schedule"
    ]
  },
  {
    key: "assistant_coach",
    name: "مساعد المدرب",
    description: "إدارة تدريبات وإعلانات واجتماعات الفرق المسندة دون إدارة المباريات أو الأخبار.",
    teamScoped: true,
    syncPermissions: true,
    permissions: [
      "players.view", "player.stats.view", "teams.view", "matches.view", "training.view", "training.manage", "calendar.view", "announcements.manage", "meetings.view", "meetings.schedule"
    ]
  },
  {
    key: "media_manager",
    name: "Media Manager",
    description: "News, announcements and gallery — no access to contracts",
    permissions: [
      "news.view", "news.create", "news.update", "news.delete", "news.publish",
      "announcements.view", "announcements.manage",
      "gallery.view", "gallery.manage",
      "matches.view", "players.view", "documents.view"
    ]
  },
  {
    key: "document_manager",
    name: "Document Manager",
    description: "Documents, contracts and correspondence",
    permissions: [
      "documents.view", "documents.view.restricted", "documents.create", "documents.update", "documents.delete",
      "templates.manage", "documents.generate",
      "contracts.view", "contracts.manage",
      "correspondence.view", "correspondence.manage",
      "meetings.view", "meetings.manage",
      "players.view", "reports.view"
    ]
  },
  {
    key: "treasurer",
    name: "أمين الخزينة",
    description: "صلاحيات إدارة العمليات المالية فقط.",
    syncPermissions: true,
    permissions: [
      "finance.view", "finance.manage", "finance.approve", "finance.budgets", "finance.vouchers", "finance.subsidies"
    ]
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to operational data",
    permissions: ALL_VIEW_PERMS.filter((p) => !["users.view", "audit.view", "documents.view.restricted", "finance.view"].includes(p))
  }
];

// A hand-built minimal valid PDF — real magic bytes ("%PDF-"), tiny, and
// contains no real personal data. Used only for demo Document rows.
const DEMO_PDF_BUFFER = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>>>endobj\n" +
    "trailer<</Size 4/Root 1 0 R>>\n%%EOF",
  "utf-8"
);

async function main() {
  console.log("→ Permissions");
  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  console.log("→ Roles + role/permission grants");
  for (const roleDef of ROLE_DEFINITIONS) {
    const existingRole = await db.role.findUnique({
      where: { key: roleDef.key },
      include: { permissions: { include: { permission: { select: { key: true } } } } }
    });
    const previousPermissionKeys = new Set(existingRole?.permissions.map((grant) => grant.permission.key) ?? []);
    const desiredPermissionKeys = new Set(roleDef.permissions);
    const permissionsChanged = roleDef.syncPermissions === true && (
      previousPermissionKeys.size !== desiredPermissionKeys.size ||
      [...previousPermissionKeys].some((key) => !desiredPermissionKeys.has(key))
    );
    const teamScopeChanged = roleDef.teamScoped !== undefined && existingRole?.teamScoped !== roleDef.teamScoped;
    const role = await db.role.upsert({
      where: { key: roleDef.key },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        ...(roleDef.isSystem !== undefined ? { isSystem: roleDef.isSystem } : {}),
        ...(roleDef.teamScoped !== undefined ? { teamScoped: roleDef.teamScoped } : {})
      },
      create: {
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem ?? false,
        teamScoped: roleDef.teamScoped ?? false
      }
    });
    if (roleDef.syncPermissions) {
      const desiredPermissions = await db.permission.findMany({ where: { key: { in: roleDef.permissions } }, select: { id: true } });
      await db.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: desiredPermissions.map((permission) => permission.id) } }
      });
    }
    for (const permKey of roleDef.permissions) {
      const permission = await db.permission.findUniqueOrThrow({ where: { key: permKey } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
    if (existingRole && (permissionsChanged || teamScopeChanged)) {
      await db.user.updateMany({
        where: { roleId: role.id, deletedAt: null },
        data: { tokenVersion: { increment: 1 } }
      });
    }
  }

  console.log("→ Club settings — الجمعية الرياضية أمل سيدي حسني لكرة القدم (ESH)");
  await db.clubSettings.upsert({
    where: { id: "singleton" },
    update: {
      name: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
      shortName: "ESH",
      description: "الجمعية الرياضية أمل سيدي حسني لكرة القدم — تيارت، بلدية سيدي حسني.",
      stadium: "الملعب البلدي طاهري حسني – سيدي حسني",
      address: "الملعب البلدي طاهري حسني – سيدي حسني"
    },
    create: {
      id: "singleton",
      name: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
      shortName: "ESH",
      logoUrl: "/branding/esh-logo.jpg",
      primaryColor: "#B31B1B",
      secondaryColor: "#111111",
      description: "الجمعية الرياضية أمل سيدي حسني لكرة القدم — تيارت، بلدية سيدي حسني.",
      stadium: "الملعب البلدي طاهري حسني – سيدي حسني",
      address: "الملعب البلدي طاهري حسني – سيدي حسني",
      defaultLocale: "ar"
    }
  });

  console.log("→ Teams / categories (spec sections 3–7)");
  const TEAM_DEFS = [
    { category: "SENIOR" as const, name: "Espoir Sidi Hosni — Seniors", shortName: "Seniors", birthYearFrom: null, birthYearTo: null },
    { category: "U20" as const, name: "Espoir Sidi Hosni — U20", shortName: "U20", birthYearFrom: 2007, birthYearTo: 2009 },
    { category: "U17" as const, name: "Espoir Sidi Hosni — U17", shortName: "U17", birthYearFrom: 2010, birthYearTo: 2011 },
    { category: "U15" as const, name: "Espoir Sidi Hosni — U15", shortName: "U15", birthYearFrom: 2012, birthYearTo: 2013 }
  ];
  const teamsByCategory: Record<string, { id: string }> = {};
  for (const def of TEAM_DEFS) {
    const team = await db.team.upsert({ where: { category: def.category }, update: {}, create: def });
    teamsByCategory[def.category] = team;
  }
  const seniorTeam = teamsByCategory.SENIOR!;

  console.log("→ Document categories");
  const categoryDefs = [
    { key: "contract", name: "Contracts" },
    { key: "administrative", name: "Administrative Documents" },
    { key: "registration", name: "Registration Documents" },
    { key: "correspondence", name: "Correspondence" },
    { key: "meeting_minute", name: "Meeting Minutes" },
    { key: "report", name: "Reports" },
    { key: "calendar", name: "Calendars" },
    { key: "decision", name: "Official Decisions" },
    { key: "certificate", name: "Certificates" },
    { key: "other", name: "Other Documents" }
  ];
  for (const c of categoryDefs) {
    await db.documentCategory.upsert({ where: { key: c.key }, update: {}, create: c });
  }
  const contractCategory = await db.documentCategory.findUniqueOrThrow({ where: { key: "contract" } });

  console.log("→ Season");
  const season = await db.season.upsert({
    where: { label: "2026/2027" },
    update: {},
    create: { label: "2026/2027", startDate: new Date("2026-08-01"), endDate: new Date("2027-06-30"), isCurrent: true }
  });

  // ========================================================================
  // PRODUCTION SAFETY GUARD
  // ------------------------------------------------------------------------
  // In production environments (NODE_ENV=production), demo users (@demo-club.local),
  // dummy players, and test fixtures are strictly prevented from populating
  // the live database unless explicitly forced via ALLOW_DEMO_SEED=true.
  // ========================================================================
  const isProduction = process.env.NODE_ENV === "production";
  const allowDemoSeed = process.env.ALLOW_DEMO_SEED === "true";

  if (isProduction && !allowDemoSeed) {
    console.log("\n🔒 Production environment detected (NODE_ENV=production).");
    console.log("✅ Core system metadata synchronized: Permissions, Roles, Club Settings, Teams, Categories, Season.");
    console.log("🛡 Skipped demo users, dummy players, and test fixtures for production safety.");
    console.log("👉 To provision the initial production Super Admin, run: npm run bootstrap:admin\n");
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD;
  const demoPasswordBytes = demoPassword ? new TextEncoder().encode(demoPassword).length : 0;
  if (!demoPassword || demoPassword.length < 8 || demoPasswordBytes > 72) {
    throw new Error(
      "Set DEMO_PASSWORD in your .env (at least 8 characters and no more than 72 UTF-8 bytes) before seeding demo accounts — demo credentials are never hardcoded. See .env.example."
    );
  }
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  console.log("→ Demo users (one per role)");
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await db.role.findUniqueOrThrow({ where: { key: roleDef.key } });
    await db.user.upsert({
      where: { email: `${roleDef.key}@demo-club.local` },
      // The documented DEMO_PASSWORD is authoritative for seeded demo users;
      // keep the stored hash in sync if that configured password changes.
      update: { passwordHash },
      create: {
        name: roleDef.name,
        email: `${roleDef.key}@demo-club.local`,
        passwordHash,
        roleId: role.id
      }
    });
  }
  const superAdmin = await db.user.findUniqueOrThrow({ where: { email: "super_admin@demo-club.local" } });

  console.log("→ Competition (Demo)");
  const competition = await db.competition.create({
    data: { name: "Régional 3 (Demo season data)", seasonId: season.id, status: "ONGOING", teamId: seniorTeam.id }
  });

  console.log("→ Players");
  const playerDefs = [
    { firstName: "Yacine", lastName: "Belkacem", position: "GOALKEEPER", nationality: "Algeria", shirtNumber: 1, dob: "1998-02-14" },
    { firstName: "Karim", lastName: "Ferhat", position: "DEFENDER", nationality: "Algeria", shirtNumber: 4, dob: "1997-05-20" },
    { firstName: "Nabil", lastName: "Cherif", position: "DEFENDER", nationality: "Algeria", shirtNumber: 5, dob: "1999-11-02" },
    { firstName: "Samir", lastName: "Amrani", position: "DEFENDER", nationality: "Morocco", shirtNumber: 2, dob: "1996-08-09" },
    { firstName: "Walid", lastName: "Boudiaf", position: "MIDFIELDER", nationality: "Algeria", shirtNumber: 8, dob: "2000-01-17" },
    { firstName: "Farid", lastName: "Meziane", position: "MIDFIELDER", nationality: "Tunisia", shirtNumber: 10, dob: "1998-09-23" },
    { firstName: "Adel", lastName: "Haddad", position: "MIDFIELDER", nationality: "Algeria", shirtNumber: 6, dob: "1999-03-30" },
    { firstName: "Riad", lastName: "Slimani", position: "FORWARD", nationality: "Algeria", shirtNumber: 9, dob: "2001-06-12" },
    { firstName: "Bilal", lastName: "Toure", position: "FORWARD", nationality: "Mali", shirtNumber: 11, dob: "2000-12-05" },
    { firstName: "Hocine", lastName: "Zeroual", position: "FORWARD", nationality: "Algeria", shirtNumber: 7, dob: "1997-04-18" }
  ] as const;

  const players = [];
  for (const p of playerDefs) {
    const slug = `${p.firstName}-${p.lastName}`.toLowerCase();
    const player = await db.player.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        nationality: p.nationality,
        shirtNumber: p.shirtNumber,
        dateOfBirth: new Date(p.dob),
        status: "ACTIVE",
        joiningDate: new Date("2025-07-01"),
        teamId: seniorTeam.id
      }
    });
    players.push(player);
  }

  console.log("→ Staff");
  const headCoach = await db.staff.create({
    data: { firstName: "Mourad", lastName: "Benhalima", role: "HEAD_COACH", status: "ACTIVE", biography: "Demo head coach.", teamId: seniorTeam.id }
  });
  await db.staff.create({
    data: { firstName: "Sofiane", lastName: "Djebbar", role: "MEDICAL_STAFF", status: "ACTIVE", teamId: seniorTeam.id }
  });

  console.log("→ Matches (past + upcoming)");
  const pastMatch = await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: "Espoir Sidi Hosni",
      awayTeamName: "Rival City FC (Demo)",
      isHomeFixture: true,
      homeScore: 2,
      awayScore: 1,
      matchDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      stadium: "Demo Municipal Stadium",
      status: "FINISHED",
      matchReport: "Demo match report text."
    }
  });
  await db.matchEvent.createMany({
    data: [
      { matchId: pastMatch.id, playerId: players[7]!.id, type: "GOAL", minute: 23 },
      { matchId: pastMatch.id, playerId: players[8]!.id, type: "GOAL", minute: 67 },
      { matchId: pastMatch.id, playerId: players[2]!.id, type: "YELLOW_CARD", minute: 40 }
    ]
  });

  const upcomingMatch = await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: "Espoir Sidi Hosni",
      awayTeamName: "Northern United (Demo)",
      isHomeFixture: true,
      matchDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      stadium: "Demo Municipal Stadium",
      status: "SCHEDULED"
    }
  });
  await db.calendarEvent.create({
    data: {
      title: "vs Northern United (Demo)",
      type: "MATCH",
      startDateTime: upcomingMatch.matchDate,
      endDateTime: new Date(upcomingMatch.matchDate.getTime() + 2 * 3600 * 1000),
      relatedMatchId: upcomingMatch.id
    }
  });

  console.log("→ News + Announcement");
  const news = await db.news.create({
    data: {
      authorId: superAdmin.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
      category: "club",
      translations: {
        create: [
          { locale: "ar", title: "انطلاقة موسم جديد", slug: "new-season-kickoff", content: "محتوى تجريبي للخبر باللغة العربية." },
          { locale: "fr", title: "Coup d'envoi de la nouvelle saison", slug: "new-season-kickoff", content: "Contenu de démonstration en français." }
        ]
      }
    }
  });

  await db.announcement.create({
    data: {
      priority: "NORMAL",
      startDate: new Date(),
      homepageVisibility: true,
      status: "PUBLISHED",
      createdById: superAdmin.id,
      translations: {
        create: [
          { locale: "ar", title: "إعلان تجريبي", content: "هذا إعلان تجريبي." },
          { locale: "fr", title: "Annonce de démonstration", content: "Ceci est une annonce de démonstration." }
        ]
      }
    }
  });

  console.log("→ Demo contract document (RESTRICTED, safe demo file only)");
  const canUploadDemoFile = Boolean(
    process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY && process.env.STORAGE_PRIVATE_BUCKET
  );
  if (canUploadDemoFile) {
    const { uploadPrivateFile, generateStorageKey } = await import("../src/lib/storage");
    const storageKey = generateStorageKey("contract", "pdf");
    await uploadPrivateFile({ key: storageKey, buffer: DEMO_PDF_BUFFER, mimeType: "application/pdf" });
    await db.document.create({
      data: {
        name: `Contract — ${players[0]!.firstName} ${players[0]!.lastName} (Demo)`,
        categoryId: contractCategory.id,
        classification: "RESTRICTED",
        status: "APPROVED",
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: DEMO_PDF_BUFFER.byteLength,
        originalName: "demo-contract.pdf",
        ownerId: superAdmin.id,
        uploadedById: superAdmin.id,
        relatedPlayerId: players[0]!.id
      }
    });
  } else {
    console.warn(
      "⚠ Skipped demo Document row — STORAGE_* env vars not set yet, so there is no bucket to upload the demo PDF to. " +
        "Configure storage in .env and re-run `npm run db:seed` to see the Documents module populated."
    );
  }

  console.log("→ Populating standard FIFA/UEFA and endurance test definitions...");
  const { ensureDefaultTestDefinitions } = await import("../src/lib/testing/seed-definitions");
  await ensureDefaultTestDefinitions(db);

  console.log("\n✅ Seed complete.");
  console.log(`Demo accounts (password: value of DEMO_PASSWORD in your .env):`);
  for (const roleDef of ROLE_DEFINITIONS) {
    console.log(`  - ${roleDef.key}@demo-club.local  (${roleDef.name})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
