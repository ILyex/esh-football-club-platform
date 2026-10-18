CREATE TABLE "NativePushDevice" (
    "id" TEXT NOT NULL,
    "fcmToken" VARCHAR(512) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NativePushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativePushDevice_fcmToken_key" ON "NativePushDevice"("fcmToken");
CREATE INDEX "NativePushDevice_userId_idx" ON "NativePushDevice"("userId");

ALTER TABLE "NativePushDevice"
ADD CONSTRAINT "NativePushDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NativeSession" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NativeSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativeSession_tokenHash_key" ON "NativeSession"("tokenHash");
CREATE INDEX "NativeSession_userId_expiresAt_idx" ON "NativeSession"("userId", "expiresAt");

ALTER TABLE "NativeSession"
ADD CONSTRAINT "NativeSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
