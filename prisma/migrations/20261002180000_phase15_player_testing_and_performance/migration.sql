-- Phase 15: Player Testing & Performance Engine Migration

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "TestCategory" AS ENUM ('ENDURANCE', 'SPEED', 'AGILITY', 'POWER', 'STRENGTH', 'FLEXIBILITY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MetricDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'NEUTRAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TestSessionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TestResultStatus" AS ENUM ('VALID', 'INCOMPLETE', 'DISQUALIFIED', 'ABSENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TESTING_RETEST_DUE';

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS "TestDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TestCategory" NOT NULL DEFAULT 'ENDURANCE',
    "description" TEXT,
    "primaryUnit" TEXT NOT NULL,
    "secondaryUnit" TEXT,
    "direction" "MetricDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "calculationStrategy" TEXT NOT NULL DEFAULT 'YOYO_IR1',
    "defaultRetestDays" INTEGER DEFAULT 42,
    "instructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestSession" (
    "id" TEXT NOT NULL,
    "testDefinitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conductorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" "TestSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "TestResultStatus" NOT NULL DEFAULT 'VALID',
    "summaryScore" DOUBLE PRECISION,
    "secondaryScore" DOUBLE PRECISION,
    "primaryUnit" TEXT,
    "scoreDisplay" TEXT,
    "rank" INTEGER,
    "notes" TEXT,
    "isCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "correctedById" TEXT,
    "correctedAt" TIMESTAMP(3),
    "originalData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Measurement" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "unit" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- 3. Create Unique Constraints & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TestDefinition_code_key" ON "TestDefinition"("code");
CREATE INDEX IF NOT EXISTS "TestDefinition_category_idx" ON "TestDefinition"("category");
CREATE INDEX IF NOT EXISTS "TestDefinition_active_idx" ON "TestDefinition"("active");

CREATE INDEX IF NOT EXISTS "TestSession_teamId_idx" ON "TestSession"("teamId");
CREATE INDEX IF NOT EXISTS "TestSession_testDefinitionId_idx" ON "TestSession"("testDefinitionId");
CREATE INDEX IF NOT EXISTS "TestSession_date_idx" ON "TestSession"("date");
CREATE INDEX IF NOT EXISTS "TestSession_status_idx" ON "TestSession"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "TestResult_sessionId_playerId_key" ON "TestResult"("sessionId", "playerId");
CREATE INDEX IF NOT EXISTS "TestResult_playerId_idx" ON "TestResult"("playerId");
CREATE INDEX IF NOT EXISTS "TestResult_sessionId_idx" ON "TestResult"("sessionId");
CREATE INDEX IF NOT EXISTS "TestResult_summaryScore_idx" ON "TestResult"("summaryScore");

CREATE INDEX IF NOT EXISTS "Measurement_resultId_idx" ON "Measurement"("resultId");
CREATE INDEX IF NOT EXISTS "Measurement_key_idx" ON "Measurement"("key");

-- 4. Foreign Key Constraints (Safe conditional addition)
DO $$ BEGIN
    ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_testDefinitionId_fkey" FOREIGN KEY ("testDefinitionId") REFERENCES "TestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
