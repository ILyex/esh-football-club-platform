import { db } from "@/lib/db";
import { getAccountBalances } from "./treasury-service";
import {
  DEBT_OVERDUE_DAYS,
  DEBT_CRITICAL_DAYS,
  classifyDebtSolvency,
  type DebtSolvencyRisk
} from "@/lib/insights/finance-rules";

export interface DebtItemDetail {
  id: string;
  referenceNumber: string;
  amount: number;
  description: string;
  payeeName: string | null;
  date: Date;
  ageDays: number;
  isOverdue: boolean;
  isCritical: boolean;
}

export interface ClubDebtSummary {
  hasDebt: boolean;
  debtAmount: number;
  unsettledExpensesCount: number;
  unsettledExpensesAmount: number;
  oldestDebtDays: number;
  overdueCount: number;
  overdueAmount: number;
  criticalOverdueCount: number;
  totalTreasuryBalance: number;
  treasuryLiquidity: number;
  solvencyRisk: DebtSolvencyRisk;
  coverageRatioPercent: number;
  debtItems: DebtItemDetail[];
}

/**
 * Calculates the comprehensive debt status and solvency health of the club.
 *
 * Operational debt logic:
 * 1. An expense represents active debt when:
 *    - Status is "POSTED"
 *    - Has not been settled via treasury withdrawal (`treasuryTransaction == null`)
 *    - Contains [DEBT] in notes OR has not been marked [SETTLED].
 * 2. Aging & Maturity:
 *    - Calculates ageDays from the expense date.
 *    - Flags debts older than 15 days as OVERDUE, and older than 30 days as CRITICAL OVERDUE.
 * 3. Solvency & Liquidity Coverage:
 *    - Computes total positive liquidity available across all club treasury accounts.
 *    - Compares liquid cash to total outstanding debt to identify deficits (insolvency risk)
 *      or strained operational reserves.
 */
export async function calculateClubDebtSummary(): Promise<ClubDebtSummary> {
  const now = new Date();

  const [expenses, treasuryAccounts] = await Promise.all([
    db.expense.findMany({
      where: {
        status: "POSTED"
      },
      select: {
        id: true,
        referenceNumber: true,
        amount: true,
        notes: true,
        description: true,
        payeeName: true,
        date: true,
        createdAt: true,
        treasuryTransaction: { select: { id: true, reversedBy: { select: { id: true } } } }
      },
      orderBy: { date: "asc" }
    }),
    db.treasuryAccount.findMany({
      where: { active: true },
      select: { id: true }
    })
  ]);

  const activeDebtExpenses = expenses.filter((e) => {
    const notes = e.notes || "";
    // Only a live ledger payment settles debt. A reversed payment reopens it.
    if (e.treasuryTransaction && !e.treasuryTransaction.reversedBy) return false;
    // Preserve legacy settled records, but never treat an unlinked cash transfer as payment.
    if (notes.includes("[SETTLED]")) return false;
    // If explicitly marked as debt or unpaid
    if (notes.includes("[DEBT]")) return true;
    return false;
  });

  const debtItems: DebtItemDetail[] = activeDebtExpenses.map((e) => {
    const expenseDate = e.date || e.createdAt;
    const ageDays = Math.max(0, Math.floor((now.getTime() - expenseDate.getTime()) / (24 * 3600 * 1000)));
    const isOverdue = ageDays >= DEBT_OVERDUE_DAYS;
    const isCritical = ageDays >= DEBT_CRITICAL_DAYS;

    return {
      id: e.id,
      referenceNumber: e.referenceNumber,
      amount: e.amount,
      description: e.description,
      payeeName: e.payeeName,
      date: expenseDate,
      ageDays,
      isOverdue,
      isCritical
    };
  });

  const debtAmount = debtItems.reduce((sum, item) => sum + item.amount, 0);
  const oldestDebtDays = debtItems.length > 0 ? Math.max(...debtItems.map((d) => d.ageDays)) : 0;
  const overdueItems = debtItems.filter((d) => d.isOverdue);
  const overdueCount = overdueItems.length;
  const overdueAmount = overdueItems.reduce((sum, item) => sum + item.amount, 0);
  const criticalOverdueCount = debtItems.filter((d) => d.isCritical).length;

  // Derive total available treasury liquidity across all active club accounts
  const accountBalances = await getAccountBalances(treasuryAccounts.map((a) => a.id));
  let totalTreasuryBalance = 0;
  let treasuryLiquidity = 0;
  for (const bal of accountBalances.values()) {
    totalTreasuryBalance += bal;
    if (bal > 0) treasuryLiquidity += bal;
  }

  const solvencyRisk = classifyDebtSolvency(treasuryLiquidity, debtAmount);
  const coverageRatioPercent =
    debtAmount > 0 ? Math.floor((treasuryLiquidity * 100) / debtAmount) : 100;

  return {
    hasDebt: debtAmount > 0,
    debtAmount,
    unsettledExpensesCount: debtItems.length,
    unsettledExpensesAmount: debtAmount,
    oldestDebtDays,
    overdueCount,
    overdueAmount,
    criticalOverdueCount,
    totalTreasuryBalance,
    treasuryLiquidity,
    solvencyRisk,
    coverageRatioPercent,
    debtItems
  };
}
