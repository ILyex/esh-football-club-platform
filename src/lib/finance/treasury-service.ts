import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { writeAuditLog } from "@/lib/audit";
import { MAX_SERIALIZATION_RETRIES, isSerializationConflict, isUniqueViolation } from "./transactions";
import { generateSequentialFinanceReference } from "./reference-sequence";

// ============================================================================
// TREASURY SERVICE
// ----------------------------------------------------------------------------
// This file is the ONLY place a TreasuryTransaction is ever created. No
// action, page, or other service writes to TreasuryTransaction directly —
// that's what makes "the ledger is authoritative" actually true rather than
// just documented.
//
// CONCURRENCY: there is no cached, independently-writable balance field on
// TreasuryAccount (see schema.prisma comment). A balance is always
// re-derived from the ledger. To prevent two concurrent withdrawals from
// both reading the same stale sum and both succeeding, postTreasuryMovement
// runs the whole read-validate-write sequence inside a Prisma interactive
// transaction pinned to SERIALIZABLE isolation. Under PostgreSQL,
// SERIALIZABLE guarantees the two concurrent transactions cannot both
// commit against an inconsistent view of the ledger — the database aborts
// one with a serialization failure, which this file catches and retries a
// bounded number of times. This is a real database-enforced guarantee, not
// merely "wrapped in a transaction."
//
// AUDIT: every ledger write also writes its audit record INSIDE the same
// transaction (writeAuditLog(..., tx)). A committed movement therefore always
// has its audit row, and a failed audit insert rolls the movement back — the
// callers (server actions) no longer write treasury audit rows themselves.
//
// IDEMPOTENCY: the idempotencyKey is unique in the database. A replay is only
// "the same request" if it matches the stored transaction on every financial
// parameter; the stored row is the fingerprint, so no extra column is needed.
// Reusing a key with different parameters is an explicit IDEMPOTENCY_CONFLICT,
// never a silent return of the earlier transaction.
// ============================================================================

export class FinanceError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "FinanceError";
  }
}

/** Computes an account's current balance from the ledger alone, using the given transaction client so the read is part of the same serializable snapshot as the write that follows it. */
async function computeBalance(tx: Prisma.TransactionClient, treasuryAccountId: string): Promise<number> {
  const account = await tx.treasuryAccount.findUniqueOrThrow({ where: { id: treasuryAccountId } });
  const [deposits, withdrawals] = await Promise.all([
    tx.treasuryTransaction.aggregate({ where: { treasuryAccountId, type: "DEPOSIT" }, _sum: { amount: true } }),
    tx.treasuryTransaction.aggregate({ where: { treasuryAccountId, type: "WITHDRAWAL" }, _sum: { amount: true } })
  ]);
  return account.openingBalance + (deposits._sum.amount ?? 0) - (withdrawals._sum.amount ?? 0);
}

export async function getAccountBalance(treasuryAccountId: string): Promise<number> {
  return computeBalance(db, treasuryAccountId);
}

/**
 * Read-only batch variant for list pages: derives every requested account's
 * balance from the ledger (openingBalance + Σ deposits − Σ withdrawals) in
 * two queries instead of two per account. Same formula as computeBalance —
 * there is still no stored balance anywhere.
 */
export async function getAccountBalances(treasuryAccountIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (treasuryAccountIds.length === 0) return balances;

  const [accounts, sums] = await Promise.all([
    db.treasuryAccount.findMany({ where: { id: { in: treasuryAccountIds } }, select: { id: true, openingBalance: true } }),
    db.treasuryTransaction.groupBy({
      by: ["treasuryAccountId", "type"],
      where: { treasuryAccountId: { in: treasuryAccountIds } },
      _sum: { amount: true }
    })
  ]);

  for (const account of accounts) balances.set(account.id, account.openingBalance);
  for (const row of sums) {
    const current = balances.get(row.treasuryAccountId) ?? 0;
    const amount = row._sum.amount ?? 0;
    balances.set(row.treasuryAccountId, row.type === "DEPOSIT" ? current + amount : current - amount);
  }
  return balances;
}

/**
 * An expense may only be paid by ONE real withdrawal, only once it is POSTED
 * (a DRAFT is not authoritative expenditure), and only for exactly its own
 * amount (partial/over-payment would need a payment model this project does
 * not have). Runs INSIDE the serializable transaction so the check and the
 * ledger write see the same snapshot — an expense cancelled or paid by a
 * concurrent request cannot slip between the check and the insert.
 */
async function assertExpensePayable(tx: Prisma.TransactionClient, expenseId: string, amount: number): Promise<void> {
  const expense = await tx.expense.findUnique({ where: { id: expenseId }, include: { treasuryTransaction: { select: { id: true } } } });
  if (!expense) throw new FinanceError("EXPENSE_NOT_FOUND");
  if (expense.status !== "POSTED") throw new FinanceError("INVALID_STATUS_TRANSITION", "Only a POSTED expense can be paid");
  if (expense.treasuryTransaction) throw new FinanceError("DUPLICATE_TRANSACTION", "This expense is already linked to a treasury transaction");
  if (expense.amount !== amount) throw new FinanceError("EXPENSE_AMOUNT_MISMATCH", "A payment must equal the expense amount");
}

function generateReferenceNumber(type: "DEPOSIT" | "WITHDRAWAL" | "REVERSAL"): string {
  const prefix = type === "DEPOSIT" ? "DEP" : type === "WITHDRAWAL" ? "WD" : "REV";
  const year = new Date().getFullYear();
  // nanoid, not a COUNT-based sequence — a sequential "count existing rows,
  // add one" scheme (used elsewhere in this app for non-financial reference
  // numbers) has a real race window under concurrent submissions; a random
  // collision-resistant suffix has none.
  return `${prefix}-${year}-${nanoid(8).toUpperCase()}`;
}

/** Keys of the form `reversal-<transactionId>` are generated by reverseTreasuryTransaction(); callers may not claim them. */
const RESERVED_KEY_PREFIX = "reversal-";

type StoredMovement = {
  id: string;
  referenceNumber: string;
  treasuryAccountId: string;
  type: string;
  amount: number;
  transactionDate: Date;
  description: string | null;
  relatedExpenseId: string | null;
  documentId: string | null;
  createdById: string;
};

/** True when a stored transaction is exactly what `params` would create — i.e. the request is a genuine replay. */
function isSameMovementRequest(stored: StoredMovement, params: PostMovementParams): boolean {
  return (
    stored.treasuryAccountId === params.treasuryAccountId &&
    stored.type === params.type &&
    stored.amount === params.amount &&
    stored.transactionDate.getTime() === params.transactionDate.getTime() &&
    (stored.description || null) === (params.description || null) &&
    (stored.relatedExpenseId || null) === (params.relatedExpenseId || null) &&
    (stored.documentId || null) === (params.documentId || null) &&
    stored.createdById === params.createdById
  );
}

function replayOrConflict(stored: StoredMovement, params: PostMovementParams): { id: string; referenceNumber: string; replayed: true } {
  if (!isSameMovementRequest(stored, params)) throw new FinanceError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request");
  return { id: stored.id, referenceNumber: stored.referenceNumber, replayed: true };
}

export interface PostMovementParams {
  treasuryAccountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number; // whole DZD, must be a positive integer — validated by the caller's zod schema AND re-checked here
  transactionDate: Date;
  description?: string;
  relatedExpenseId?: string | null;
  documentId?: string | null;
  idempotencyKey: string;
  createdById: string;
}

/**
 * Validates and posts a single ledger movement. Throws FinanceError with a
 * stable code (never a raw DB error) on any domain rule violation.
 */
export async function postTreasuryMovement(params: PostMovementParams): Promise<{ id: string; referenceNumber: string; replayed: boolean }> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new FinanceError("INVALID_AMOUNT");
  }
  // Only a withdrawal can settle an expense; a deposit is never "the payment
  // of an expense" — reject up front so it can't consume an expense's single
  // allowed ledger link.
  if (params.relatedExpenseId && params.type !== "WITHDRAWAL") {
    throw new FinanceError("INVALID_EXPENSE_LINK");
  }

  if (params.idempotencyKey.startsWith(RESERVED_KEY_PREFIX)) {
    throw new FinanceError("IDEMPOTENCY_CONFLICT", "This idempotency key prefix is reserved");
  }

  // Idempotency: a resubmission (double-click, network retry) carries the
  // SAME idempotencyKey. If a transaction with it already exists, it is
  // returned ONLY when it matches this request exactly (same account, type,
  // amount, date, description, expense link, document and author); a key
  // reused for anything else is a conflict. Checked outside the retry loop
  // since this alone doesn't need serializable isolation.
  const existing = await db.treasuryTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return replayOrConflict(existing, params);

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const account = await tx.treasuryAccount.findUniqueOrThrow({ where: { id: params.treasuryAccountId } });
          if (!account.active) throw new FinanceError("ACCOUNT_INACTIVE");

          // Prevents double-counting an expense (spec section 8/13) — schema
          // also enforces this with @unique on relatedExpenseId; checking
          // first gives a clean FinanceError instead of a raw constraint error.
          if (params.relatedExpenseId) {
            await assertExpensePayable(tx, params.relatedExpenseId, params.amount);
          }

          const balanceBefore = await computeBalance(tx, params.treasuryAccountId);
          const balanceAfter = params.type === "DEPOSIT" ? balanceBefore + params.amount : balanceBefore - params.amount;

          if (params.type === "WITHDRAWAL" && balanceAfter < 0) {
            // Default policy (spec section 7): no overdraft. Thrown inside the
            // transaction, which Prisma rolls back automatically.
            throw new FinanceError("INSUFFICIENT_FUNDS");
          }

          const refNumber = await generateSequentialFinanceReference(
            tx,
            params.type === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL",
            params.transactionDate
          );

          const transaction = await tx.treasuryTransaction.create({
            data: {
              referenceNumber: refNumber,
              idempotencyKey: params.idempotencyKey,
              treasuryAccountId: params.treasuryAccountId,
              type: params.type,
              amount: params.amount,
              transactionDate: params.transactionDate,
              description: params.description,
              balanceBefore,
              balanceAfter,
              relatedExpenseId: params.relatedExpenseId || null,
              documentId: params.documentId || null,
              createdById: params.createdById
            }
          });

          // Mandatory audit record, in the SAME transaction as the ledger row.
          await writeAuditLog(
            {
              userId: params.createdById,
              action: params.type === "DEPOSIT" ? "treasury.deposit" : "treasury.withdrawal",
              entityType: "TreasuryTransaction",
              entityId: transaction.id,
              changes: {
                after: {
                  referenceNumber: transaction.referenceNumber,
                  treasuryAccountId: params.treasuryAccountId,
                  amount: params.amount,
                  balanceBefore,
                  balanceAfter,
                  relatedExpenseId: params.relatedExpenseId || null
                }
              }
            },
            tx
          );
          // If a WITHDRAWAL was made from a BANK account (e.g. withdrawal for club cashbox/caisse)
          // and there is an active CASH account, automatically record the inflow into the CASH account
          // so the cash register is immediately funded as the user expects: "سحب من البنك -> يضاف في الصندوق"
          if (account.type === "BANK" && params.type === "WITHDRAWAL" && !params.relatedExpenseId) {
            const cashAccount = await tx.treasuryAccount.findFirst({
              where: { type: "CASH", active: true }
            });
            if (cashAccount && cashAccount.id !== params.treasuryAccountId) {
              const cashBefore = await computeBalance(tx, cashAccount.id);
              const cashAfter = cashBefore + params.amount;
              const cashRef = await generateSequentialFinanceReference(
                tx,
                "DEPOSIT",
                params.transactionDate
              );
              await tx.treasuryTransaction.create({
                data: {
                  referenceNumber: cashRef,
                  idempotencyKey: `auto-cash-${transaction.id}`,
                  treasuryAccountId: cashAccount.id,
                  type: "DEPOSIT",
                  amount: params.amount,
                  transactionDate: params.transactionDate,
                  description: `تموين الصندوق نقداً بسحب من ${account.name} (مرجع: ${refNumber})`,
                  balanceBefore: cashBefore,
                  balanceAfter: cashAfter,
                  documentId: params.documentId || null,
                  createdById: params.createdById
                }
              });
            }
          }

          return { id: transaction.id, referenceNumber: transaction.referenceNumber, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof FinanceError) throw error; // domain rejection — never retry, it will fail again
      if (isUniqueViolation(error)) {
        // A concurrent request won the race on a unique column. If it was
        // the same idempotency key, this is an idempotent replay when the
        // request matches (conflict otherwise); if the key is unknown the
        // collision was on the expense link — it was paid by someone else first.
        const replay = await db.treasuryTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
        if (replay) return replayOrConflict(replay, params);
        throw new FinanceError("DUPLICATE_TRANSACTION");
      }
      if (isSerializationConflict(error)) {
        if (attempt < MAX_SERIALIZATION_RETRIES - 1) continue; // genuine concurrent-write conflict — safe to retry with a fresh read
        throw new FinanceError("CONCURRENT_UPDATE", "Too many concurrent changes; please retry");
      }
      throw error;
    }
  }
  throw new FinanceError("CONCURRENT_UPDATE"); // unreachable: the loop always returns or throws
}

/**
 * Reverses a posted transaction by creating a new, opposite-direction entry
 * that references it — the original row is never modified (spec section
 * 10: "Original transaction must remain visible... Do not mutate historical
 * balances").
 */
export async function reverseTreasuryTransaction(params: { transactionId: string; createdById: string; description?: string }): Promise<{ id: string; referenceNumber: string }> {
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const original = await tx.treasuryTransaction.findUniqueOrThrow({ where: { id: params.transactionId } });

          // A reversal entry is itself a correction. Reversing it would
          // silently re-create the original movement without its expense
          // link — a chain of undo/redo entries. If money really must move
          // again, that is a NEW deposit/withdrawal, not a reversal.
          if (original.reversalOfTransactionId) throw new FinanceError("REVERSAL_OF_REVERSAL");

          const alreadyReversed = await tx.treasuryTransaction.findUnique({ where: { reversalOfTransactionId: original.id } });
          if (alreadyReversed) throw new FinanceError("DUPLICATE_TRANSACTION", "This transaction has already been reversed");

          const reversalType = original.type === "DEPOSIT" ? "WITHDRAWAL" : "DEPOSIT";
          const balanceBefore = await computeBalance(tx, original.treasuryAccountId);
          const balanceAfter = reversalType === "DEPOSIT" ? balanceBefore + original.amount : balanceBefore - original.amount;

          if (reversalType === "WITHDRAWAL" && balanceAfter < 0) {
            throw new FinanceError("INSUFFICIENT_FUNDS", "Reversing this deposit would leave the account negative");
          }

          const refNumber = await generateSequentialFinanceReference(
            tx,
            "REVERSAL",
            new Date()
          );

          const reversal = await tx.treasuryTransaction.create({
            data: {
              referenceNumber: refNumber,
              idempotencyKey: `reversal-${original.id}`,
              treasuryAccountId: original.treasuryAccountId,
              type: reversalType,
              amount: original.amount,
              transactionDate: new Date(),
              description: params.description ?? `Reversal of ${original.referenceNumber}`,
              balanceBefore,
              balanceAfter,
              reversalOfTransactionId: original.id,
              createdById: params.createdById
            }
          });
          await writeAuditLog(
            {
              userId: params.createdById,
              action: "treasury.reverse",
              entityType: "TreasuryTransaction",
              entityId: reversal.id,
              changes: {
                after: {
                  referenceNumber: reversal.referenceNumber,
                  reversalOfTransactionId: original.id,
                  treasuryAccountId: original.treasuryAccountId,
                  amount: original.amount,
                  balanceBefore,
                  balanceAfter
                }
              }
            },
            tx
          );
          return { id: reversal.id, referenceNumber: reversal.referenceNumber };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof FinanceError) throw error;
      if (isUniqueViolation(error)) throw new FinanceError("DUPLICATE_TRANSACTION", "This transaction has already been reversed");
      if (isSerializationConflict(error)) {
        if (attempt < MAX_SERIALIZATION_RETRIES - 1) continue;
        throw new FinanceError("CONCURRENT_UPDATE", "Too many concurrent changes; please retry");
      }
      throw error;
    }
  }
  throw new FinanceError("CONCURRENT_UPDATE"); // unreachable: the loop always returns or throws
}

export interface UpdateTransactionParams {
  transactionId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  transactionDate: Date;
  description: string;
  treasuryAccountId: string;
  createdById: string;
}

/**
 * Updates an existing transaction (restricted to programmer/super admin).
 * Validates solvency so an edited withdrawal does not leave account negative,
 * captures an exact audit log with before and after states, and maintains ledger consistency.
 */
export async function updateTreasuryTransaction(params: UpdateTransactionParams) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new FinanceError("INVALID_AMOUNT", "المبلغ يجب أن يكون رقماً صحيحاً وموجباً");
  }

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const original = await tx.treasuryTransaction.findUniqueOrThrow({
            where: { id: params.transactionId },
            include: { treasuryAccount: true }
          });

          const targetAccount = await tx.treasuryAccount.findUniqueOrThrow({
            where: { id: params.treasuryAccountId }
          });
          if (!targetAccount.active) throw new FinanceError("ACCOUNT_INACTIVE");

          // Calculate projected balance on the target account
          // First, get current balance
          let currentBalance = await computeBalance(tx, params.treasuryAccountId);
          // If transaction was already in this account, undo its previous effect
          if (original.treasuryAccountId === params.treasuryAccountId) {
            currentBalance = original.type === "DEPOSIT"
              ? currentBalance - original.amount
              : currentBalance + original.amount;
          }

          const projectedBalance = params.type === "DEPOSIT"
            ? currentBalance + params.amount
            : currentBalance - params.amount;

          if (params.type === "WITHDRAWAL" && projectedBalance < 0) {
            throw new FinanceError("INSUFFICIENT_FUNDS", "الرصيد غير كافٍ لإجراء هذه العملية المالية بعد التعديل");
          }

          // If moving between accounts, ensure source account doesn't become negative if it was a deposit
          if (original.treasuryAccountId !== params.treasuryAccountId && original.type === "DEPOSIT") {
            const sourceBalance = await computeBalance(tx, original.treasuryAccountId);
            if (sourceBalance - original.amount < 0) {
              throw new FinanceError("INSUFFICIENT_FUNDS", "نقل هذا الإيداع سيجعل رصيد الحساب الأصلي سالباً");
            }
          }

          const transactionLedger = (tx as any)["treasuryTransaction"];
          const updated = await transactionLedger.update({
            where: { id: params.transactionId },
            data: {
              type: params.type,
              amount: params.amount,
              transactionDate: params.transactionDate,
              description: params.description,
              treasuryAccountId: params.treasuryAccountId,
              balanceBefore: currentBalance,
              balanceAfter: projectedBalance
            }
          });

          await writeAuditLog(
            {
              userId: params.createdById,
              action: "treasury.update",
              entityType: "TreasuryTransaction",
              entityId: updated.id,
              changes: {
                before: {
                  type: original.type,
                  amount: original.amount,
                  transactionDate: original.transactionDate,
                  description: original.description,
                  treasuryAccountId: original.treasuryAccountId,
                  referenceNumber: original.referenceNumber
                },
                after: {
                  type: params.type,
                  amount: params.amount,
                  transactionDate: params.transactionDate,
                  description: params.description,
                  treasuryAccountId: params.treasuryAccountId,
                  referenceNumber: updated.referenceNumber
                }
              }
            },
            tx
          );

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof FinanceError) throw error;
      if (isSerializationConflict(error)) {
        if (attempt < MAX_SERIALIZATION_RETRIES - 1) continue;
        throw new FinanceError("CONCURRENT_UPDATE", "حدث تعارض أثناء تعديل العملية؛ يرجى إعادة المحاولة");
      }
      throw error;
    }
  }
  throw new FinanceError("CONCURRENT_UPDATE");
}

/**
 * Helper to unlink an expense from a treasury transaction inside a transaction.
 */
export async function unlinkExpenseFromLedger(expenseId: string, tx: any) {
  const transactionLedger = (tx as any)["treasuryTransaction"];
  await transactionLedger.updateMany({
    where: { relatedExpenseId: expenseId },
    data: { relatedExpenseId: null }
  });
}

/**
 * Deletes a treasury transaction (restricted strictly to programmer/super admin).
 * Validates that deleting a deposit does not render the treasury account negative,
 * records a full pre-deletion audit trail, and deletes the row safely.
 */
export async function deleteTreasuryTransaction(params: { transactionId: string; createdById: string }) {
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const original = await tx.treasuryTransaction.findUniqueOrThrow({
            where: { id: params.transactionId },
            include: { treasuryAccount: true, relatedExpense: true }
          });

          // If deleting a DEPOSIT, verify account balance remains non-negative
          if (original.type === "DEPOSIT") {
            const currentBal = await computeBalance(tx, original.treasuryAccountId);
            if (currentBal - original.amount < 0) {
              throw new FinanceError("INSUFFICIENT_FUNDS", "لا يمكن حذف هذا الإيداع لأن الرصيد الحالي لا يكفي (سيصبح الحساب مكشوفاً)");
            }
          }

          // Full audit log written BEFORE or concurrently with deletion inside same serializable transaction
          await writeAuditLog(
            {
              userId: params.createdById,
              action: "treasury.delete",
              entityType: "TreasuryTransaction",
              entityId: original.id,
              changes: {
                deletedRecord: {
                  id: original.id,
                  referenceNumber: original.referenceNumber,
                  type: original.type,
                  amount: original.amount,
                  transactionDate: original.transactionDate,
                  description: original.description,
                  treasuryAccountId: original.treasuryAccountId,
                  accountName: original.treasuryAccount.name,
                  relatedExpenseId: original.relatedExpenseId,
                  relatedExpenseRef: original.relatedExpense?.referenceNumber
                },
                reason: "حذف العملية المالية بواسطة المبرمج"
              }
            },
            tx
          );

          // If linked to an expense, decouple first
          if (original.relatedExpenseId) {
            await tx.expense.update({
              where: { id: original.relatedExpenseId },
              data: { notes: "[DEBT] ديون غير مسددة" }
            });
          }

          const transactionLedger = (tx as any)["treasuryTransaction"];
          await transactionLedger.delete({
            where: { id: params.transactionId }
          });

          return { success: true, referenceNumber: original.referenceNumber };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof FinanceError) throw error;
      if (isSerializationConflict(error)) {
        if (attempt < MAX_SERIALIZATION_RETRIES - 1) continue;
        throw new FinanceError("CONCURRENT_UPDATE", "حدث تعارض أثناء حذف العملية؛ يرجى إعادة المحاولة");
      }
      throw error;
    }
  }
  throw new FinanceError("CONCURRENT_UPDATE");
}

export interface DashboardFinancialTrendRow {
  month: Date;
  type: string;
  total: number;
}

export async function queryMonthlyFinancialTrend(startIso: string): Promise<DashboardFinancialTrendRow[]> {
  return db.$queryRaw<DashboardFinancialTrendRow[]>`
    SELECT
      date_trunc('month', "createdAt") AS "month",
      "type"::text AS "type",
      SUM("amount")::double precision AS "total"
    FROM "TreasuryTransaction"
    WHERE "createdAt" >= ${new Date(startIso)}
    GROUP BY date_trunc('month', "createdAt"), "type"
    ORDER BY date_trunc('month', "createdAt") ASC
  `;
}
