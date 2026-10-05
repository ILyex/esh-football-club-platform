CREATE TABLE "OpponentClub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "stadium" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentClub_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpponentClub_normalizedName_key" ON "OpponentClub"("normalizedName");
CREATE INDEX "OpponentClub_name_idx" ON "OpponentClub"("name");
