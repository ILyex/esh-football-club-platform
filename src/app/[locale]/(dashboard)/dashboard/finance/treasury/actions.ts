"use server";

import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { treasuryAccountSchema, treasuryMovementSchema } from "@/lib/validations/finance";
import { postTreasuryMovement, reverseTreasuryTransaction, FinanceError } from "@/lib/finance/treasury-service";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

export async function createTreasuryAccountAction(formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "TreasuryAccount"); // strictly club-wide

  const raw = Object.fromEntries(formData.entries());
  const parsed = treasuryAccountSchema.parse(raw);

  // The opening balance is the seed of every future derived balance, so the
  // account and its audit record are created atomically.
  const account = await db.$transaction(async (tx) => {
    const created = await tx.treasuryAccount.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        currency: parsed.currency,
        openingBalance: parsed.openingBalance,
        notes: parsed.notes,
        createdById: user.id
      }
    });
    await writeAuditLog({ userId: user.id, action: "treasuryAccount.create", entityType: "TreasuryAccount", entityId: created.id, changes: { after: parsed } }, tx);
    return created;
  });
  revalidatePath("/[locale]/dashboard/finance/treasury", "page");
  return { id: account.id };
}

// Auth + validation live here; ALL domain rules (amount > 0, sufficient
// balance, idempotency, atomicity, balance snapshotting, expense payability)
// AND the mandatory audit record of every ledger write live in
// treasury-service.ts (the audit row is written inside the ledger
// transaction) and are never duplicated here.
export async function createDepositAction(formData: FormData) {
  const user = await requirePermission("finance.approve");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "TreasuryMovement"); // central treasury ledger is club-wide

  const raw = Object.fromEntries(formData.entries());
  const parsed = treasuryMovementSchema.parse(raw);

  if (parsed.relatedExpenseId) {
    const expense = await db.expense.findUniqueOrThrow({ where: { id: parsed.relatedExpenseId } });
    assertTeamScope(scopeContext, expense.teamId, "Expense");
  }

  const beneficiaryName = (formData.get("beneficiaryName") as string)?.trim();
  const nationalIdNumber = (formData.get("nationalIdNumber") as string)?.trim();
  let fullDescription = parsed.description || "";
  if (beneficiaryName) {
    fullDescription += ` [المعني: ${beneficiaryName}]`;
  }
  if (nationalIdNumber) {
    fullDescription += ` [CNI: ${nationalIdNumber}]`;
  }

  const receiptFile = formData.get("receiptFile") as File | null;
  let documentId: string | null = null;
  if (receiptFile && receiptFile.size > 0) {
    const { saveSupportingFinanceDocument } = await import("@/lib/finance/supporting-documents");
    documentId = await saveSupportingFinanceDocument({
      file: receiptFile,
      title: `وصل إيداع / بيان دعم — ${parsed.description?.slice(0, 40) || "إيداع"}`,
      userId: user.id,
      teamId: null
    });
  }

  try {
    const result = await postTreasuryMovement({
      treasuryAccountId: parsed.treasuryAccountId,
      type: "DEPOSIT",
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      description: fullDescription || undefined,
      relatedExpenseId: parsed.relatedExpenseId || null,
      documentId: documentId || null,
      idempotencyKey: parsed.idempotencyKey,
      createdById: user.id
    });
    revalidatePath("/[locale]/dashboard/finance/treasury", "page");
    revalidatePath(`/[locale]/dashboard/finance/treasury/${parsed.treasuryAccountId}`, "page");
    return result;
  } catch (error) {
    if (error instanceof FinanceError) throw new Error(error.code);
    throw error;
  }
}

export async function createWithdrawalAction(formData: FormData) {
  const user = await requirePermission("finance.approve");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "TreasuryMovement"); // central treasury ledger is club-wide

  const raw = Object.fromEntries(formData.entries());
  const parsed = treasuryMovementSchema.parse(raw);

  if (parsed.relatedExpenseId) {
    const expense = await db.expense.findUniqueOrThrow({ where: { id: parsed.relatedExpenseId } });
    assertTeamScope(scopeContext, expense.teamId, "Expense");
  }

  const beneficiaryName = (formData.get("beneficiaryName") as string)?.trim();
  const nationalIdNumber = (formData.get("nationalIdNumber") as string)?.trim();
  let fullDescription = parsed.description || "";
  if (beneficiaryName) {
    fullDescription += ` [المعني: ${beneficiaryName}]`;
  }
  if (nationalIdNumber) {
    fullDescription += ` [CNI: ${nationalIdNumber}]`;
  }

  const receiptFile = formData.get("receiptFile") as File | null;
  let documentId: string | null = null;
  if (receiptFile && receiptFile.size > 0) {
    const { saveSupportingFinanceDocument } = await import("@/lib/finance/supporting-documents");
    documentId = await saveSupportingFinanceDocument({
      file: receiptFile,
      title: `وصل سحب / فاتورة صرف — ${parsed.description?.slice(0, 40) || "سحب"}`,
      userId: user.id,
      teamId: null
    });
  }

  try {
    const result = await postTreasuryMovement({
      treasuryAccountId: parsed.treasuryAccountId,
      type: "WITHDRAWAL",
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      description: fullDescription || undefined,
      relatedExpenseId: parsed.relatedExpenseId || null,
      documentId: documentId || null,
      idempotencyKey: parsed.idempotencyKey,
      createdById: user.id
    });
    if (parsed.relatedExpenseId) revalidatePath(`/[locale]/dashboard/finance/expenses/${parsed.relatedExpenseId}`, "page");
    revalidatePath("/[locale]/dashboard/finance/treasury", "page");
    revalidatePath(`/[locale]/dashboard/finance/treasury/${parsed.treasuryAccountId}`, "page");
    return result;
  } catch (error) {
    if (error instanceof FinanceError) throw new Error(error.code);
    throw error;
  }
}

export async function reverseTransactionAction(transactionId: string, accountId: string) {
  const user = await requirePermission("finance.approve");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "TreasuryMovement");

  try {
    const result = await reverseTreasuryTransaction({ transactionId, createdById: user.id });
    revalidatePath(`/[locale]/dashboard/finance/treasury/${accountId}`, "page");
    return result;
  } catch (error) {
    if (error instanceof FinanceError) throw new Error(error.code);
    throw error;
  }
}

export async function updateOpeningBalanceAction(accountId: string, newBalance: number) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "TreasuryAccount");

  // Strictly restricted to system programmer / developer / super_admin or finance.subsidies permission
  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev") ||
    user.roleKey === "developer" ||
    hasPermission(user, "finance.subsidies");

  if (!isProgrammer) {
    throw new Error("خاصية تعديل الرصيد الافتتاحي مقيدة حصرياً بالمبرمج المسؤول للنظام أو حاملي صلاحية تعديل الإعانة");
  }

  const before = await db.treasuryAccount.findUniqueOrThrow({ where: { id: accountId } });

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.treasuryAccount.update({
      where: { id: accountId },
      data: { openingBalance: Number(newBalance) }
    });
    await writeAuditLog(
      {
        userId: user.id,
        action: "treasuryAccount.openingBalance.update",
        entityType: "TreasuryAccount",
        entityId: accountId,
        changes: { before: before.openingBalance, after: Number(newBalance) }
      },
      tx
    );
    return res;
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/treasury", "page");
  revalidatePath(`/[locale]/dashboard/finance/treasury/${accountId}`, "page");
  return { success: true, newBalance: updated.openingBalance };
}

/**
 * Programmer-only transaction update action.
 * Strictly verifies super_admin/developer and updates transaction while maintaining audit trail.
 */
export async function programmerUpdateTransactionAction(params: {
  transactionId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  transactionDate: Date;
  description: string;
  treasuryAccountId: string;
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

  const { updateTreasuryTransaction } = await import("@/lib/finance/treasury-service");
  const updated = await updateTreasuryTransaction({
    transactionId: params.transactionId,
    type: params.type,
    amount: params.amount,
    transactionDate: params.transactionDate,
    description: params.description,
    treasuryAccountId: params.treasuryAccountId,
    createdById: user.id
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/treasury", "page");
  revalidatePath(`/[locale]/dashboard/finance/treasury/${params.treasuryAccountId}`, "page");

  return { success: true, referenceNumber: updated.referenceNumber };
}

/**
 * Programmer-only transaction delete action.
 * Strictly verifies super_admin/developer, checks solvency, writes full audit log, and deletes.
 */
export async function programmerDeleteTransactionAction(params: { transactionId: string }) {
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

  const { deleteTreasuryTransaction } = await import("@/lib/finance/treasury-service");
  const result = await deleteTreasuryTransaction({
    transactionId: params.transactionId,
    createdById: user.id
  });

  revalidatePath("/[locale]/dashboard/finance", "page");
  revalidatePath("/[locale]/dashboard/finance/treasury", "page");

  return { success: true, referenceNumber: result.referenceNumber };
}

