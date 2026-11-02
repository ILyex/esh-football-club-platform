-- Covering indexes for hot foreign keys that were read on every dashboard page
-- but never indexed (sequential scans on Document/Correspondence/Match lists,
-- training attendance and medical-record lookups).
--
-- IF NOT EXISTS keeps this safe on databases where an index was created manually.

CREATE INDEX IF NOT EXISTS "Document_ownerId_idx" ON "Document"("ownerId");
CREATE INDEX IF NOT EXISTS "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX IF NOT EXISTS "Document_relatedStaffId_idx" ON "Document"("relatedStaffId");

CREATE INDEX IF NOT EXISTS "Match_competitionId_idx" ON "Match"("competitionId");

CREATE INDEX IF NOT EXISTS "Correspondence_responsibleUserId_idx" ON "Correspondence"("responsibleUserId");
CREATE INDEX IF NOT EXISTS "Correspondence_relatedPlayerId_idx" ON "Correspondence"("relatedPlayerId");
CREATE INDEX IF NOT EXISTS "Correspondence_relatedMatchId_idx" ON "Correspondence"("relatedMatchId");

CREATE INDEX IF NOT EXISTS "TrainingAttendance_playerId_idx" ON "TrainingAttendance"("playerId");
CREATE INDEX IF NOT EXISTS "TrainingSession_coachId_idx" ON "TrainingSession"("coachId");
CREATE INDEX IF NOT EXISTS "TrainingSession_date_idx" ON "TrainingSession"("date");

CREATE INDEX IF NOT EXISTS "PlayerMedicalRecord_createdById_idx" ON "PlayerMedicalRecord"("createdById");
