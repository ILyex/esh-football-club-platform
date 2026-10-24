CREATE TABLE "PublicAppDevice" (
    "id" TEXT NOT NULL,
    "fcmToken" VARCHAR(512) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicAppDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicAppDevice_fcmToken_key" ON "PublicAppDevice"("fcmToken");
CREATE INDEX "PublicAppDevice_updatedAt_idx" ON "PublicAppDevice"("updatedAt");
