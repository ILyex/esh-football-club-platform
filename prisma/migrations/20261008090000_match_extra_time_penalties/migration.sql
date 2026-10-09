ALTER TYPE "MatchEventType" ADD VALUE 'PENALTY_GOAL';

ALTER TABLE "Match"
ADD COLUMN "hasExtraTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasPenaltyShootout" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ShootoutKickResult" AS ENUM ('SCORED', 'MISSED');

CREATE TABLE "MatchShootoutKick" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "side" "MatchEventSide" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "result" "ShootoutKickResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchShootoutKick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchShootoutKick_matchId_side_attemptNumber_key"
ON "MatchShootoutKick"("matchId", "side", "attemptNumber");

CREATE INDEX "MatchShootoutKick_matchId_createdAt_idx"
ON "MatchShootoutKick"("matchId", "createdAt");

ALTER TABLE "MatchShootoutKick"
ADD CONSTRAINT "MatchShootoutKick_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchShootoutKick"
ADD CONSTRAINT "MatchShootoutKick_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
