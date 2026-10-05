"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { budgetSchema } from "@/lib/validations/finance";
import { writeAuditLog } from "@/lib/audit";
import { financeSerializableTransaction } from "@/lib/finance/transactions";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

export async function createBudgetAction(formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = budgetSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "Budget");

  const budget = await db.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        seasonId: parsed.seasonId,
        teamId: parsed.teamId || null,
        category: parsed.category || null,
        allocatedAmount: parsed.allocatedAmount,
        status: parsed.status,
        notes: parsed.notes,
        createdById: user.id
      }
    });
    await writeAuditLog({ userId: user.id, action: "budget.create", entityType: "Budget", entityId: created.id, changes: { after: parsed } }, tx);
    return created;
  });
  revalidatePath("/[locale]/dashboard/finance/budgets", "page");
  return { id: budget.id };
}

// DECISION (budget allocation vs posted expenditure): lowering a budget's
// allocation below what has already been posted against it is ALLOWED. A
// budget is a plan, not a ledger; posting an expense over budget is likewise
// allowed (nothing blocks it), and overspend is a *reported* state — the
// budget pages render a negative "remaining" in red with an explicit
// "exceeded" notice, and the BUDGET_EXCEEDED insight/notification fires. What
// is NOT allowed is anything that would break expense↔budget consistency:
// changing season/team while expenses are linked (below).
export async function updateBudgetAction(budgetId: string, formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = budgetSchema.parse(raw);
  const nextTeamId = parsed.teamId || null;

  await financeSerializableTransaction(async (tx) => {
    const before = await tx.budget.findUniqueOrThrow({ where: { id: budgetId } });
    assertDualTeamScope(scopeContext, before.teamId, nextTeamId, "Budget");

    // Expenses were validated against this budget's season/team when they were
    // linked (expenses/actions.ts). Re-pointing the budget at a different
    // season or team afterwards would silently break that consistency for
    // every linked expense, so it is refused once any expense references it.
    // The count and the update share one SERIALIZABLE transaction with the
    // expense create/update transactions, so an expense being attached at this
    // very moment conflicts with this write and one of the two is aborted.
    if (before.seasonId !== parsed.seasonId || before.teamId !== nextTeamId) {
      const linkedExpenses = await tx.expense.count({ where: { budgetId } });
      if (linkedExpenses > 0) throw new Error("BUDGET_HAS_EXPENSES");
    }

    const budget = await tx.budget.update({
      where: { id: budgetId },
      data: {
        seasonId: parsed.seasonId,
        teamId: nextTeamId,
        category: parsed.category || null,
        allocatedAmount: parsed.allocatedAmount,
        status: parsed.status,
        notes: parsed.notes
      }
    });

    await writeAuditLog({ userId: user.id, action: "budget.update", entityType: "Budget", entityId: budget.id, changes: { before, after: parsed } }, tx);
  });

  revalidatePath("/[locale]/dashboard/finance/budgets", "page");
  revalidatePath(`/[locale]/dashboard/finance/budgets/${budgetId}`, "page");
}
