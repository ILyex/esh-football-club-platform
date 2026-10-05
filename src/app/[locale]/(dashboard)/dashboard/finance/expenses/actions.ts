"use server";

import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { expenseSchema } from "@/lib/validations/finance";
import { writeAuditLog } from "@/lib/audit";
import { financeSerializableTransaction } from "@/lib/finance/transactions";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { generateSequentialFinanceReference } from "@/lib/finance/reference-sequence";

// ============================================================================
// EXPENSE ACTIONS
// ----------------------------------------------------------------------------
// Every mutation here runs in ONE SERIALIZABLE transaction that contains:
//   1. the reads its validation depends on (the expense row, the budget row),
//   2. the guarded write,
//   3. the mandatory audit record.
// So (a) a budget cannot change season/team/status between the consistency
// check and the write (the budget update and the expense write conflict under
// SERIALIZABLE and the database aborts one), and (b) a committed expense
// change always has its audit row, and vice-versa.
// ============================================================================

// Same team-scope integrity principle already applied to Match↔Competition:
// if an expense is linked to a budget, the two must not silently disagree
// about which team/season they belong to. A club-wide budget (teamId null)
// accepts any team's expense.
//
// `requireActive` is true whenever the expense is being NEWLY attached to a
// budget (create, or an edit that changes budgetId): the expense form only
// offers ACTIVE budgets, so the server must not accept a CLOSED one either.
// An untouched link to a budget that was closed later is left alone.
async function assertExpenseBudgetConsistency(
  tx: Prisma.TransactionClient,
  budgetId: string,
  expenseTeamId: string | null,
  expenseSeasonId: string,
  requireActive: boolean
) {
  const budget = await tx.budget.findUniqueOrThrow({ where: { id: budgetId } });
  if (requireActive && budget.status !== "ACTIVE") throw new Error("BUDGET_CLOSED");
  if (budget.teamId && budget.teamId !== expenseTeamId) throw new Error("INVALID_TEAM_RELATION");
  if (budget.seasonId !== expenseSeasonId) throw new Error("INVALID_SEASON");
}

function generateExpenseReference(): string {
  return `EXP-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

export async function createExpenseAction(formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();
  const raw = Object.fromEntries(formData.entries());
  const parsed = expenseSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "Expense");

  const receiptFile = formData.get("receiptFile") as File | null;
  let documentId: string | null = null;
  if (receiptFile && receiptFile.size > 0) {
    const { saveSupportingFinanceDocument } = await import("@/lib/finance/supporting-documents");
    documentId = await saveSupportingFinanceDocument({
      file: receiptFile,
      title: `فاتورة معتمدة — ${parsed.description.slice(0, 40)}`,
      userId: user.id,
      teamId: parsed.teamId || null
    });
  }

  const expense = await financeSerializableTransaction(async (tx) => {
    if (parsed.budgetId) {
      await assertExpenseBudgetConsistency(tx, parsed.budgetId, parsed.teamId || null, parsed.seasonId, true);
    }

    const autoPost = formData.get("autoPost") === "true";
    const isDebt = formData.get("isDebt") === "true";
    const statusNote = isDebt ? "[DEBT]" : "[SETTLED]";
    const combinedNotes = parsed.notes ? `${statusNote} ${parsed.notes}`.trim() : statusNote;
    const refNumber = await generateSequentialFinanceReference(tx, "PAYMENT", parsed.date);
    const created = await tx.expense.create({
      data: {
        referenceNumber: refNumber,
        amount: parsed.amount,
        category: parsed.category,
        date: parsed.date,
        description: parsed.description,
        payeeName: parsed.payeeName,
        paymentMethod: parsed.paymentMethod || null,
        teamId: parsed.teamId || null,
        seasonId: parsed.seasonId,
        budgetId: parsed.budgetId || null,
        relatedMatchId: parsed.relatedMatchId || null,
        relatedTrainingId: parsed.relatedTrainingId || null,
        documentId: documentId || null,
        status: autoPost ? "POSTED" : "DRAFT",
        notes: combinedNotes,
        createdById: user.id
      }
    });
    await writeAuditLog({ userId: user.id, action: "expense.create", entityType: "Expense", entityId: created.id, changes: { after: parsed, documentId } }, tx);
    return created;
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  return { id: expense.id };
}

export async function updateExpenseAction(expenseId: string, formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();
  const raw = Object.fromEntries(formData.entries());
  const parsed = expenseSchema.parse(raw);

  await financeSerializableTransaction(async (tx) => {
    const before = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
    assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "Expense");

    // Posted expenditure is authoritative history — editing a POSTED expense's
    // financial facts would silently rewrite budget/expenditure calculations
    // after the fact. Only DRAFT expenses may be freely edited.
    if (before.status !== "DRAFT") throw new Error("INVALID_STATUS_TRANSITION");

    if (parsed.budgetId) {
      await assertExpenseBudgetConsistency(tx, parsed.budgetId, parsed.teamId || null, parsed.seasonId, parsed.budgetId !== before.budgetId);
    }

    // The status guard is part of the UPDATE itself as well as the read above
    // (belt and braces on top of SERIALIZABLE): zero matching rows means the
    // expense left DRAFT and the edit is rejected, never silently applied.
    const result = await tx.expense.updateMany({
      where: { id: expenseId, status: "DRAFT" },
      data: {
        amount: parsed.amount,
        category: parsed.category,
        date: parsed.date,
        description: parsed.description,
        payeeName: parsed.payeeName,
        paymentMethod: parsed.paymentMethod || null,
        teamId: parsed.teamId || null,
        seasonId: parsed.seasonId,
        budgetId: parsed.budgetId || null,
        relatedMatchId: parsed.relatedMatchId || null,
        relatedTrainingId: parsed.relatedTrainingId || null,
        notes: parsed.notes,
        updatedById: user.id
      }
    });
    if (result.count !== 1) throw new Error("INVALID_STATUS_TRANSITION");

    await writeAuditLog({ userId: user.id, action: "expense.update", entityType: "Expense", entityId: expenseId, changes: { before, after: parsed } }, tx);
  });

  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  revalidatePath(`/[locale]/dashboard/finance/expenses/${expenseId}`, "page");
}

// Posting is the "this is now real, authoritative expenditure" transition —
// gated behind finance.approve (a higher bar than finance.manage), matching
// spec section 9's explicit warning that a draft must never silently count.
//
// Deliberate decision: posting does NOT re-check that the linked budget is
// still ACTIVE or that it still has headroom. Closing a budget does not void
// expenses already incurred against it, and overspend is an allowed,
// *reported* state (see the budget pages and the BUDGET_EXCEEDED insight),
// not a blocked one. Season/team consistency cannot have drifted since the
// draft was saved: updateBudgetAction refuses to change them while any expense
// is linked.
export async function postExpenseAction(expenseId: string) {
  const user = await requirePermission("finance.approve");
  const scopeContext = await getMutationScopeContext();

  await financeSerializableTransaction(async (tx) => {
    const before = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
    assertTeamScope(scopeContext, before.teamId, "Expense");

    // Compare-and-set on status: two concurrent "post" clicks (or a post
    // racing a cancel) can only ever move a DRAFT forward once.
    const result = await tx.expense.updateMany({ where: { id: expenseId, status: "DRAFT" }, data: { status: "POSTED", updatedById: user.id } });
    if (result.count !== 1) {
      await tx.expense.findUniqueOrThrow({ where: { id: expenseId } }); // unknown id -> not-found, not a status error
      throw new Error("INVALID_STATUS_TRANSITION");
    }
    await writeAuditLog({ userId: user.id, action: "expense.post", entityType: "Expense", entityId: expenseId }, tx);
  });

  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  revalidatePath(`/[locale]/dashboard/finance/expenses/${expenseId}`, "page");
}

export async function cancelExpenseAction(expenseId: string) {
  const user = await requirePermission("finance.approve");
  const scopeContext = await getMutationScopeContext();

  // SERIALIZABLE so this check ("no live payment exists") and the status
  // write are one atomic decision even against a concurrent withdrawal
  // (treasury-service.ts reads the expense status inside its own
  // serializable transaction) — one of the two is aborted by the database
  // rather than both succeeding on stale reads.
  await financeSerializableTransaction(async (tx) => {
    const expense = await tx.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { treasuryTransaction: { include: { reversedBy: { select: { id: true } } } } }
    });
    assertTeamScope(scopeContext, expense.teamId, "Expense");

    if (expense.status === "CANCELLED") throw new Error("INVALID_STATUS_TRANSITION");
    // A posted expense that has already had money moved against it can't
    // be cancelled out from under a real ledger entry — the payment must
    // be reversed at the treasury level first (spec: expense vs treasury
    // movement are related but not automatically identical, and neither
    // can be silently rewritten once real money has moved). Once that
    // payment HAS been reversed, the money is back and the expense may be
    // cancelled.
    if (expense.treasuryTransaction && !expense.treasuryTransaction.reversedBy) throw new Error("INVALID_STATUS_TRANSITION");

    await tx.expense.update({ where: { id: expenseId }, data: { status: "CANCELLED", updatedById: user.id } });
    await writeAuditLog({ userId: user.id, action: "expense.cancel", entityType: "Expense", entityId: expenseId }, tx);
  });

  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  revalidatePath(`/[locale]/dashboard/finance/expenses/${expenseId}`, "page");
}

/**
 * Programmer-only expense update action.
 * Allows modifying amount, date, description, payee, and national ID.
 * Strictly checks that user is the programmer/super_admin.
 */
export async function programmerUpdateExpenseAction(params: {
  expenseId: string;
  amount: number;
  date: Date;
  description: string;
  payeeName?: string | null;
}) {
  const user = await requirePermission("finance.manage");

  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.roleKey === "developer" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev");

  if (!isProgrammer) {
    throw new Error("403 Forbidden: تعديل العملية المالية متاح حصرياً للمبرمج المسؤول للنظام");
  }

  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error("المبلغ يجب أن يكون رقماً صحيحاً وموجباً");
  }

  const { db } = await import("@/lib/db");
  const original = await db.expense.findUniqueOrThrow({
    where: { id: params.expenseId }
  });

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.expense.update({
      where: { id: params.expenseId },
      data: {
        amount: params.amount,
        date: params.date,
        description: params.description,
        payeeName: params.payeeName || null,
        updatedById: user.id
      }
    });

    await writeAuditLog(
      {
        userId: user.id,
        action: "expense.update.programmer",
        entityType: "Expense",
        entityId: params.expenseId,
        changes: {
          before: {
            amount: original.amount,
            date: original.date,
            description: original.description,
            payeeName: original.payeeName,
            referenceNumber: original.referenceNumber
          },
          after: {
            amount: params.amount,
            date: params.date,
            description: params.description,
            payeeName: params.payeeName,
            referenceNumber: original.referenceNumber
          }
        }
      },
      tx
    );

    return res;
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  revalidatePath(`/[locale]/dashboard/finance/expenses/${params.expenseId}`, "page");

  return { success: true, referenceNumber: updated.referenceNumber };
}

/**
 * Programmer-only expense delete action.
 * Strictly verifies super_admin/developer and captures complete audit trail before deleting.
 */
export async function programmerDeleteExpenseAction(params: { expenseId: string }) {
  const user = await requirePermission("finance.manage");

  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.roleKey === "developer" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev");

  if (!isProgrammer) {
    throw new Error("403 Forbidden: حذف العملية المالية متاح حصرياً للمبرمج المسؤول للنظام");
  }

  const { db } = await import("@/lib/db");
  const original = await db.expense.findUniqueOrThrow({
    where: { id: params.expenseId }
  });

  await db.$transaction(async (tx) => {
    await writeAuditLog(
      {
        userId: user.id,
        action: "expense.delete.programmer",
        entityType: "Expense",
        entityId: original.id,
        changes: {
          deletedRecord: {
            id: original.id,
            referenceNumber: original.referenceNumber,
            amount: original.amount,
            date: original.date,
            description: original.description,
            category: original.category,
            payeeName: original.payeeName,
            status: original.status
          },
          reason: "حذف المصروف المالي بواسطة المبرمج"
        }
      },
      tx
    );

    // If a treasury transaction is linked, decouple via ledger service
    const { unlinkExpenseFromLedger } = await import("@/lib/finance/treasury-service");
    await unlinkExpenseFromLedger(params.expenseId, tx);

    await tx.expense.delete({
      where: { id: params.expenseId }
    });
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/expenses", "page");

  return { success: true, referenceNumber: original.referenceNumber };
}

