-- Align columns that existed in the legacy production database but were
-- accidentally omitted from the earlier player/content migration.
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "News"
  ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Player"
  ADD COLUMN IF NOT EXISTS "firstNameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "lastNameFr" TEXT;

-- These timestamps are maintained by Prisma's @updatedAt hook, not by SQL
-- defaults. Keeping the database in the same shape avoids schema drift.
ALTER TABLE "InventoryItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TestDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TestResult" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TestSession" ALTER COLUMN "updatedAt" DROP DEFAULT;
