import { test } from "node:test";
import assert from "node:assert/strict";
import { db, store, reset } from "../mocks/db";
import {
  postTreasuryMovement, reverseTreasuryTransaction, getAccountBalance, getAccountBalances, FinanceError
} from "@/lib/finance/treasury-service";
import {
  classifyBudgetUtilization, budgetUtilizationPercent, draftExpenseSeverity, expenseDisagreesWithBudget, expensePaymentIssue
} from "@/lib/insights/finance-rules";
import { expenseSchema, treasuryMovementSchema, treasuryAccountSchema, budgetSchema } from "@/lib/validations/finance";
import {
  RESOLVER_REGISTRY, applyMappings, formatWholeAmount, isReceiptEligible, isExpenseStatementEligible,
  requireResolverPermission, readPermissionForEntityType, forbiddenGeneratedEntityTypes, FinancialDocumentError
} from "@/lib/documents/entity-data-resolvers";
import { filterInsightsForUser } from "@/lib/insights/rules";

const OPEN = { id: "acc1", name: "Caisse", type: "CASH", currency: "DZD", openingBalance: 1000, active: true };
function seed() {
  reset();
  store.treasuryAccount!.push({ ...OPEN });
  store.clubSettings!.push({ id: "singleton", name: "Espoir Sidi Hosni", shortName: "ESH" });
}
let k = 0;
const key = () => `k${++k}`;
const mv = (o: any = {}) => ({ treasuryAccountId: "acc1", type: "WITHDRAWAL" as const, amount: 100, transactionDate: new Date("2026-09-01T00:00:00Z"), idempotencyKey: key(), createdById: "u1", ...o });
const code = (p: Promise<any>) => p.then(() => "OK", (e) => (e instanceof FinanceError ? e.code : `RAW:${e?.message}`));

test("balance is derived: opening + deposits - withdrawals", async () => {
  seed();
  await postTreasuryMovement(mv({ type: "DEPOSIT", amount: 500 }));
  await postTreasuryMovement(mv({ amount: 300 }));
  assert.equal(await getAccountBalance("acc1"), 1200);
  assert.equal((await getAccountBalances(["acc1"])).get("acc1"), 1200);
});

test("invalid amounts are rejected (0, negative, decimal, NaN)", async () => {
  seed();
  for (const amount of [0, -5, 1.5, NaN]) assert.equal(await code(postTreasuryMovement(mv({ amount }))), "INVALID_AMOUNT");
  assert.equal(store.treasuryTransaction!.length, 0);
});

test("insufficient funds blocked; balance unchanged; no negative balance", async () => {
  seed();
  assert.equal(await code(postTreasuryMovement(mv({ amount: 1001 }))), "INSUFFICIENT_FUNDS");
  assert.equal(await getAccountBalance("acc1"), 1000);
  assert.equal(await code(postTreasuryMovement(mv({ amount: 1000 }))), "OK");
  assert.equal(await getAccountBalance("acc1"), 0);
});

test("two concurrent withdrawals cannot both pass the sufficiency check", async () => {
  seed();
  const results = await Promise.all([postTreasuryMovement(mv({ amount: 800 })), postTreasuryMovement(mv({ amount: 800 }))].map(code));
  assert.deepEqual(results.sort(), ["INSUFFICIENT_FUNDS", "OK"]);
  assert.equal(await getAccountBalance("acc1"), 200);
});

test("idempotency: same key twice (sequential and concurrent) posts once", async () => {
  seed();
  const a = await postTreasuryMovement(mv({ idempotencyKey: "same", amount: 100 }));
  const b = await postTreasuryMovement(mv({ idempotencyKey: "same", amount: 100 }));
  assert.equal(a.id, b.id);
  const [c, d] = await Promise.all([postTreasuryMovement(mv({ idempotencyKey: "same2", amount: 50 })), postTreasuryMovement(mv({ idempotencyKey: "same2", amount: 50 }))]);
  assert.equal(c.id, d.id);
  assert.equal(store.treasuryTransaction!.length, 2);
  assert.equal(await getAccountBalance("acc1"), 850);
});

test("balanceBefore/After snapshots form a consistent chain", async () => {
  seed();
  await postTreasuryMovement(mv({ type: "DEPOSIT", amount: 500 }));
  await postTreasuryMovement(mv({ amount: 300 }));
  const rows = store.treasuryTransaction!;
  assert.deepEqual(rows.map((r) => [r.balanceBefore, r.balanceAfter]), [[1000, 1500], [1500, 1200]]);
});

test("expense payment: only POSTED, exactly its amount, only once, only by withdrawal", async () => {
  seed();
  store.expense!.push({ id: "e-draft", status: "DRAFT", amount: 100 }, { id: "e-posted", status: "POSTED", amount: 100 }, { id: "e-cancelled", status: "CANCELLED", amount: 100 });
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-draft" }))), "INVALID_STATUS_TRANSITION");
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-cancelled" }))), "INVALID_STATUS_TRANSITION");
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-missing" }))), "EXPENSE_NOT_FOUND");
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-posted", amount: 99 }))), "EXPENSE_AMOUNT_MISMATCH");
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-posted", type: "DEPOSIT" }))), "INVALID_EXPENSE_LINK");
  assert.equal(store.treasuryTransaction!.length, 0);
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-posted" }))), "OK");
  assert.equal(await code(postTreasuryMovement(mv({ relatedExpenseId: "e-posted" }))), "DUPLICATE_TRANSACTION"); // new idempotency key — still no double payment
  assert.equal(store.treasuryTransaction!.length, 1);
});

test("concurrent payments of the same expense with different keys: exactly one lands", async () => {
  seed();
  store.expense!.push({ id: "e1", status: "POSTED", amount: 100 });
  const r = await Promise.all([postTreasuryMovement(mv({ relatedExpenseId: "e1" })), postTreasuryMovement(mv({ relatedExpenseId: "e1" }))].map(code));
  assert.deepEqual(r.sort(), ["DUPLICATE_TRANSACTION", "OK"]);
  assert.equal(store.treasuryTransaction!.length, 1);
});

test("inactive account accepts no movement", async () => {
  seed();
  store.treasuryAccount![0]!.active = false;
  assert.equal(await code(postTreasuryMovement(mv())), "ACCOUNT_INACTIVE");
});

test("reversal: new opposite entry, original untouched, balance restored, cannot repeat, cannot reverse a reversal", async () => {
  seed();
  const w = await postTreasuryMovement(mv({ amount: 400 }));
  const originalBefore = JSON.stringify(store.treasuryTransaction!.find((t) => t.id === w.id));
  const rev = await reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" });
  const original = store.treasuryTransaction!.find((t) => t.id === w.id)!;
  const reversal = store.treasuryTransaction!.find((t) => t.id === rev.id)!;
  assert.equal(JSON.stringify(original), originalBefore, "original row must not change");
  assert.equal(reversal.type, "DEPOSIT");
  assert.equal(reversal.amount, 400);
  assert.equal(reversal.reversalOfTransactionId, w.id);
  assert.equal(await getAccountBalance("acc1"), 1000);
  assert.equal(await code(reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" })), "DUPLICATE_TRANSACTION");
  assert.equal(await code(reverseTreasuryTransaction({ transactionId: rev.id, createdById: "u1" })), "REVERSAL_OF_REVERSAL");
  assert.equal(store.treasuryTransaction!.length, 2);
});

test("reversing a deposit is blocked when it would drive the balance negative", async () => {
  seed();
  const d = await postTreasuryMovement(mv({ type: "DEPOSIT", amount: 500 }));
  await postTreasuryMovement(mv({ amount: 1400 }));
  assert.equal(await code(reverseTreasuryTransaction({ transactionId: d.id, createdById: "u1" })), "INSUFFICIENT_FUNDS");
  assert.equal(await getAccountBalance("acc1"), 100);
});

test("concurrent double reversal creates one reversal", async () => {
  seed();
  const w = await postTreasuryMovement(mv({ amount: 400 }));
  const r = await Promise.all([1, 2].map(() => code(reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" }))));
  assert.deepEqual(r.sort(), ["DUPLICATE_TRANSACTION", "OK"]);
});

// ---------------------------------------------------------------- validation
test("zod schemas: positive whole DZD only; DZD-only currency", () => {
  const base = { transactionDate: "2026-09-01", treasuryAccountId: "a", idempotencyKey: "k" };
  for (const bad of ["0", "-1", "12.5", "abc", ""]) assert.equal(treasuryMovementSchema.safeParse({ ...base, amount: bad }).success, false, `amount ${bad}`);
  assert.equal(treasuryMovementSchema.safeParse({ ...base, amount: "1200" }).success, true);
  assert.equal(budgetSchema.safeParse({ seasonId: "s", allocatedAmount: "0" }).success, false);
  assert.equal(treasuryAccountSchema.safeParse({ name: "x", openingBalance: "-1" }).success, false);
  assert.equal(treasuryAccountSchema.safeParse({ name: "x", openingBalance: "10.5" }).success, false);
  assert.equal(treasuryAccountSchema.safeParse({ name: "x", currency: "USD" }).success, false);
  assert.equal(treasuryAccountSchema.parse({ name: "x" }).currency, "DZD");
  assert.equal(expenseSchema.safeParse({ amount: "0", category: "FOOD", date: "2026-09-01", description: "d", seasonId: "s" }).success, false);
});

// ---------------------------------------------------------------- insights rules
test("budget utilization thresholds are exact and integer-based", () => {
  assert.equal(classifyBudgetUtilization(1000, 899), null);
  assert.equal(classifyBudgetUtilization(1000, 900), "NEARING_EXHAUSTION");
  assert.equal(classifyBudgetUtilization(1000, 1000), "NEARING_EXHAUSTION");
  assert.equal(classifyBudgetUtilization(1000, 1001), "EXCEEDED");
  assert.equal(classifyBudgetUtilization(0, 5), null);
  assert.equal(classifyBudgetUtilization(1000, 0), null);
  assert.equal(budgetUtilizationPercent(1000, 905), 90);
  assert.equal(budgetUtilizationPercent(3, 1), 33);
});
test("draft severity escalates at 7 days; budget/payment consistency predicates", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  assert.equal(draftExpenseSeverity(new Date("2026-09-14T00:00:01Z"), now), "info");
  assert.equal(draftExpenseSeverity(new Date("2026-09-13T00:00:00Z"), now), "warning");
  assert.equal(expenseDisagreesWithBudget({ seasonId: "a", teamId: "t1" }, { seasonId: "a", teamId: null }), false);
  assert.equal(expenseDisagreesWithBudget({ seasonId: "a", teamId: "t1" }, { seasonId: "a", teamId: "t2" }), true);
  assert.equal(expenseDisagreesWithBudget({ seasonId: "a", teamId: null }, { seasonId: "b", teamId: null }), true);
  assert.equal(expensePaymentIssue({ status: "POSTED", amount: 5 }, null), null);
  assert.equal(expensePaymentIssue({ status: "DRAFT", amount: 5 }, { amount: 5, isReversed: false }), "PAYMENT_ON_NON_POSTED");
  assert.equal(expensePaymentIssue({ status: "CANCELLED", amount: 5 }, { amount: 5, isReversed: false }), "CANCELLED_WITH_LIVE_PAYMENT");
  assert.equal(expensePaymentIssue({ status: "CANCELLED", amount: 5 }, { amount: 5, isReversed: true }), null);
  assert.equal(expensePaymentIssue({ status: "POSTED", amount: 5 }, { amount: 6, isReversed: false }), "AMOUNT_MISMATCH");
});
test("insights are filtered by requiredPermission per user", () => {
  const mk = (requiredPermission?: string) => ({ id: "x", type: "BUDGET_EXCEEDED", category: "attention", severity: "critical", entityType: "Budget", entityId: "b", teamId: null, params: {}, link: "/", requiredPermission }) as any;
  const list = [mk("finance.view"), mk()];
  assert.equal(filterInsightsForUser(list, { permissions: ["players.view"] }).length, 1);
  assert.equal(filterInsightsForUser(list, { permissions: ["finance.view"] }).length, 2);
  assert.equal(filterInsightsForUser(list, { id: "u1", name: "Admin", email: "admin@esh.dz", roleKey: "super_admin", roleName: "Super Admin", permissions: ["*"] }).length, 2);
});

// ---------------------------------------------------------------- document engine
test("all three financial TemplateTypes are wired into RESOLVER_REGISTRY with finance gates and no AI", () => {
  for (const type of ["EXPENSE_STATEMENT", "DEPOSIT_RECEIPT", "WITHDRAWAL_RECEIPT"]) {
    const r = RESOLVER_REGISTRY[type]!;
    assert.ok(r, type);
    assert.equal(r.generatePermission, "finance.approve");
    assert.equal(r.readPermission, "finance.view");
    assert.equal(r.aiAssistAllowed, false);
    assert.ok(r.availablePaths.length > 5);
  }
  assert.equal(RESOLVER_REGISTRY.EXPENSE_STATEMENT!.entityType, "Expense");
  assert.equal(RESOLVER_REGISTRY.DEPOSIT_RECEIPT!.entityType, "TreasuryTransaction");
  // legacy types unchanged
  assert.equal(RESOLVER_REGISTRY.MATCH_REPORT!.generatePermission, undefined);
});
test("permission helpers: documents.generate alone cannot touch financial types", () => {
  const coach = { id: "c", name: "", email: "", roleKey: "coach", roleName: "Coach", permissions: ["documents.generate"] };
  const treasurer = { ...coach, permissions: ["documents.generate", "finance.approve", "finance.view"] };
  assert.throws(() => requireResolverPermission(coach, RESOLVER_REGISTRY.EXPENSE_STATEMENT!, "generate"), /finance.approve/);
  assert.doesNotThrow(() => requireResolverPermission(treasurer, RESOLVER_REGISTRY.EXPENSE_STATEMENT!, "generate"));
  assert.doesNotThrow(() => requireResolverPermission(coach, RESOLVER_REGISTRY.MATCH_REPORT!, "generate"));
  assert.equal(readPermissionForEntityType("Expense"), "finance.view");
  assert.equal(readPermissionForEntityType("TreasuryTransaction"), "finance.view");
  assert.equal(readPermissionForEntityType("Match"), null);
  assert.equal(readPermissionForEntityType(null), null);
  assert.deepEqual(forbiddenGeneratedEntityTypes(coach).sort(), ["Expense", "TreasuryTransaction"]);
  assert.deepEqual(forbiddenGeneratedEntityTypes(treasurer), []);
});
test("formatting and eligibility helpers", () => {
  assert.equal(formatWholeAmount(1234567), "1\u00A0234\u00A0567");
  assert.equal(formatWholeAmount(999), "999");
  assert.equal(isExpenseStatementEligible({ status: "POSTED" }), true);
  assert.equal(isExpenseStatementEligible({ status: "DRAFT" }), false);
  assert.equal(isReceiptEligible({ reversalOfTransactionId: null, reversedBy: null }), true);
  assert.equal(isReceiptEligible({ reversalOfTransactionId: "x", reversedBy: null }), false);
  assert.equal(isReceiptEligible({ reversalOfTransactionId: null, reversedBy: { id: "r" } }), false);
});

const expenseFixture = (over: any = {}) => ({
  id: "e1", referenceNumber: "EXP-2026-AAAA", amount: 12500, category: "TRANSPORT", date: new Date("2026-09-01T00:00:00Z"), description: "Bus", payeeName: "Transport SARL",
  paymentMethod: "BANK_TRANSFER", status: "POSTED", notes: null, team: { name: "Seniors", category: "SENIOR" }, season: { label: "2026/2027" }, budget: null, relatedMatch: null, relatedTraining: null, treasuryTransaction: null, ...over
});
test("expense statement bundle: authoritative values, localized labels, no raw enums (ar + fr)", async () => {
  seed();
  const original = db.expense.findUniqueOrThrow;
  db.expense.findUniqueOrThrow = async () => expenseFixture();
  try {
    const mappings = ["expense.referenceNumber", "expense.amountFormatted", "expense.category", "expense.paymentMethod", "expense.status", "expense.date", "team.category", "club.name"].map((p) => ({ placeholder: p, sourceType: "DATABASE_FIELD", sourcePath: p }));
    const fr = applyMappings(await RESOLVER_REGISTRY.EXPENSE_STATEMENT!.resolveBundle("e1", { language: "fr" }), mappings, {});
    assert.equal(fr["expense.referenceNumber"], "EXP-2026-AAAA");
    assert.equal(fr["expense.amountFormatted"], "12\u00A0500");
    assert.equal(fr["expense.category"], "Transport");
    assert.equal(fr["expense.paymentMethod"], "Virement bancaire");
    assert.equal(fr["expense.status"], "Validée");
    assert.equal(fr["expense.date"], "1 septembre 2026");
    assert.equal(fr["team.category"], "Séniors");
    assert.equal(fr["club.name"], "Espoir Sidi Hosni");
    const ar = applyMappings(await RESOLVER_REGISTRY.EXPENSE_STATEMENT!.resolveBundle("e1", { language: "ar" }), mappings, {});
    assert.equal(ar["expense.category"], "نقل");
    assert.equal(ar["expense.paymentMethod"], "تحويل بنكي");
    assert.equal(ar["expense.status"], "مرحّلة");
    assert.equal(ar["team.category"], "الأكابر");
    for (const v of [...Object.values(fr), ...Object.values(ar)]) assert.ok(!/^(TRANSPORT|BANK_TRANSFER|POSTED|SENIOR)$/.test(v), `raw enum leaked: ${v}`);
    // Non-authoritative expenses never produce an official statement
    db.expense.findUniqueOrThrow = async () => expenseFixture({ status: "DRAFT" });
    await assert.rejects(RESOLVER_REGISTRY.EXPENSE_STATEMENT!.resolveBundle("e1", { language: "fr" }), (e: any) => e instanceof FinancialDocumentError && e.code === "expenseNotPosted");
  } finally { db.expense.findUniqueOrThrow = original; }
});
const txFixture = (over: any = {}) => ({
  id: "t1", referenceNumber: "WD-2026-BBBB", type: "WITHDRAWAL", amount: 3000, transactionDate: new Date("2026-09-02T00:00:00Z"), description: null, balanceBefore: 5000, balanceAfter: 2000,
  treasuryAccount: { name: "Caisse", type: "CASH" }, relatedExpense: null, reversalOfTransactionId: null, reversedBy: null, ...over
});
test("receipt bundles: direction enforced, reversal entries and reversed originals refused", async () => {
  seed();
  const original = db.treasuryTransaction.findUniqueOrThrow;
  try {
    db.treasuryTransaction.findUniqueOrThrow = async () => txFixture();
    const b: any = await RESOLVER_REGISTRY.WITHDRAWAL_RECEIPT!.resolveBundle("t1", { language: "fr" });
    assert.equal(b.transaction.type, "Retrait");
    assert.equal(b.transaction.amountWithCurrency, "3\u00A0000 DA");
    assert.equal(b.account.type, "Caisse");
    await assert.rejects(RESOLVER_REGISTRY.DEPOSIT_RECEIPT!.resolveBundle("t1", { language: "fr" }), (e: any) => e.code === "wrongTransactionType");
    db.treasuryTransaction.findUniqueOrThrow = async () => txFixture({ reversalOfTransactionId: "x" });
    await assert.rejects(RESOLVER_REGISTRY.WITHDRAWAL_RECEIPT!.resolveBundle("t1", { language: "fr" }), (e: any) => e.code === "transactionNotEligible");
    db.treasuryTransaction.findUniqueOrThrow = async () => txFixture({ reversedBy: { id: "r" } });
    await assert.rejects(RESOLVER_REGISTRY.WITHDRAWAL_RECEIPT!.resolveBundle("t1", { language: "ar" }), (e: any) => e.code === "transactionNotEligible");
    db.treasuryTransaction.findUniqueOrThrow = async () => txFixture({ type: "DEPOSIT" });
    const dep: any = await RESOLVER_REGISTRY.DEPOSIT_RECEIPT!.resolveBundle("t1", { language: "ar" });
    assert.equal(dep.transaction.type, "إيداع");
    assert.equal(dep.transaction.amountWithCurrency, "3\u00A0000 د.ج");
  } finally { db.treasuryTransaction.findUniqueOrThrow = original; }
});
