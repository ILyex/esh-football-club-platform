CREATE TABLE "PrivateAsset" (
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateAsset_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PrivateAsset_createdAt_idx" ON "PrivateAsset"("createdAt");
