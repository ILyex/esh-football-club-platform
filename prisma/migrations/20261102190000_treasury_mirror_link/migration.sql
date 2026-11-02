-- Link the two ledger rows that represent one physical money movement:
-- a bank withdrawal that funds the cash box is stored as the bank WITHDRAWAL
-- plus an automatic CASH DEPOSIT. Without an explicit parent link, reversing
-- or deleting the withdrawal left the mirrored deposit in place and silently
-- created money. This column makes the pair reversible/deletable as a unit.

ALTER TABLE "TreasuryTransaction" ADD COLUMN IF NOT EXISTS "parentTransactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryTransaction_parentTransactionId_key"
  ON "TreasuryTransaction"("parentTransactionId");

CREATE INDEX IF NOT EXISTS "TreasuryTransaction_parentTransactionId_idx"
  ON "TreasuryTransaction"("parentTransactionId");

-- Backfill: every automatic cash mirror was written with the deterministic
-- idempotency key `auto-cash-<parentId>`, so existing pairs can be recovered
-- from it without guessing. Oldest parent per key wins; the guard keeps the
-- unique index safe on any duplicated legacy row.
UPDATE "TreasuryTransaction" AS mirror
SET "parentTransactionId" = substring(mirror."idempotencyKey" FROM '^auto-cash-(.+)$')
WHERE mirror."idempotencyKey" LIKE 'auto-cash-%'
  AND mirror."parentTransactionId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "TreasuryTransaction" AS parent
    WHERE parent."id" = substring(mirror."idempotencyKey" FROM '^auto-cash-(.+)$')
  );

ALTER TABLE "TreasuryTransaction"
  ADD CONSTRAINT "TreasuryTransaction_parentTransactionId_fkey"
  FOREIGN KEY ("parentTransactionId") REFERENCES "TreasuryTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
