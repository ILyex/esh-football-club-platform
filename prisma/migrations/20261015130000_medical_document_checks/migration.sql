CREATE TYPE "MedicalDocumentCheckStatus" AS ENUM ('QUEUED', 'CHECKED', 'NEEDS_REVIEW', 'UNAVAILABLE');

ALTER TABLE "PlayerMedicalRecord"
  ADD COLUMN "documentCheckStatus" "MedicalDocumentCheckStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "documentCheckFindings" JSONB,
  ADD COLUMN "documentCheckCompletedAt" TIMESTAMP(3);

-- Newly uploaded medical documents await explicit human approval.
UPDATE "Document" d
SET "status" = 'PENDING_REVIEW'
WHERE EXISTS (
  SELECT 1 FROM "PlayerMedicalRecord" r WHERE r."documentId" = d."id"
);