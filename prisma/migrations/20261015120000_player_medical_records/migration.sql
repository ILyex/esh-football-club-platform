CREATE TYPE "PlayerMedicalRecordType" AS ENUM (
  'INSURANCE_POLICY', 'MEDICAL_CLEARANCE', 'ANTI_DOPING_CONSENT', 'DRUG_TEST_RESULT', 'LAB_ANALYSIS', 'OTHER'
);

CREATE TYPE "PlayerMedicalStatus" AS ENUM (
  'PENDING', 'FIT', 'TEMPORARILY_UNFIT', 'UNFIT', 'NOT_APPLICABLE'
);
CREATE TYPE "PlayerConsentAuthority" AS ENUM ('PLAYER', 'LEGAL_GUARDIAN');

CREATE TABLE "PlayerMedicalRecord" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "documentId" TEXT,
  "type" "PlayerMedicalRecordType" NOT NULL,
  "title" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "PlayerMedicalStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "consentAuthority" "PlayerConsentAuthority",
  "consentAuthorityName" TEXT,
  "consentRecordedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerMedicalRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerMedicalRecord_documentId_key" ON "PlayerMedicalRecord"("documentId");
CREATE INDEX "PlayerMedicalRecord_playerId_type_expiresAt_idx" ON "PlayerMedicalRecord"("playerId", "type", "expiresAt");
CREATE INDEX "PlayerMedicalRecord_type_status_idx" ON "PlayerMedicalRecord"("type", "status");

ALTER TABLE "PlayerMedicalRecord" ADD CONSTRAINT "PlayerMedicalRecord_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerMedicalRecord" ADD CONSTRAINT "PlayerMedicalRecord_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerMedicalRecord" ADD CONSTRAINT "PlayerMedicalRecord_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "group", "description")
VALUES
  ('medical_records_view', 'medical.records.view', 'medical', 'View confidential per-player medical records'),
  ('medical_records_manage', 'medical.records.manage', 'medical', 'Upload and manage confidential per-player medical records')
ON CONFLICT ("key") DO NOTHING;

-- Preserve existing per-player insurance and anti-doping files while moving
-- their classification into the dedicated medical-record access boundary.
INSERT INTO "PlayerMedicalRecord" (
  "id", "playerId", "documentId", "type", "title", "issuedAt", "expiresAt", "status", "createdById", "createdAt", "updatedAt"
)
SELECT
  'med_' || d."id",
  d."relatedPlayerId",
  d."id",
  CASE
    WHEN d."description" ILIKE '%"insurance"%'
      OR d."name" ILIKE '%تأمين%' OR d."name" ILIKE '%insurance%' OR d."name" ILIKE '%assurance%'
    THEN 'INSURANCE_POLICY'::"PlayerMedicalRecordType"
    ELSE 'ANTI_DOPING_CONSENT'::"PlayerMedicalRecordType"
  END,
  d."name",
  CASE
    WHEN d."description" ~ '"startDate"\s*:\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"'
      THEN to_date(substring(d."description" from '"startDate"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"'), 'YYYY-MM-DD')::timestamp
    ELSE d."documentDate"
  END,
  CASE
    WHEN d."description" ~ '"endDate"\s*:\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"'
      THEN to_date(substring(d."description" from '"endDate"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"'), 'YYYY-MM-DD')::timestamp + INTERVAL '1 day' - INTERVAL '1 millisecond'
    ELSE NULL
  END,
  'PENDING'::"PlayerMedicalStatus",
  d."uploadedById",
  d."createdAt",
  CURRENT_TIMESTAMP
FROM "Document" d
WHERE d."relatedPlayerId" IS NOT NULL
  AND (
    d."name" ILIKE '%مخدرات%' OR d."name" ILIKE '%drug%' OR d."name" ILIKE '%dopage%'
    OR d."name" ILIKE '%تأمين%' OR d."name" ILIKE '%insurance%' OR d."name" ILIKE '%assurance%'
    OR d."description" ILIKE '%"insurance"%'
  )
ON CONFLICT ("documentId") DO NOTHING;

-- Medical documents can no longer be seen via generic document permissions.
UPDATE "Document" d
SET "classification" = 'RESTRICTED'
WHERE EXISTS (
  SELECT 1 FROM "PlayerMedicalRecord" r WHERE r."documentId" = d."id"
);
