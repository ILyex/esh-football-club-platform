ALTER TYPE "MatchEventType" ADD VALUE IF NOT EXISTS 'SHOT';

CREATE TABLE "PlayerShot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchEventId" TEXT,
    "playerId" TEXT,
    "assistPlayerId" TEXT,
    "side" "MatchEventSide" NOT NULL,
    "minute" INTEGER NOT NULL,
    "bodyPart" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "situation" TEXT NOT NULL DEFAULT 'OPEN_PLAY',
    "outcome" TEXT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "xG" DOUBLE PRECISION,
    "xgModelVersion" TEXT NOT NULL DEFAULT 'esh-xg-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerShot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerShot_matchEventId_key" ON "PlayerShot"("matchEventId");
CREATE INDEX "PlayerShot_matchId_minute_idx" ON "PlayerShot"("matchId", "minute");
CREATE INDEX "PlayerShot_playerId_matchId_idx" ON "PlayerShot"("playerId", "matchId");
CREATE INDEX "PlayerShot_assistPlayerId_idx" ON "PlayerShot"("assistPlayerId");

ALTER TABLE "PlayerShot" ADD CONSTRAINT "PlayerShot_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerShot" ADD CONSTRAINT "PlayerShot_matchEventId_fkey"
  FOREIGN KEY ("matchEventId") REFERENCES "MatchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerShot" ADD CONSTRAINT "PlayerShot_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerShot" ADD CONSTRAINT "PlayerShot_assistPlayerId_fkey"
  FOREIGN KEY ("assistPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "group", "description")
VALUES ('player.stats.view', 'player.stats.view', 'players', 'View team-scoped player performance and match statistics')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" IN ('coach', 'assistant_coach', 'developer') AND p."key" = 'player.stats.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

UPDATE "User" u
SET "tokenVersion" = "tokenVersion" + 1
FROM "Role" r
JOIN "RolePermission" rp ON rp."roleId" = r."id"
JOIN "Permission" p ON p."id" = rp."permissionId"
WHERE u."roleId" = r."id"
  AND r."key" IN ('coach', 'assistant_coach', 'developer')
  AND p."key" = 'player.stats.view';
