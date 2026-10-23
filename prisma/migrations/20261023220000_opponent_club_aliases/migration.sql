CREATE TABLE "OpponentClubAlias" (
  "normalizedName" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "opponentClubId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpponentClubAlias_pkey" PRIMARY KEY ("normalizedName")
);

CREATE INDEX "OpponentClubAlias_opponentClubId_idx"
ON "OpponentClubAlias"("opponentClubId");

ALTER TABLE "OpponentClubAlias"
ADD CONSTRAINT "OpponentClubAlias_opponentClubId_fkey"
FOREIGN KEY ("opponentClubId") REFERENCES "OpponentClub"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing canonical opponent name becomes its first resolvable alias.
INSERT INTO "OpponentClubAlias" ("normalizedName", "name", "opponentClubId")
SELECT "normalizedName", "name", "id" FROM "OpponentClub"
ON CONFLICT ("normalizedName") DO NOTHING;

-- Preserve bilingual fixture strings as aliases while resolving their Arabic
-- canonical prefix to the existing opponent record.
INSERT INTO "OpponentClubAlias" ("normalizedName", "name", "opponentClubId")
SELECT DISTINCT LOWER(BTRIM(opponent."name")), BTRIM(opponent."name"), clubs."id"
FROM "Match" m
CROSS JOIN LATERAL (
  SELECT CASE WHEN m."isHomeFixture" THEN m."awayTeamName" ELSE m."homeTeamName" END AS "name"
) opponent
JOIN "OpponentClub" clubs
  ON clubs."normalizedName" = LOWER(BTRIM(SPLIT_PART(opponent."name", ' (', 1)))
WHERE POSITION(' (' IN opponent."name") > 0
ON CONFLICT ("normalizedName") DO NOTHING;

-- Also register exact fixture names already stored on matches when they match
-- a known canonical name after PostgreSQL's case/space normalization.
INSERT INTO "OpponentClubAlias" ("normalizedName", "name", "opponentClubId")
SELECT DISTINCT LOWER(BTRIM(opponent."name")), BTRIM(opponent."name"), clubs."id"
FROM "Match" m
CROSS JOIN LATERAL (
  SELECT CASE WHEN m."isHomeFixture" THEN m."awayTeamName" ELSE m."homeTeamName" END AS "name"
) opponent
JOIN "OpponentClub" clubs
  ON clubs."normalizedName" = LOWER(BTRIM(opponent."name"))
WHERE BTRIM(opponent."name") <> ''
ON CONFLICT ("normalizedName") DO NOTHING;
