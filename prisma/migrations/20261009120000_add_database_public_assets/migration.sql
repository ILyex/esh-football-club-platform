CREATE TABLE "PublicAsset" (
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicAsset_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PublicAsset_createdAt_idx" ON "PublicAsset"("createdAt");
