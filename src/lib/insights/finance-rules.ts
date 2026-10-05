// ============================================================================
// FINANCE INSIGHT RULES — pure, deterministic classification helpers
// ----------------------------------------------------------------------------
// No database access and no "server-only" import on purpose: the thresholds
// and predicates that decide a finance insight live here as plain functions of
// plain integers, so they are trivially testable and cannot depend on AI,
// on the clock (except where a `now` is passed in) or on floating-point
// arithmetic. lib/insights/rules.ts feeds these with real Prisma data and
// turns the outcome into Insight objects — this file never builds one.
// ============================================================================

/** A budget is "nearing exhaustion" once POSTED spend reaches this share of the allocation (inclusive). */
export const BUDGET_NEARING_EXHAUSTION_PERCENT = 90;

/** A DRAFT expense that has waited this many days for a decision is escalated from info to warning. */
export const DRAFT_EXPENSE_ESCALATION_DAYS = 7;

export type BudgetUtilization = "EXCEEDED" | "NEARING_EXHAUSTION" | null;

/**
 * Classifies a budget by its POSTED spend. Integer arithmetic only:
 * `spent * 100 >= allocated * 90` avoids dividing (and so any rounding
 * question) for the threshold comparison. A non-positive allocation is
 * never classified — validation forbids it, and it would make "percent"
 * meaningless.
 */
export function classifyBudgetUtilization(allocatedAmount: number, postedSpent: number): BudgetUtilization {
  if (!Number.isInteger(allocatedAmount) || !Number.isInteger(postedSpent) || allocatedAmount <= 0) return null;
  if (postedSpent > allocatedAmount) return "EXCEEDED";
  if (postedSpent * 100 >= allocatedAmount * BUDGET_NEARING_EXHAUSTION_PERCENT) return "NEARING_EXHAUSTION";
  return null;
}

/** Whole-number percentage of the allocation consumed (floor). Only meaningful for allocatedAmount > 0. */
export function budgetUtilizationPercent(allocatedAmount: number, postedSpent: number): number {
  if (allocatedAmount <= 0) return 0;
  return Math.floor((postedSpent * 100) / allocatedAmount);
}

export type DraftExpenseSeverity = "info" | "warning";

/** Severity of the "expense awaiting a decision" insight from how long the draft has existed. */
export function draftExpenseSeverity(createdAt: Date, now: Date): DraftExpenseSeverity {
  const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 3600 * 1000));
  return ageDays >= DRAFT_EXPENSE_ESCALATION_DAYS ? "warning" : "info";
}

/** Whole days a draft has existed (floor, never negative). */
export function draftExpenseAgeDays(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (24 * 3600 * 1000)));
}

/**
 * An expense linked to a budget must agree with it on season, and on team
 * whenever the budget is team-scoped (a club-wide budget, teamId null,
 * accepts any team). These are exactly the rules the expense actions enforce
 * at write time — this predicate re-checks them against stored data so a
 * later edit (or a direct DB change) cannot leave a silent disagreement.
 */
export function expenseDisagreesWithBudget(
  expense: { seasonId: string; teamId: string | null },
  budget: { seasonId: string; teamId: string | null }
): boolean {
  if (expense.seasonId !== budget.seasonId) return true;
  if (budget.teamId !== null && budget.teamId !== expense.teamId) return true;
  return false;
}

/**
 * Expense <-> ledger status invariants:
 *  - a linked payment may only exist on a POSTED expense (payment requires POSTED)
 *  - a CANCELLED expense may keep a payment only if that payment was reversed
 *  - a linked payment must equal the expense amount
 * Returns the first violated rule, or null when the pair is consistent.
 */
export type ExpensePaymentIssue = "PAYMENT_ON_NON_POSTED" | "CANCELLED_WITH_LIVE_PAYMENT" | "AMOUNT_MISMATCH";

export function expensePaymentIssue(
  expense: { status: "DRAFT" | "POSTED" | "CANCELLED"; amount: number },
  payment: { amount: number; isReversed: boolean } | null
): ExpensePaymentIssue | null {
  if (!payment) return null;
  if (expense.status === "DRAFT") return "PAYMENT_ON_NON_POSTED";
  if (expense.status === "CANCELLED" && !payment.isReversed) return "CANCELLED_WITH_LIVE_PAYMENT";
  if (expense.amount !== payment.amount) return "AMOUNT_MISMATCH";
  return null;
}

/** A debt that has not been settled within this many days is considered overdue. */
export const DEBT_OVERDUE_DAYS = 15;

/** A debt that has not been settled within this many days is considered critical overdue. */
export const DEBT_CRITICAL_DAYS = 30;

export type DebtSolvencyRisk = "DEFICIT" | "STRAINED" | "HEALTHY";

/**
 * Classifies the solvency risk of the club based on available treasury liquidity
 * versus total outstanding debt. Integer-safe arithmetic.
 */
export function classifyDebtSolvency(treasuryLiquidity: number, totalDebt: number): DebtSolvencyRisk {
  if (totalDebt <= 0) return "HEALTHY";
  if (treasuryLiquidity < totalDebt) return "DEFICIT";
  if (totalDebt * 2 >= treasuryLiquidity) return "STRAINED";
  return "HEALTHY";
}

/**
 * Classifies the operational severity of club debt:
 * - "critical" if the club has a liquidity deficit to cover debts OR debt is overdue >= 30 days.
 * - "warning" if debt exists and is active within manageable thresholds.
 */
export function classifyDebtSeverity(
  solvencyRisk: DebtSolvencyRisk,
  oldestDebtDays: number
): "critical" | "warning" {
  if (solvencyRisk === "DEFICIT" || oldestDebtDays >= DEBT_CRITICAL_DAYS) {
    return "critical";
  }
  return "warning";
}

