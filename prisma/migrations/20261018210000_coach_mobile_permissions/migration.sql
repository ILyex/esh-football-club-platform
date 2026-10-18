INSERT INTO "Permission" ("id", "key", "group", "description")
VALUES ('meetings.schedule', 'meetings.schedule', 'meetings', 'Schedule team meetings from the mobile app')
ON CONFLICT ("key") DO NOTHING;

UPDATE "Role"
SET "teamScoped" = TRUE
WHERE "key" IN ('coach', 'assistant_coach');

DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."key" IN ('coach', 'assistant_coach')
  AND p."key" IN ('matches.create', 'matches.update', 'matches.delete', 'matches.report', 'news.create', 'news.update', 'news.delete', 'news.publish');

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('coach', 'assistant_coach')
  AND p."key" IN ('training.manage', 'announcements.manage', 'meetings.view', 'meetings.schedule')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

UPDATE "User" u
SET "tokenVersion" = "tokenVersion" + 1
FROM "Role" r
WHERE u."roleId" = r."id"
  AND r."key" IN ('coach', 'assistant_coach')
  AND u."deletedAt" IS NULL;
