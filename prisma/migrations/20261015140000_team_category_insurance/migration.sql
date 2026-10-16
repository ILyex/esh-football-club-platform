CREATE TYPE "TeamInsuranceCheckStatus" AS ENUM ('QUEUED', 'CHECKED', 'NEEDS_REVIEW', 'UNAVAILABLE');

CREATE TABLE "TeamInsurancePolicy" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "checkStatus" "TeamInsuranceCheckStatus" NOT NULL DEFAULT 'QUEUED',
    "checkFindings" JSONB NOT NULL DEFAULT '[]',
    "checkedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamInsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInsurancePolicy_documentId_key" ON "TeamInsurancePolicy"("documentId");
CREATE INDEX "TeamInsurancePolicy_teamId_startDate_endDate_idx" ON "TeamInsurancePolicy"("teamId", "startDate", "endDate");
CREATE INDEX "TeamInsurancePolicy_checkStatus_createdAt_idx" ON "TeamInsurancePolicy"("checkStatus", "createdAt");

ALTER TABLE "TeamInsurancePolicy" ADD CONSTRAINT "TeamInsurancePolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInsurancePolicy" ADD CONSTRAINT "TeamInsurancePolicy_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInsurancePolicy" ADD CONSTRAINT "TeamInsurancePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
