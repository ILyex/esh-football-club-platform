export type FinanceReferenceType = "DEPOSIT" | "WITHDRAWAL" | "PAYMENT" | "REVERSAL";

const PREFIX_MAP: Record<FinanceReferenceType, string> = {
  WITHDRAWAL: "WITH",
  DEPOSIT: "DEP",
  PAYMENT: "PAY",
  REVERSAL: "REV"
};

/**
 * Generates standardized, official club finance reference numbers:
 * - WITH-YYYY-NNN-ESH (Withdrawal — سحب)
 * - DEP-YYYY-NNN-ESH (Deposit — إيداع)
 * - PAY-YYYY-NNN-ESH (Payment — صرف)
 * - REV-YYYY-NNN-ESH (Reversal — إلغاء/عكس)
 *
 * Requirements:
 * - Prefix: WITH (سحب), DEP (إيداع), PAY (صرف)
 * - Year: YYYY (e.g. 2026)
 * - Sequential number: NNN (001, 002, 003...)
 * - Resets to 001 every new calendar year (e.g. 2027 starts at 001).
 * - Suffix: -ESH (Espoir Sidi Hosni)
 */
export async function generateSequentialFinanceReference(
  tx: any,
  type: FinanceReferenceType,
  targetDate?: Date | string | null
): Promise<string> {
  const prefix = PREFIX_MAP[type];
  const dateObj = targetDate ? new Date(targetDate) : new Date();
  const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const patternPrefix = `${prefix}-${year}-`;
  const suffix = "-ESH";

  let existingRefs: string[] = [];
  try {
    if (type === "PAYMENT") {
      const rows = await tx.expense.findMany({
        where: {
          referenceNumber: {
            contains: patternPrefix
          }
        },
        select: { referenceNumber: true }
      });
      existingRefs = rows.map((r: { referenceNumber: string }) => r.referenceNumber);
    } else {
      const rows = await tx.treasuryTransaction.findMany({
        where: {
          referenceNumber: {
            contains: patternPrefix
          }
        },
        select: { referenceNumber: true }
      });
      existingRefs = rows.map((r: { referenceNumber: string }) => r.referenceNumber);
    }
  } catch (err) {
    console.warn("Could not query existing references for sequence:", err);
  }

  // Parse highest sequence number for this prefix & year
  // Matches WITH-2026-001-ESH or similar
  const regex = new RegExp(`^${prefix}-${year}-(\\d+)-ESH$`);
  let maxSeq = 0;
  for (const ref of existingRefs) {
    const match = ref.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqPadded = String(nextSeq).padStart(3, "0");
  return `${prefix}-${year}-${seqPadded}${suffix}`;
}
