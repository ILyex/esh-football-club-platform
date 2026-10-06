CREATE TABLE "IntegrationState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationState_pkey" PRIMARY KEY ("key")
);
