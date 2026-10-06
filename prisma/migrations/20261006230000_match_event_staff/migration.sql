ALTER TABLE "MatchEvent" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
DO $$ BEGIN
  CREATE TYPE "MatchEventSide" AS ENUM ('HOME', 'AWAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "MatchEvent" ADD COLUMN IF NOT EXISTS "side" "MatchEventSide" NOT NULL DEFAULT 'HOME';
CREATE INDEX IF NOT EXISTS "MatchEvent_staffId_idx" ON "MatchEvent"("staffId");
DO $$ BEGIN
  ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
