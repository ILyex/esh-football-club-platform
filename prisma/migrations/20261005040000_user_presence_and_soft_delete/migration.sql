ALTER TABLE "User"
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_lastSeenAt_idx" ON "User"("deletedAt", "lastSeenAt");
