CREATE TABLE "WebsiteAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "targetPath" TEXT,
    "visitorKey" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteAnalyticsEvent_createdAt_type_idx" ON "WebsiteAnalyticsEvent"("createdAt", "type");
CREATE INDEX "WebsiteAnalyticsEvent_path_createdAt_type_idx" ON "WebsiteAnalyticsEvent"("path", "createdAt", "type");
CREATE INDEX "WebsiteAnalyticsEvent_visitorKey_createdAt_idx" ON "WebsiteAnalyticsEvent"("visitorKey", "createdAt");
