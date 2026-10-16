CREATE TABLE "TacticalPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "formation" TEXT NOT NULL DEFAULT '4-3-3',
    "data" JSONB NOT NULL,
    "teamId" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TacticalPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TacticalPlan_teamId_updatedAt_idx" ON "TacticalPlan"("teamId", "updatedAt");
CREATE INDEX "TacticalPlan_creatorId_updatedAt_idx" ON "TacticalPlan"("creatorId", "updatedAt");

ALTER TABLE "TacticalPlan" ADD CONSTRAINT "TacticalPlan_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TacticalPlan" ADD CONSTRAINT "TacticalPlan_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
