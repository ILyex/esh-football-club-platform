-- Normalize legacy staff with multiple operational categories. Keep the
-- canonical Staff.teamId when present, otherwise keep the oldest assignment.
UPDATE "Staff" s
SET "teamId" = (
  SELECT st."teamId" FROM "StaffTeam" st
  WHERE st."staffId" = s."id"
  ORDER BY st."createdAt" ASC, st."teamId" ASC
  LIMIT 1
)
WHERE s."teamId" IS NULL
  AND EXISTS (SELECT 1 FROM "StaffTeam" st WHERE st."staffId" = s."id");

DELETE FROM "StaffTeam" st
USING "Staff" s
WHERE st."staffId" = s."id"
  AND s."teamId" IS NOT NULL
  AND st."teamId" <> s."teamId";

INSERT INTO "StaffTeam" ("staffId", "teamId", "createdAt")
SELECT s."id", s."teamId", CURRENT_TIMESTAMP
FROM "Staff" s
WHERE s."teamId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "StaffTeam" st
    WHERE st."staffId" = s."id" AND st."teamId" = s."teamId"
  );

-- Linked staff account team access follows the same single category.
DELETE FROM "UserTeam" ut
USING "Staff" s
WHERE s."userId" = ut."userId"
  AND (s."teamId" IS NULL OR ut."teamId" <> s."teamId");

INSERT INTO "UserTeam" ("userId", "teamId", "createdAt")
SELECT s."userId", s."teamId", CURRENT_TIMESTAMP
FROM "Staff" s
WHERE s."userId" IS NOT NULL
  AND s."teamId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserTeam" ut
    WHERE ut."userId" = s."userId" AND ut."teamId" = s."teamId"
  );

-- Keep the digital-card profession in sync with the canonical staff role and
-- its one category so the website and mobile app show the same designation.
UPDATE "User" u
SET "licenseRole" = CONCAT_WS(
  ' — ',
  CASE s."role"
    WHEN 'HEAD_COACH' THEN 'Entraîneur principal'
    WHEN 'ASSISTANT_COACH' THEN 'Entraîneur adjoint'
    WHEN 'GOALKEEPING_COACH' THEN 'Entraîneur des gardiens'
    WHEN 'FITNESS_COACH' THEN 'Préparateur physique'
    WHEN 'MEDICAL_STAFF' THEN 'Personnel médical'
    WHEN 'ADMINISTRATIVE_STAFF' THEN 'Personnel administratif'
    ELSE 'Staff'
  END,
  CASE t."category"
    WHEN 'SENIOR' THEN 'Seniors'
    WHEN 'U20' THEN 'U20'
    WHEN 'U17' THEN 'U17'
    WHEN 'U15' THEN 'U15'
    ELSE NULL
  END
)
FROM "Staff" s
LEFT JOIN "Team" t ON t."id" = s."teamId"
WHERE s."userId" = u."id";

-- Resolve existing duplicate active head coaches by keeping the oldest active
-- profile and making the others inactive for an administrator review.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "teamId" ORDER BY "createdAt" ASC, "id" ASC) AS position
  FROM "Staff"
  WHERE "role" = 'HEAD_COACH' AND "status" = 'ACTIVE' AND "teamId" IS NOT NULL
)
UPDATE "Staff" s
SET "status" = 'INACTIVE'
FROM ranked r
WHERE s."id" = r."id" AND r.position > 1;

CREATE UNIQUE INDEX "Staff_one_active_head_coach_per_team"
ON "Staff" ("teamId")
WHERE "role" = 'HEAD_COACH' AND "status" = 'ACTIVE' AND "teamId" IS NOT NULL;
