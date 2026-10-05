import { db } from "@/lib/db";
import { ensureDefaultTestDefinitions } from "./seed-definitions";

export async function initTestingDatabase(): Promise<void> {
  // 1. Seed Default Test Definitions
  await ensureDefaultTestDefinitions(db);

  // 2. Ensure Permissions exist
  const perms = [
    { key: "testing.view", group: "testing", description: "View testing sessions and player performance history" },
    { key: "testing.manage", group: "testing", description: "Create testing sessions, enter measurements and complete sessions" },
    { key: "testing.correct", group: "testing", description: "Correct previously completed test results with an audit log" },
    { key: "testing.manage_definitions", group: "testing", description: "Manage test protocols and performance definitions" },
  ];

  for (const p of perms) {
    await db.permission.upsert({
      where: { key: p.key },
      update: { group: p.group, description: p.description },
      create: p,
    });
  }

  // 3. Ensure Coach and Team Manager roles get testing.view and testing.manage
  const targetRoles = ["coach", "team_manager", "director", "president"];
  for (const roleKey of targetRoles) {
    const role = await db.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;

    const rolePerms = roleKey === "director"
      ? ["testing.view", "testing.manage", "testing.correct", "testing.manage_definitions"]
      : ["testing.view", "testing.manage"];

    for (const permKey of rolePerms) {
      const perm = await db.permission.findUnique({ where: { key: permKey } });
      if (perm) {
        await db.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          }
        });
      }
    }
  }
}
