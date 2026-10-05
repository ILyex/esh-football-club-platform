import "server-only";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ForbiddenError, UnauthenticatedError } from "@/lib/permissions";

// ============================================================================
// FINANCE ACTION OUTCOME -> NOTICE KEY
// ----------------------------------------------------------------------------
// The finance server actions (budgets/expenses/treasury actions.ts) signal a
// rejected domain rule by throwing Error(<STABLE_CODE>) — never a raw DB error
// and never localized text. The pages that call them wrap the call with
// runFinanceAction(), turn a known code into a `?notice=finance.errors.<CODE>`
// redirect, and let the existing <NoticeToast> render the localized message.
//
// This is presentation only. It never decides whether something is allowed —
// the actions/services already enforced that before throwing.
// ============================================================================

/** Every rule code the finance actions/services can raise. Each has a matching finance.errors.* message in ar.json and fr.json. */
export const FINANCE_ERROR_CODES = [
  "INSUFFICIENT_FUNDS",
  "INVALID_AMOUNT",
  "INVALID_STATUS_TRANSITION",
  "DUPLICATE_TRANSACTION",
  "INVALID_TEAM_RELATION",
  "INVALID_SEASON",
  "BUDGET_CLOSED",
  "BUDGET_HAS_EXPENSES",
  "ACCOUNT_INACTIVE",
  "EXPENSE_NOT_FOUND",
  "EXPENSE_AMOUNT_MISMATCH",
  "INVALID_EXPENSE_LINK",
  "REVERSAL_OF_REVERSAL",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_UPDATE"
] as const;

const KNOWN_CODES = new Set<string>(FINANCE_ERROR_CODES);

export type FinanceActionResult<T> = { ok: true; value: T } | { ok: false; notice: string };

/**
 * Runs a finance action and converts an expected failure into a notice key.
 * Authentication/authorization failures are deliberately NOT swallowed — they
 * propagate so the framework's error handling (and the 401/403 semantics
 * behind it) stay in charge. Anything unrecognised also propagates rather
 * than being disguised as a friendly message.
 */
export async function runFinanceAction<T>(fn: () => Promise<T>): Promise<FinanceActionResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) throw error;
    if (error instanceof ZodError) return { ok: false, notice: "finance.errors.VALIDATION" };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, notice: "finance.errors.NOT_FOUND" };
    }
    if (error instanceof Error && KNOWN_CODES.has(error.message)) {
      return { ok: false, notice: `finance.errors.${error.message}` };
    }
    throw error;
  }
}

/** Appends `?notice=` (or `&notice=`) to an internal path. */
export function withNotice(path: string, notice: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`;
}
