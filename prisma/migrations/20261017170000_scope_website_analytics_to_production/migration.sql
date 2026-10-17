-- Mark existing events as unknown: before this migration, preview and local
-- traffic could not be distinguished from the live site and must not be
-- presented as verified production analytics.
ALTER TABLE "WebsiteAnalyticsEvent"
ADD COLUMN "deploymentEnvironment" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "WebsiteAnalyticsEvent_deploymentEnvironment_createdAt_type_idx"
ON "WebsiteAnalyticsEvent"("deploymentEnvironment", "createdAt", "type");
