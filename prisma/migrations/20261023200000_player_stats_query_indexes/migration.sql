CREATE INDEX "Competition_seasonId_idx" ON "Competition"("seasonId");
CREATE INDEX "Match_teamId_status_competitionId_idx" ON "Match"("teamId", "status", "competitionId");
CREATE INDEX "MatchEvent_playerId_matchId_idx" ON "MatchEvent"("playerId", "matchId");
CREATE INDEX "MatchLineup_playerId_matchId_idx" ON "MatchLineup"("playerId", "matchId");
