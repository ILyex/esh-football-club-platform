-- ============================================================================
-- ESH Football Club Platform — Phase 11 Migration: Official Gmail Integration
-- ============================================================================
-- Migration: 20261002120000_phase11_gmail_integration
-- Scope: Purely Additive (0 DROP statements, 0 destructive alterations)
-- ============================================================================

-- CreateEnum
CREATE TYPE "GmailConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'REVOKED');

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/gmail.modify',
    "status" "GmailConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastHistoryId" TEXT,
    "lastError" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_emailAddress_key" ON "GmailConnection"("emailAddress");
