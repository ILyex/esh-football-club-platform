import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, store, reset, faults } from "../mocks/db";
import { session } from "../mocks/auth";
import { postTreasuryMovement, reverseTreasuryTransaction, getAccountBalance, FinanceError } from "@/lib/finance/treasury-service";
import { runFinanceAction } from "@/lib/finance/action-notice";
import { createExpenseAction, updateExpenseAction, postExpenseAction, cancelExpenseAction } from "@/app/[locale]/(dashboard)/dashboard/finance/expenses/actions";
import { createBudgetAction, updateBudgetAction } from "@/app/[locale]/(dashboard)/dashboard/finance/budgets/actions";
import { createWithdrawalAction, createDepositAction, reverseTransactionAction, createTreasuryAccountAction } from "@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions";

let k = 0;
const key = () => `key-${++k}`;
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [a, b] of Object.entries(o)) f.set(a, b); return f; };
const code = (p: Promise<any>) => p.then(() => "OK", (e) => (e instanceof FinanceError ? e.code : e?.message ?? String(e)));
const mv = (o: any = {}) => ({ treasuryAccountId: "acc1", type: "WITHDRAWAL" as const, amount: 100, transactionDate: new Date("2026-09-01T00:00:00Z"), idempotencyKey: key(), createdById: "u1", ...o });
const audits = (action?: string) => store.auditLog!.filter((a) => !action || a.action === action);

beforeEach(() => {
  reset(); faults.auditCreate = false;
  session.user.permissions = ["*"];
  store.treasuryAccount!.push({ id: "acc1", name: "Caisse", type: "CASH", currency: "DZD", openingBalance: 1000, active: true });
  store.treasuryAccount!.push({ id: "acc2", name: "Banque", type: "BANK", currency: "DZD", openingBalance: 1000, active: true });
});

// ------------------------------------------------------------ idempotency
test("idempotency: same key + same request replays (replayed=true, one row, one audit)", async () => {
  const p = mv({ idempotencyKey: "K", amount: 250, description: "x" });
  const a = await postTreasuryMovement(p);
  const b = await postTreasuryMovement({ ...p });
  assert.equal(a.replayed, false); assert.equal(b.replayed, true); assert.equal(a.id, b.id);
  assert.equal(store.treasuryTransaction!.length, 1);
  assert.equal(audits("treasury.withdrawal").length, 1, "replay must not write a second audit row");
});
test("idempotency: same key + different amount / account / type / date / description / author => IDEMPOTENCY_CONFLICT", async () => {
  await postTreasuryMovement(mv({ idempotencyKey: "K", amount: 250, description: "x" }));
  const base = { idempotencyKey: "K", amount: 250, description: "x" };
  for (const diff of [{ amount: 251 }, { treasuryAccountId: "acc2" }, { type: "DEPOSIT" as const }, { transactionDate: new Date("2026-09-02T00:00:00Z") }, { description: "y" }, { createdById: "u2" }]) {
    assert.equal(await code(postTreasuryMovement(mv({ ...base, ...diff }))), "IDEMPOTENCY_CONFLICT", JSON.stringify(diff));
  }
  assert.equal(store.treasuryTransaction!.length, 1);
});
test("idempotency: concurrent same key + same request => one row; concurrent same key + different amount => one OK, one conflict", async () => {
  const same = await Promise.all([postTreasuryMovement(mv({ idempotencyKey: "S" })), postTreasuryMovement(mv({ idempotencyKey: "S" }))]);
  assert.equal(same[0].id, same[1].id);
  assert.equal(store.treasuryTransaction!.length, 1);
  const diff = await Promise.all([postTreasuryMovement(mv({ idempotencyKey: "D", amount: 10 })), postTreasuryMovement(mv({ idempotencyKey: "D", amount: 20 }))].map(code));
  assert.deepEqual(diff.sort(), ["IDEMPOTENCY_CONFLICT", "OK"]);
  assert.equal(store.treasuryTransaction!.length, 2);
});
test("idempotency: reserved reversal-* keys cannot be claimed by callers (would block a reversal)", async () => {
  assert.equal(await code(postTreasuryMovement(mv({ idempotencyKey: "reversal-abc" }))), "IDEMPOTENCY_CONFLICT");
});
test("concurrent different keys on one account: no overdraft, final balance = ledger sum", async () => {
  const results = await Promise.all([700, 700, 300].map((amount) => code(postTreasuryMovement(mv({ amount })))));
  assert.equal(results.filter((r) => r === "OK").length, 2); // 700 + 300 fit; the second 700 does not
  assert.ok((await getAccountBalance("acc1")) >= 0);
  const rows = store.treasuryTransaction!;
  assert.equal(await getAccountBalance("acc1"), 1000 - rows.reduce((s, r) => s + r.amount, 0));
});
test("concurrent deposit and withdrawal: both land, snapshots chain, balance correct", async () => {
  await Promise.all([postTreasuryMovement(mv({ type: "DEPOSIT", amount: 300 })), postTreasuryMovement(mv({ amount: 1200 }))].map(code));
  const rows = store.treasuryTransaction!;
  // whichever order the database serialized them in, every snapshot must chain from the previous one
  let running = 1000;
  for (const r of rows) { assert.equal(r.balanceBefore, running); running = r.type === "DEPOSIT" ? running + r.amount : running - r.amount; assert.equal(r.balanceAfter, running); }
  assert.equal(await getAccountBalance("acc1"), running);
  assert.ok(running >= 0);
});

// ------------------------------------------------------------ audit atomicity (treasury)
test("treasury: audit row is written in the same transaction (deposit, withdrawal, reversal)", async () => {
  const d = await postTreasuryMovement(mv({ type: "DEPOSIT", amount: 50 }));
  const w = await postTreasuryMovement(mv({ amount: 70 }));
  const r = await reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" });
  assert.deepEqual(audits().map((a) => [a.action, a.entityId]), [["treasury.deposit", d.id], ["treasury.withdrawal", w.id], ["treasury.reverse", r.id]]);
});
test("treasury: if the audit insert fails, the ledger write is rolled back (no unaudited money movement)", async () => {
  faults.auditCreate = true;
  await assert.rejects(postTreasuryMovement(mv({ amount: 100 })), /audit insert failed/);
  assert.equal(store.treasuryTransaction!.length, 0);
  assert.equal(await getAccountBalance("acc1"), 1000);
  faults.auditCreate = false;
  const w = await postTreasuryMovement(mv({ amount: 100 }));
  faults.auditCreate = true;
  await assert.rejects(reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" }), /audit insert failed/);
  assert.equal(store.treasuryTransaction!.length, 1);
  assert.equal(await getAccountBalance("acc1"), 900);
});

// ------------------------------------------------------------ expense actions (real action code, fake DB)
const expenseForm = (o: Record<string, string> = {}) => fd({ amount: "500", category: "FOOD", date: "2026-09-01", description: "Repas", seasonId: "s1", ...o });
const seedBudget = (o: any = {}) => store.budget!.push({ id: "b1", seasonId: "s1", teamId: null, status: "ACTIVE", allocatedAmount: 10000, category: null, ...o });

test("expense create: writes expense + audit atomically; audit failure rolls the expense back", async () => {
  const { id } = await createExpenseAction(expenseForm());
  assert.equal(store.expense!.length, 1);
  assert.deepEqual(audits().map((a) => [a.action, a.entityId]), [["expense.create", id]]);
  faults.auditCreate = true;
  await assert.rejects(createExpenseAction(expenseForm()), /audit insert failed/);
  assert.equal(store.expense!.length, 1, "no expense without its audit row");
});
test("expense create: budget consistency (season, team scope, closed) enforced inside the transaction; club-wide budget accepts any team", async () => {
  seedBudget({ id: "b-season", seasonId: "sX" });
  seedBudget({ id: "b-team", teamId: "t1" });
  seedBudget({ id: "b-closed", status: "CLOSED" });
  seedBudget({ id: "b-club" });
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-season" }))), "INVALID_SEASON");
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-team", teamId: "t2" }))), "INVALID_TEAM_RELATION");
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-team" }))), "INVALID_TEAM_RELATION"); // club-wide expense into a team budget
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-closed" }))), "BUDGET_CLOSED");
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-team", teamId: "t1" }))), "OK");
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId: "b-club", teamId: "t9" }))), "OK");
  assert.equal(store.expense!.length, 2);
});
test("expense lifecycle: post once, POSTED is immutable, cancel blocked by live payment, allowed after reversal", async () => {
  const { id } = await createExpenseAction(expenseForm());
  assert.equal(await code(updateExpenseAction(id, expenseForm({ amount: "600" }))), "OK");
  assert.equal(store.expense![0]!.amount, 600);
  await postExpenseAction(id);
  assert.equal(await code(postExpenseAction(id)), "INVALID_STATUS_TRANSITION");
  assert.equal(await code(updateExpenseAction(id, expenseForm({ amount: "999" }))), "INVALID_STATUS_TRANSITION");
  assert.equal(store.expense![0]!.amount, 600);
  const pay = await createWithdrawalAction(fd({ treasuryAccountId: "acc1", amount: "600", transactionDate: "2026-09-02", idempotencyKey: key(), relatedExpenseId: id }));
  assert.equal(await code(cancelExpenseAction(id)), "INVALID_STATUS_TRANSITION");
  await reverseTransactionAction(pay.id, "acc1");
  assert.equal(await code(cancelExpenseAction(id)), "OK");
  assert.equal(store.expense![0]!.status, "CANCELLED");
  // every step audited
  assert.deepEqual(audits().map((a) => a.action), ["expense.create", "expense.update", "expense.post", "treasury.withdrawal", "treasury.reverse", "expense.cancel"]);
  // cancelled expense cannot be paid again, and a cancelled one cannot be cancelled twice
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: id, amount: 600 }))), "INVALID_STATUS_TRANSITION");
  assert.equal(await code(cancelExpenseAction(id)), "INVALID_STATUS_TRANSITION");
});
test("expense cancel: failing audit rolls the status change back", async () => {
  const { id } = await createExpenseAction(expenseForm());
  faults.auditCreate = true;
  await assert.rejects(cancelExpenseAction(id), /audit insert failed/);
  assert.equal(store.expense![0]!.status, "DRAFT");
});
test("expense pay flow through the real action: amount fixed to the expense, wrong amount rejected", async () => {
  const { id } = await createExpenseAction(expenseForm());
  await postExpenseAction(id);
  const bad = await runFinanceAction(() => createWithdrawalAction(fd({ treasuryAccountId: "acc1", amount: "499", transactionDate: "2026-09-02", idempotencyKey: key(), relatedExpenseId: id })));
  assert.deepEqual(bad, { ok: false, notice: "finance.errors.EXPENSE_AMOUNT_MISMATCH" });
  const dep = await runFinanceAction(() => createDepositAction(fd({ treasuryAccountId: "acc1", amount: "500", transactionDate: "2026-09-02", idempotencyKey: key(), relatedExpenseId: id })));
  assert.deepEqual(dep, { ok: false, notice: "finance.errors.INVALID_EXPENSE_LINK" });
});

// ------------------------------------------------------------ budget actions
const budgetForm = (o: Record<string, string> = {}) => fd({ seasonId: "s1", allocatedAmount: "10000", status: "ACTIVE", ...o });
test("budget update: season/team frozen once expenses are linked; allocation may drop below spend (documented decision)", async () => {
  const { id: budgetId } = await createBudgetAction(budgetForm());
  const { id: expenseId } = await createExpenseAction(expenseForm({ budgetId, amount: "800" }));
  await postExpenseAction(expenseId);
  assert.equal(await code(updateBudgetAction(budgetId, budgetForm({ seasonId: "s2" }))), "BUDGET_HAS_EXPENSES");
  assert.equal(await code(updateBudgetAction(budgetId, budgetForm({ teamId: "t1" }))), "BUDGET_HAS_EXPENSES");
  assert.equal(await code(updateBudgetAction(budgetId, budgetForm({ allocatedAmount: "100" }))), "OK"); // below the 800 already posted
  assert.equal(store.budget![0]!.allocatedAmount, 100);
  assert.equal(await code(updateBudgetAction(budgetId, budgetForm({ allocatedAmount: "100", status: "CLOSED" }))), "OK");
  assert.equal(await code(createExpenseAction(expenseForm({ budgetId }))), "BUDGET_CLOSED");
  assert.deepEqual(audits().filter((a) => a.action.startsWith("budget")).map((a) => a.action), ["budget.create", "budget.update", "budget.update"]);
});
test("budget update: season/team may change while no expense is linked", async () => {
  const { id } = await createBudgetAction(budgetForm());
  assert.equal(await code(updateBudgetAction(id, budgetForm({ seasonId: "s2", teamId: "t1" }))), "OK");
});

// ------------------------------------------------------------ treasury account + permission gating of actions
test("treasury account creation is audited atomically; DZD only; permissions enforced inside every action", async () => {
  const { id } = await createTreasuryAccountAction(fd({ name: "Nouvelle", type: "CASH", openingBalance: "500" }));
  assert.equal(audits("treasuryAccount.create")[0]!.entityId, id);
  await assert.rejects(createTreasuryAccountAction(fd({ name: "X", type: "CASH", openingBalance: "5", currency: "EUR" })));
  session.user.permissions = ["finance.view"];
  for (const call of [
    () => createTreasuryAccountAction(fd({ name: "X", type: "CASH", openingBalance: "5" })),
    () => createDepositAction(fd({ treasuryAccountId: "acc1", amount: "5", transactionDate: "2026-09-01", idempotencyKey: key() })),
    () => createWithdrawalAction(fd({ treasuryAccountId: "acc1", amount: "5", transactionDate: "2026-09-01", idempotencyKey: key() })),
    () => reverseTransactionAction("x", "acc1"),
    () => createExpenseAction(expenseForm()),
    () => postExpenseAction("x"),
    () => cancelExpenseAction("x"),
    () => createBudgetAction(budgetForm()),
    () => updateBudgetAction("x", budgetForm())
  ]) await assert.rejects(call(), /Forbidden/);
  session.user.permissions = ["finance.manage"]; // manage != approve: cannot post/pay/reverse
  for (const call of [() => postExpenseAction("x"), () => cancelExpenseAction("x"), () => createDepositAction(fd({ treasuryAccountId: "acc1", amount: "5", transactionDate: "2026-09-01", idempotencyKey: key() })), () => reverseTransactionAction("x", "acc1")])
    await assert.rejects(call(), /Forbidden/);
  assert.equal(store.treasuryTransaction!.length, 0);
});
test("runFinanceAction lets authorization errors propagate and maps known codes only", async () => {
  session.user.permissions = [];
  await assert.rejects(runFinanceAction(() => postExpenseAction("x")), /Forbidden/);
  assert.deepEqual(await runFinanceAction(async () => { throw new Error("CONCURRENT_UPDATE"); }), { ok: false, notice: "finance.errors.CONCURRENT_UPDATE" });
  await assert.rejects(runFinanceAction(async () => { throw new Error("something unexpected"); }), /something unexpected/);
});

// ------------------------------------------------------------ serialization-conflict policy
test("serialization conflicts: transient ones are retried; persistent ones surface the stable CONCURRENT_UPDATE code (never a raw DB error)", async () => {
  const { PrismaClientKnownRequestError } = await import("../mocks/prisma-client");
  const original = db.$transaction;
  try {
    let failures = 2;
    db.$transaction = (fn: any, o: any) => (failures-- > 0 ? Promise.reject(new PrismaClientKnownRequestError("conflict", { code: "P2034" })) : original(fn, o));
    assert.equal(await code(postTreasuryMovement(mv({ amount: 10 }))), "OK", "2 conflicts then success");
    assert.equal(store.treasuryTransaction!.length, 1);
    db.$transaction = () => Promise.reject(new PrismaClientKnownRequestError("conflict", { code: "P2034" }));
    assert.equal(await code(postTreasuryMovement(mv({ amount: 10 }))), "CONCURRENT_UPDATE");
    assert.equal(await code(reverseTreasuryTransaction({ transactionId: store.treasuryTransaction![0]!.id, createdById: "u1" })), "CONCURRENT_UPDATE");
    // the expense/budget transactions use the same policy and map to the same notice
    assert.equal(await code(createExpenseAction(expenseForm())), "CONCURRENT_UPDATE");
    assert.deepEqual(await runFinanceAction(() => postExpenseAction("x")), { ok: false, notice: "finance.errors.CONCURRENT_UPDATE" });
    assert.equal(store.treasuryTransaction!.length, 1);
  } finally { db.$transaction = original; }
});
