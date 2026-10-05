-- ============================================================================
-- ESH Football Club Platform — Phase 14 Migration: Physical Inventory & Equipment
-- ============================================================================
-- Migration: 20261002160000_phase14_inventory_and_equipment
-- Scope: Purely Additive (0 DROP statements, 0 destructive alterations)
-- ============================================================================

-- CreateEnum: InventoryCategory
DO $$ BEGIN
    CREATE TYPE "InventoryCategory" AS ENUM ('BALLS', 'KITS', 'CONES_MARKERS', 'GOALKEEPING', 'MEDICAL', 'TRAINING_AIDS', 'ELECTRONICS', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: InventoryCondition
DO $$ BEGIN
    CREATE TYPE "InventoryCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: InventoryItem
CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL DEFAULT 'OTHER',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "InventoryCondition" NOT NULL DEFAULT 'GOOD',
    "location" TEXT,
    "teamId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryItem_teamId_idx" ON "InventoryItem"("teamId");
CREATE INDEX IF NOT EXISTS "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX IF NOT EXISTS "InventoryItem_condition_idx" ON "InventoryItem"("condition");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
