ALTER TABLE "Staff"
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "bloodGroup" TEXT,
  ADD COLUMN "accountRoleId" TEXT;

CREATE INDEX "Staff_accountRoleId_idx" ON "Staff"("accountRoleId");

ALTER TABLE "Staff"
  ADD CONSTRAINT "Staff_accountRoleId_fkey"
  FOREIGN KEY ("accountRoleId") REFERENCES "Role"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
