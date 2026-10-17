ALTER TABLE "MatchEvent" ADD COLUMN "fafExternalKey" TEXT;

CREATE UNIQUE INDEX "MatchEvent_matchId_fafExternalKey_key"
ON "MatchEvent"("matchId", "fafExternalKey");
