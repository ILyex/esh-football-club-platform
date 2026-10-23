-- Retire the temporary zero-permission role created for unconfigured staff accounts.
-- Move those accounts to the least-privileged standard role before removing it.
DO $$
DECLARE
  viewer_role_id TEXT;
  staff_profile_role_id TEXT;
BEGIN
  INSERT INTO "Role" ("id", "key", "name", "description", "isSystem", "createdAt", "teamScoped")
  VALUES (gen_random_uuid()::text, 'viewer', 'Viewer', 'Read-only access to operational data', false, NOW(), false)
  ON CONFLICT ("key") DO NOTHING;

  SELECT "id" INTO viewer_role_id FROM "Role" WHERE "key" = 'viewer';
  SELECT "id" INTO staff_profile_role_id FROM "Role" WHERE "key" = 'staff_profile';

  IF staff_profile_role_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE "User"
  SET "roleId" = viewer_role_id,
      "tokenVersion" = "tokenVersion" + 1,
      "lastSeenAt" = NULL
  WHERE "roleId" = staff_profile_role_id;

  UPDATE "Staff"
  SET "accountRoleId" = viewer_role_id
  WHERE "accountRoleId" = staff_profile_role_id;

  DELETE FROM "RolePermission" WHERE "roleId" = staff_profile_role_id;
  DELETE FROM "Role" WHERE "id" = staff_profile_role_id;
END $$;
