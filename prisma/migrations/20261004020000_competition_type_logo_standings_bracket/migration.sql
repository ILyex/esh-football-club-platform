-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'CUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "type" "CompetitionType" NOT NULL DEFAULT 'LEAGUE';
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "standingsData" JSONB;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "bracketData" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Competition_type_idx" ON "Competition"("type");
