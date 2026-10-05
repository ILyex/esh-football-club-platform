-- ============================================================================
-- ESH Football Club Platform — P5 Migration: Background Jobs & Notifications
-- ============================================================================
-- Migration: 20261002000000_p5_background_jobs_and_notifications
-- Scope: Purely Additive (0 DROP statements, 0 destructive alterations)
-- ============================================================================

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'DEFAULT', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "JobPriority" NOT NULL DEFAULT 'DEFAULT',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "errorDetails" JSONB,
    "idempotencyKey" TEXT,
    "correlationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- AlterTable Notification: Add explicit team scoping and unique dedupKey
ALTER TABLE "Notification" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dedupKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_idempotencyKey_key" ON "BackgroundJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_scheduledAt_idx" ON "BackgroundJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_lockedUntil_idx" ON "BackgroundJob"("status", "lockedUntil");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_idx" ON "BackgroundJob"("type");

-- CreateIndex
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");

-- CreateIndex
CREATE INDEX "Notification_teamId_idx" ON "Notification"("teamId");
