import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000 });
const db = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

const templates = [
  {
    key: "coach",
    name: "مدرب فئة",
    description: "عرض التدريب وقائمة لاعبي الفرق المسندة للمدرب دون تعديل.",
    teamScoped: true,
    isSystem: false,
    permissions: ["players.view", "teams.view", "matches.view", "training.view", "calendar.view"]
  },
  {
    key: "treasurer",
    name: "أمين الخزينة",
    description: "صلاحيات إدارة العمليات المالية فقط.",
    teamScoped: false,
    isSystem: false,
    permissions: ["finance.view", "finance.manage", "finance.approve", "finance.budgets", "finance.vouchers", "finance.subsidies"]
  },
  {
    key: "secretary_general",
    name: "الكاتب العام",
    description: "إدارة وثائق الجمعية ومحتوى الموقع دون المالية أو التدريب أو إدارة النظام.",
    teamScoped: false,
    isSystem: false,
    permissions: [
      "documents.view", "documents.view.restricted", "documents.create", "documents.update", "documents.delete",
      "templates.view", "templates.manage", "documents.generate",
      "contracts.view", "contracts.manage", "correspondence.view", "correspondence.manage",
      "meetings.view", "meetings.manage",
      "news.view", "news.create", "news.update", "news.delete", "news.publish",
      "announcements.view", "announcements.manage", "gallery.view", "gallery.manage"
    ]
  },
  {
    key: "president",
    name: "رئيس الجمعية",
    description: "عرض جميع أقسام المنصة باستثناء إدارة النظام وسجلات الرقابة.",
    teamScoped: false,
    isSystem: false,
    permissions: [] as string[]
  },
  {
    key: "developer",
    name: "DEV",
    description: "Full platform access for development and system administration.",
    teamScoped: false,
    isSystem: false,
    permissions: [] as string[]
  }
];

async function main() {
  const allPermissions = await db.permission.findMany({ orderBy: { key: "asc" } });
  const permissionByKey = new Map(allPermissions.map((permission) => [permission.key, permission]));
  const viewPermissions = allPermissions
    .filter((permission) => permission.key.endsWith(".view") && permission.key !== "audit.view" && permission.key !== "medical.records.view")
    .map((permission) => permission.key);
  const president = templates.find((role) => role.key === "president")!;
  president.permissions = [...viewPermissions, "medical.records.view", "documents.view.restricted"];
  const developer = templates.find((role) => role.key === "developer")!;
  developer.permissions = allPermissions.filter((permission) => permission.key !== "*").map((permission) => permission.key);

  for (const role of templates) {
    const missing = role.permissions.filter((key) => !permissionByKey.has(key));
    if (missing.length) throw new Error(`Missing permission records for ${role.key}: ${missing.join(", ")}`);
  }

  const report = await Promise.all(templates.map(async (template) => {
    const role = await db.role.findUnique({
      where: { key: template.key },
      include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } }
    });
    const current = new Set(role?.permissions.map((grant) => grant.permission.key) ?? []);
    const desired = new Set(template.permissions);
    const permissionsChanged = current.size !== desired.size || [...current].some((key) => !desired.has(key));
    const teamScopeChanged = (role?.teamScoped ?? false) !== template.teamScoped;
    return {
      ...template,
      exists: Boolean(role),
      assignedUsers: role?._count.users ?? 0,
      currentPermissionCount: current.size,
      permissionsChanged,
      teamScopeChanged,
      changed: !role || permissionsChanged || teamScopeChanged || role.name !== template.name || role.description !== template.description || role.isSystem !== template.isSystem
    };
  }));

  console.log(JSON.stringify(report.map(({ key, name, exists, assignedUsers, currentPermissionCount, permissions, permissionsChanged, teamScopeChanged, changed }) => ({
    key, name, exists, assignedUsers, currentPermissionCount, desiredPermissionCount: permissions.length, permissionsChanged, teamScopeChanged, changed
  })), null, 2));

  if (!process.argv.includes("--apply")) {
    console.log("Read-only preview. Pass --apply to synchronize these five role templates.");
    return;
  }

  await db.$transaction(async (tx) => {
    for (const item of report) {
      const role = await tx.role.upsert({
        where: { key: item.key },
        update: { name: item.name, description: item.description, teamScoped: item.teamScoped, isSystem: item.isSystem },
        create: {
          key: item.key, name: item.name, description: item.description,
          teamScoped: item.teamScoped, isSystem: item.isSystem
        }
      });
      const permissions = item.permissions.map((key) => permissionByKey.get(key)!);
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id }))
      });
      if (item.exists && item.changed) {
        await tx.user.updateMany({ where: { roleId: role.id, deletedAt: null }, data: { tokenVersion: { increment: 1 } } });
      }
    }
  });

  console.log("Role permissions synchronized. Users in changed roles must sign in again; their existing tokens were revoked.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
