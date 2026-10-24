UPDATE "Role"
SET "teamScoped" = TRUE,
    "description" = 'إدارة وثائق الجمعية ومحتوى الموقع ضمن الفئات المعيّنة، دون المالية أو التدريب أو إدارة النظام.'
WHERE "key" = 'secretary_general';

UPDATE "Role"
SET "teamScoped" = FALSE
WHERE "key" = 'president';

DELETE FROM "UserTeam"
WHERE "userId" IN (
  SELECT u."id"
  FROM "User" u
  INNER JOIN "Role" r ON r."id" = u."roleId"
  WHERE r."key" = 'president'
);
