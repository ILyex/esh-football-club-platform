import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding and synchronizing standard ESH institutional club roles...");

  // 1. Fetch all permissions to have their IDs
  const allPermissions = await db.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  function getIds(keys: string[]): string[] {
    const ids: string[] = [];
    for (const key of keys) {
      const id = permMap.get(key);
      if (id) ids.push(id);
    }
    return ids;
  }

  // 2. Define standard 5 roles
  const rolesToSync = [
    {
      key: "super_admin",
      name: "مبرمج / مطور النظام (Super Admin)",
      description: "صلاحيات برمجية وهندسية وإدارية كاملة وغير مقيدة على كافة أقسام المنصة (*)",
      isSystem: true,
      teamScoped: false,
      permissionKeys: ["*"]
    },
    {
      key: "president",
      name: "رئيس النادي (Président du Club)",
      description: "الإدارة العليا للنادي، توقيع العقود الرسمية، تمثيل النادي أمام الرابطة والاتحاد، والاطلاع الشامل على التقارير المالية والرياضية",
      isSystem: false,
      teamScoped: false,
      permissionKeys: [
        "teams.view",
        "teams.manage",
        "players.view",
        "players.create",
        "players.update",
        "staff.view",
        "staff.create",
        "staff.update",
        "matches.view",
        "matches.report",
        "contracts.view",
        "contracts.manage",
        "documents.view",
        "documents.view.restricted",
        "documents.create",
        "documents.generate",
        "correspondence.view",
        "correspondence.manage",
        "meetings.view",
        "meetings.manage",
        "reports.view",
        "finance.view",
        "news.view",
        "news.publish",
        "announcements.view",
        "announcements.manage"
      ]
    },
    {
      key: "treasurer",
      name: "أمين الخزينة (Trésorier Général)",
      description: "المسؤول المالي عن الخزينة، إيداع الإعانات ومساعدات المحبين، اعتماد وصرف فواتير المصاريف، مراقبة الميزانيات، وحفظ الفواتير والوصولات المختومة",
      isSystem: false,
      teamScoped: false,
      permissionKeys: [
        "finance.view",
        "finance.manage",
        "finance.approve",
        "documents.view",
        "documents.create",
        "documents.generate",
        "templates.view",
        "reports.view"
      ]
    },
    {
      key: "sporting_director",
      name: "المدير الفني (Directeur Technique)",
      description: "الإشراف الفني والرياضي على كافة الفئات الشبانية والأكابر، وضع وتتبع الحصص التدريبية، اعتماد نتائج اختبارات اللياقة (اليويو)، وتقارير المباريات",
      isSystem: false,
      teamScoped: false,
      permissionKeys: [
        "teams.view",
        "teams.manage",
        "players.view",
        "players.create",
        "players.update",
        "staff.view",
        "matches.view",
        "matches.report",
        "training.view",
        "training.manage",
        "testing.view",
        "testing.manage",
        "testing.correct",
        "testing.manage_definitions",
        "competitions.view",
        "competitions.manage",
        "calendar.view",
        "calendar.manage",
        "reports.view"
      ]
    },
    {
      key: "coach",
      name: "مدرب الفريق (Entraîneur)",
      description: "الإشراف الميداني على تدريبات الفريق المخصص، تقييم اللاعبين، تسجيل نتائج اختبارات اللياقة واليويو، وإعداد تشكيلة ورقة المباراة",
      isSystem: false,
      teamScoped: true,
      permissionKeys: [
        "players.view",
        "players.update",
        "matches.view",
        "matches.report",
        "training.view",
        "training.manage",
        "testing.view",
        "testing.manage",
        "calendar.view"
      ]
    }
  ];

  for (const roleDef of rolesToSync) {
    const existing = await db.role.findUnique({ where: { key: roleDef.key } });
    let roleId: string;

    if (existing) {
      const updated = await db.role.update({
        where: { key: roleDef.key },
        data: {
          name: roleDef.name,
          description: roleDef.description,
          teamScoped: roleDef.teamScoped,
          isSystem: roleDef.isSystem
        }
      });
      roleId = updated.id;
      console.log(`Updated role: ${roleDef.key} -> "${roleDef.name}"`);
    } else {
      const created = await db.role.create({
        data: {
          key: roleDef.key,
          name: roleDef.name,
          description: roleDef.description,
          teamScoped: roleDef.teamScoped,
          isSystem: roleDef.isSystem
        }
      });
      roleId = created.id;
      console.log(`Created role: ${roleDef.key} -> "${roleDef.name}"`);
    }

    // Sync permissions
    const desiredPermissionIds = getIds(roleDef.permissionKeys);
    // Remove old mappings
    await db.rolePermission.deleteMany({ where: { roleId } });
    // Insert new mappings
    if (desiredPermissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: desiredPermissionIds.map((pId) => ({
          roleId,
          permissionId: pId
        }))
      });
    }
    console.log(`  Assigned ${desiredPermissionIds.length} permissions to ${roleDef.key}`);
  }

  console.log("Standard roles seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
