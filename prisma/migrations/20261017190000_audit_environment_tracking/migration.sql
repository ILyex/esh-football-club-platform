-- Separate security and audit metrics from previews and local development.
-- Historical rows are deliberately unknown; they cannot be safely attributed.
ALTER TABLE "AuditLog"
ADD COLUMN "deploymentEnvironment" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "AuditLog_deploymentEnvironment_createdAt_idx"
ON "AuditLog"("deploymentEnvironment", "createdAt");
