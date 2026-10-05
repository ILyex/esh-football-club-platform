import { describe, before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// ============================================================================
// FINANCE — REAL POSTGRESQL + REAL DOCXTEMPLATER INTEGRATION SUITE
// ----------------------------------------------------------------------------
// Uses the REAL Prisma client against a REAL PostgreSQL database, the real
// treasury service, real server actions, real zod schemas, real permissions,
// real audit writer, and the real docxtemplater/pizzip template engine.
// Only the framework edges are replaced (session, private object storage,
// next/navigation|cache|headers) — see tests/finance/tsconfig.integration.json.
//
// SAFETY: it TRUNCATES every table. It refuses to run unless DATABASE_URL_TEST
// points at a database whose name contains "test". See tests/finance/README.md.
// ============================================================================

const URL_TEST = process.env.DATABASE_URL_TEST;
const skip = !URL_TEST
  ? "DATABASE_URL_TEST is not set (needs a disposable PostgreSQL database whose name contains 'test')"
  : !/test/i.test(new URL(URL_TEST).pathname)
    ? "DATABASE_URL_TEST must point at a database whose name contains 'test'"
    : false;

// Filled by before(): modules are imported dynamically so DATABASE_URL is set before the Prisma client is constructed.
let db: any, svc: any, authMock: any, storageMock: any, navMock: any;
let expenseActions: any, budgetActions: any, treasuryActions: any, docActions: any, downloadRoute: any, PizZip: any, Docxtemplater: any, applyMappings: any;
let userId = "";

const FIXTURE = readFileSync(join(__dirname, "..", "fixtures", "official-template.docx"));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const FULL = ["documents.generate", "finance.view", "finance.manage", "finance.approve"];

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
let keyCounter = 0;
const key = () => `it-${Date.now()}-${++keyCounter}`;
const code = async (p: Promise<unknown>) => p.then(() => "OK", (e: any) => e?.code ?? e?.message ?? String(e)); // FinanceError.code | Error(<CODE>)
const redirectOf = async (p: Promise<unknown>): Promise<string> => p.then(() => "no-redirect", (e: any) => (e instanceof navMock.Redirect ? e.url : `ERR:${e?.message}`));
const mv = (accountId: string, o: Record<string, unknown> = {}) => ({ treasuryAccountId: accountId, type: "WITHDRAWAL", amount: 100, transactionDate: new Date("2026-09-01T00:00:00Z"), idempotencyKey: key(), createdById: userId, ...o });

async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog","GeneratedDocument","DocumentFieldMapping","DocumentTemplateVersion","DocumentTemplate","TreasuryTransaction","Expense","Budget","TreasuryAccount","Notification","Team","Season","User","Role" RESTART IDENTITY CASCADE'
  );
}
async function seedBase() {
  const role = await db.role.create({ data: { key: "treasurer", name: "Treasurer" } });
  const user = await db.user.create({ data: { name: "Test Treasurer", email: "t@test.dz", passwordHash: "x", roleId: role.id } });
  userId = user.id;
  authMock.session.user = { id: user.id, name: user.name, email: user.email, roleKey: "treasurer", roleName: "Treasurer", permissions: FULL };
  authMock.signedOut.value = false;
  const s1 = await db.season.create({ data: { label: "2026/2027", startDate: new Date("2026-07-01"), endDate: new Date("2027-06-30"), isCurrent: true } });
  const s2 = await db.season.create({ data: { label: "2027/2028", startDate: new Date("2027-07-01"), endDate: new Date("2028-06-30") } });
  const team = await db.team.create({ data: { name: "Espoir Sidi Hosni — Seniors", category: "SENIOR" } });
  await db.clubSettings.upsert({ where: { id: "singleton" }, update: { name: "Espoir Sidi Hosni" }, create: { id: "singleton", name: "Espoir Sidi Hosni", shortName: "ESH" } });
  return { s1: s1.id, s2: s2.id, teamId: team.id };
}
const newAccount = (openingBalance = 1000, extra: Record<string, unknown> = {}) => db.treasuryAccount.create({ data: { name: `Acc-${key()}`, type: "CASH", openingBalance, createdById: userId, ...extra } });
const expenseForm = (seasonId: string, o: Record<string, string> = {}) => fd({ amount: "500", category: "TRANSPORT", date: "2026-09-01", description: "Bus", seasonId, ...o });

describe("Finance & Treasury — real PostgreSQL", { skip }, () => {
  let base: { s1: string; s2: string; teamId: string };

  before(async () => {
    process.env.DATABASE_URL = URL_TEST;
    db = (await import("@/lib/db")).db;
    svc = await import("@/lib/finance/treasury-service");
    authMock = await import("../mocks/auth");
    storageMock = await import("../mocks/storage");
    navMock = await import("../mocks/next-navigation");
    expenseActions = await import("@/app/[locale]/(dashboard)/dashboard/finance/expenses/actions");
    budgetActions = await import("@/app/[locale]/(dashboard)/dashboard/finance/budgets/actions");
    treasuryActions = await import("@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions");
    docActions = await import("@/app/[locale]/(dashboard)/dashboard/generated-documents/actions");
    downloadRoute = await import("@/app/api/generated-documents/[id]/download/route");
    ({ applyMappings } = await import("@/lib/documents/entity-data-resolvers"));
    PizZip = (await import("pizzip")).default;
    Docxtemplater = (await import("docxtemplater")).default;
  });
  after(async () => { if (db) await db.$disconnect(); });
  beforeEach(async () => {
    await resetDb();
    storageMock.files.clear();
    base = await seedBase();
  });

  // ------------------------------------------------------------------ ledger invariants
  test("balance is derived from the ledger; balanceBefore/After are snapshots, not the source of truth", async () => {
    const acc = await newAccount(1000);
    await svc.postTreasuryMovement(mv(acc.id, { type: "DEPOSIT", amount: 500 }));
    const w = await svc.postTreasuryMovement(mv(acc.id, { amount: 300 }));
    assert.equal(await svc.getAccountBalance(acc.id), 1200);
    assert.equal((await svc.getAccountBalances([acc.id])).get(acc.id), 1200);
    // Tamper with the stored snapshot: the derived balance must NOT change (the ledger amounts are the truth).
    await db.$executeRawUnsafe(`UPDATE "TreasuryTransaction" SET "balanceAfter" = 999999 WHERE id = '${w.id}'`);
    assert.equal(await svc.getAccountBalance(acc.id), 1200);
    const rows = await db.treasuryTransaction.findMany({ where: { treasuryAccountId: acc.id }, orderBy: { createdAt: "asc" } });
    assert.ok(rows.every((r: any) => Number.isInteger(r.amount) && r.amount > 0 && Number.isInteger(r.balanceBefore) && Number.isInteger(r.balanceAfter)));
  });

  test("money must be a positive whole DZD integer (service and zod)", async () => {
    const acc = await newAccount();
    for (const amount of [0, -5, 1.5, NaN]) assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { amount }))), "INVALID_AMOUNT");
    for (const bad of ["0", "-1", "12.5", "abc"]) {
      await assert.rejects(treasuryActions.createDepositAction(fd({ treasuryAccountId: acc.id, amount: bad, transactionDate: "2026-09-01", idempotencyKey: key() })));
    }
    assert.equal(await db.treasuryTransaction.count(), 0);
  });

  test("no negative balance; inactive accounts refuse movements", async () => {
    const acc = await newAccount(1000);
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { amount: 1001 }))), "INSUFFICIENT_FUNDS");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { amount: 1000 }))), "OK");
    assert.equal(await svc.getAccountBalance(acc.id), 0);
    const inactive = await newAccount(1000, { active: false });
    assert.equal(await code(svc.postTreasuryMovement(mv(inactive.id))), "ACCOUNT_INACTIVE");
  });

  test("two concurrent withdrawals from one account cannot both pass (SERIALIZABLE) — 15 rounds", async () => {
    for (let round = 0; round < 15; round++) {
      const acc = await newAccount(1000);
      const results = await Promise.all([svc.postTreasuryMovement(mv(acc.id, { amount: 800 })), svc.postTreasuryMovement(mv(acc.id, { amount: 800 }))].map(code));
      assert.deepEqual([...results].sort(), ["INSUFFICIENT_FUNDS", "OK"], `round ${round}`);
      assert.equal(await svc.getAccountBalance(acc.id), 200);
      assert.equal(await db.treasuryTransaction.count({ where: { treasuryAccountId: acc.id } }), 1);
    }
  });

  test("many concurrent withdrawals: never overdrawn, balance equals the ledger sum", async () => {
    const acc = await newAccount(1000);
    const results = await Promise.all(Array.from({ length: 12 }, () => code(svc.postTreasuryMovement(mv(acc.id, { amount: 300 })))));
    const ok = results.filter((r) => r === "OK").length;
    // Under heavy contention the database may abort more attempts than the bounded retry absorbs; those callers get the
    // stable CONCURRENT_UPDATE code (never a raw error). What must NEVER happen is an overdraft or a wrong balance.
    assert.ok(ok >= 1 && ok <= 3, `ok=${ok}`); // at most floor(1000/300) = 3 can fit
    assert.ok(results.every((r) => r === "OK" || r === "INSUFFICIENT_FUNDS" || r === "CONCURRENT_UPDATE"), results.join());
    assert.equal(await svc.getAccountBalance(acc.id), 1000 - 300 * ok);
  });

  test("concurrent deposit + withdrawal: snapshots chain in commit order and the balance is exact", async () => {
    for (let round = 0; round < 10; round++) {
      const acc = await newAccount(1000);
      await Promise.all([svc.postTreasuryMovement(mv(acc.id, { type: "DEPOSIT", amount: 300 })), svc.postTreasuryMovement(mv(acc.id, { amount: 1200 }))].map(code));
      const rows = await db.treasuryTransaction.findMany({ where: { treasuryAccountId: acc.id }, orderBy: { createdAt: "asc" } });
      let running = 1000;
      for (const r of rows) {
        assert.equal(r.balanceBefore, running);
        running = r.type === "DEPOSIT" ? running + r.amount : running - r.amount;
        assert.equal(r.balanceAfter, running);
      }
      assert.equal(await svc.getAccountBalance(acc.id), running);
      assert.ok(running >= 0);
    }
  });

  // ------------------------------------------------------------------ idempotency
  test("idempotency: replay, conflicts on any differing parameter, concurrent same key, reserved prefix", async () => {
    const acc = await newAccount(5000), other = await newAccount(5000);
    const p = mv(acc.id, { idempotencyKey: "IT-K1", amount: 250, description: "x" });
    const a = await svc.postTreasuryMovement(p);
    const b = await svc.postTreasuryMovement({ ...p });
    assert.equal(a.replayed, false); assert.equal(b.replayed, true); assert.equal(a.id, b.id);
    for (const diff of [{ amount: 251 }, { treasuryAccountId: other.id }, { type: "DEPOSIT" }, { transactionDate: new Date("2026-09-02T00:00:00Z") }, { description: "y" }]) {
      assert.equal(await code(svc.postTreasuryMovement({ ...p, ...diff })), "IDEMPOTENCY_CONFLICT", JSON.stringify(diff));
    }
    assert.equal(await db.treasuryTransaction.count(), 1);
    assert.equal(await db.auditLog.count({ where: { action: "treasury.withdrawal" } }), 1, "a replay writes no second audit row");

    const same = await Promise.all(Array.from({ length: 3 }, () => svc.postTreasuryMovement(mv(acc.id, { idempotencyKey: "IT-K2", amount: 10 }))));
    assert.equal(new Set(same.map((r: any) => r.id)).size, 1);
    assert.equal(await db.treasuryTransaction.count({ where: { idempotencyKey: "IT-K2" } }), 1);

    const mixed = await Promise.all([10, 20, 30].map((amount) => code(svc.postTreasuryMovement(mv(acc.id, { idempotencyKey: "IT-K3", amount })))));
    assert.equal(mixed.filter((r) => r === "OK").length, 1);
    assert.ok(mixed.every((r) => r === "OK" || r === "IDEMPOTENCY_CONFLICT" || r === "CONCURRENT_UPDATE"));

    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { idempotencyKey: "reversal-anything" }))), "IDEMPOTENCY_CONFLICT");
  });

  // ------------------------------------------------------------------ expense payment rules
  test("expense payment: only POSTED, exactly its amount, exactly once; only a withdrawal may link an expense", async () => {
    const acc = await newAccount(100000);
    const mk = (status: string, amount = 100) => db.expense.create({ data: { referenceNumber: `EXP-${key()}`, amount, category: "FOOD", date: new Date("2026-09-01"), description: "d", seasonId: base.s1, status, createdById: userId } });
    const draft = await mk("DRAFT"), cancelled = await mk("CANCELLED"), posted = await mk("POSTED");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: draft.id }))), "INVALID_STATUS_TRANSITION");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: cancelled.id }))), "INVALID_STATUS_TRANSITION");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: "missing" }))), "EXPENSE_NOT_FOUND");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: posted.id, amount: 99 }))), "EXPENSE_AMOUNT_MISMATCH");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: posted.id, type: "DEPOSIT" }))), "INVALID_EXPENSE_LINK");
    assert.equal(await db.treasuryTransaction.count(), 0);
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: posted.id }))), "OK");
    assert.equal(await code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: posted.id }))), "DUPLICATE_TRANSACTION");
    assert.equal(await db.treasuryTransaction.count(), 1);
  });

  test("concurrent payments of one expense (different keys): exactly one lands — the @unique constraint is the backstop", async () => {
    const acc = await newAccount(100000);
    for (let round = 0; round < 10; round++) {
      const e = await db.expense.create({ data: { referenceNumber: `EXP-${key()}`, amount: 100, category: "FOOD", date: new Date("2026-09-01"), description: "d", seasonId: base.s1, status: "POSTED", createdById: userId } });
      const r = await Promise.all([1, 2, 3].map(() => code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: e.id })))));
      assert.equal(r.filter((x) => x === "OK").length, 1, `round ${round}: ${r}`);
      assert.ok(r.every((x) => x === "OK" || x === "DUPLICATE_TRANSACTION" || x === "CONCURRENT_UPDATE"));
    }
  });

  test("concurrent payment vs cancellation of the same expense never leaves a CANCELLED expense with a live payment", async () => {
    const acc = await newAccount(100000);
    for (let round = 0; round < 15; round++) {
      const e = await db.expense.create({ data: { referenceNumber: `EXP-${key()}`, amount: 100, category: "FOOD", date: new Date("2026-09-01"), description: "d", seasonId: base.s1, status: "POSTED", createdById: userId } });
      await Promise.all([code(svc.postTreasuryMovement(mv(acc.id, { relatedExpenseId: e.id }))), code(expenseActions.cancelExpenseAction(e.id))]);
      const after = await db.expense.findUnique({ where: { id: e.id }, include: { treasuryTransaction: { include: { reversedBy: true } } } });
      const live = after.treasuryTransaction && !after.treasuryTransaction.reversedBy;
      assert.ok(!(after.status === "CANCELLED" && live), `round ${round}: cancelled expense with a live payment`);
    }
  });

  // ------------------------------------------------------------------ reversals
  test("reversal: new opposite entry, original row byte-identical, balance restored; double / concurrent / reversal-of-reversal rejected", async () => {
    const acc = await newAccount(1000);
    const w = await svc.postTreasuryMovement(mv(acc.id, { amount: 400 }));
    const before = await db.treasuryTransaction.findUnique({ where: { id: w.id } });
    const rev = await svc.reverseTreasuryTransaction({ transactionId: w.id, createdById: userId });
    const after = await db.treasuryTransaction.findUnique({ where: { id: w.id } });
    assert.deepEqual(after, before, "original transaction must be unchanged");
    const reversal = await db.treasuryTransaction.findUnique({ where: { id: rev.id } });
    assert.equal(reversal.type, "DEPOSIT"); assert.equal(reversal.amount, 400); assert.equal(reversal.reversalOfTransactionId, w.id);
    assert.equal(await svc.getAccountBalance(acc.id), 1000);
    assert.equal(await code(svc.reverseTreasuryTransaction({ transactionId: w.id, createdById: userId })), "DUPLICATE_TRANSACTION");
    assert.equal(await code(svc.reverseTreasuryTransaction({ transactionId: rev.id, createdById: userId })), "REVERSAL_OF_REVERSAL");

    const w2 = await svc.postTreasuryMovement(mv(acc.id, { amount: 100 }));
    const race = await Promise.all(Array.from({ length: 3 }, () => code(svc.reverseTreasuryTransaction({ transactionId: w2.id, createdById: userId }))));
    assert.equal(race.filter((r) => r === "OK").length, 1);
    assert.ok(race.every((r) => r === "OK" || r === "DUPLICATE_TRANSACTION" || r === "CONCURRENT_UPDATE"));
    assert.equal(await svc.getAccountBalance(acc.id), 1000);
  });

  test("reversing a deposit is blocked when it would overdraw the account", async () => {
    const acc = await newAccount(0);
    const d = await svc.postTreasuryMovement(mv(acc.id, { type: "DEPOSIT", amount: 500 }));
    await svc.postTreasuryMovement(mv(acc.id, { amount: 450 }));
    assert.equal(await code(svc.reverseTreasuryTransaction({ transactionId: d.id, createdById: userId })), "INSUFFICIENT_FUNDS");
    assert.equal(await svc.getAccountBalance(acc.id), 50);
  });

  // ------------------------------------------------------------------ audit atomicity
  test("audit atomicity: if the audit insert fails, the financial mutation is rolled back (treasury, expense, budget, account)", async () => {
    const acc = await newAccount(1000);
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit blocked'; END; $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_fail_audit_trg BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION test_fail_audit()`);
    try {
      await assert.rejects(svc.postTreasuryMovement(mv(acc.id)), /audit blocked/);
      await assert.rejects(expenseActions.createExpenseAction(expenseForm(base.s1)), /audit blocked/);
      await assert.rejects(budgetActions.createBudgetAction(fd({ seasonId: base.s1, allocatedAmount: "1000", status: "ACTIVE" })), /audit blocked/);
      await assert.rejects(treasuryActions.createTreasuryAccountAction(fd({ name: "Nope", type: "CASH", openingBalance: "10" })), /audit blocked/);
      assert.equal(await db.treasuryTransaction.count(), 0);
      assert.equal(await db.expense.count(), 0);
      assert.equal(await db.budget.count(), 0);
      assert.equal(await db.treasuryAccount.count({ where: { name: "Nope" } }), 0);
      assert.equal(await svc.getAccountBalance(acc.id), 1000);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_audit_trg ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_audit()`);
    }
    // and with auditing healthy every mutation leaves exactly one audit row
    const w = await svc.postTreasuryMovement(mv(acc.id, { amount: 10 }));
    assert.equal(await db.auditLog.count({ where: { entityType: "TreasuryTransaction", entityId: w.id } }), 1);
  });

  // ------------------------------------------------------------------ budget / expense consistency
  test("expense↔budget consistency: season, team scope, closed budget, club-wide budget", async () => {
    const mkBudget = (o: Record<string, unknown>) => db.budget.create({ data: { seasonId: base.s1, allocatedAmount: 10000, createdById: userId, ...o } });
    const wrongSeason = await mkBudget({ seasonId: base.s2 }), teamBudget = await mkBudget({ teamId: base.teamId }), closed = await mkBudget({ status: "CLOSED" }), club = await mkBudget({});
    assert.equal(await code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId: wrongSeason.id }))), "INVALID_SEASON");
    assert.equal(await code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId: teamBudget.id }))), "INVALID_TEAM_RELATION");
    assert.equal(await code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId: closed.id }))), "BUDGET_CLOSED");
    assert.equal(await code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId: teamBudget.id, teamId: base.teamId }))), "OK");
    assert.equal(await code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId: club.id, teamId: base.teamId }))), "OK"); // club-wide accepts any team
  });

  test("budget season/team cannot change once expenses are linked; allocation may drop below posted spend (documented decision)", async () => {
    const { id: budgetId } = await budgetActions.createBudgetAction(fd({ seasonId: base.s1, allocatedAmount: "10000", status: "ACTIVE" }));
    const { id: expenseId } = await expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId, amount: "800" }));
    await expenseActions.postExpenseAction(expenseId);
    const upd = (o: Record<string, string>) => budgetActions.updateBudgetAction(budgetId, fd({ seasonId: base.s1, allocatedAmount: "10000", status: "ACTIVE", ...o }));
    assert.equal(await code(upd({ seasonId: base.s2 })), "BUDGET_HAS_EXPENSES");
    assert.equal(await code(upd({ teamId: base.teamId })), "BUDGET_HAS_EXPENSES");
    assert.equal(await code(upd({ allocatedAmount: "100" })), "OK");
  });

  test("concurrent 'attach expense' vs 're-season budget' never yields an expense whose season disagrees with its budget — 20 rounds", async () => {
    for (let round = 0; round < 20; round++) {
      const { id: budgetId } = await budgetActions.createBudgetAction(fd({ seasonId: base.s1, allocatedAmount: "10000", status: "ACTIVE" }));
      const [a, b] = await Promise.all([
        code(expenseActions.createExpenseAction(expenseForm(base.s1, { budgetId }))),
        code(budgetActions.updateBudgetAction(budgetId, fd({ seasonId: base.s2, allocatedAmount: "10000", status: "ACTIVE" })))
      ]);
      const budget = await db.budget.findUnique({ where: { id: budgetId }, include: { expenses: true } });
      for (const e of budget.expenses) assert.equal(e.seasonId, budget.seasonId, `round ${round}: ${a}/${b}`);
      assert.ok(!(a === "OK" && b === "OK"), `round ${round}: both succeeded`);
    }
  });

  test("expense lifecycle: POSTED is immutable; post once; concurrent post + edit cannot rewrite a posted expense", async () => {
    const { id } = await expenseActions.createExpenseAction(expenseForm(base.s1));
    await Promise.all(Array.from({ length: 4 }, () => code(expenseActions.postExpenseAction(id))));
    assert.equal((await db.expense.findUnique({ where: { id } })).status, "POSTED");
    assert.equal(await db.auditLog.count({ where: { action: "expense.post", entityId: id } }), 1);
    assert.equal(await code(expenseActions.updateExpenseAction(id, expenseForm(base.s1, { amount: "999" }))), "INVALID_STATUS_TRANSITION");
    assert.equal((await db.expense.findUnique({ where: { id } })).amount, 500);
    for (let round = 0; round < 10; round++) {
      const { id: e2 } = await expenseActions.createExpenseAction(expenseForm(base.s1));
      await Promise.all([code(expenseActions.updateExpenseAction(e2, expenseForm(base.s1, { amount: "777" }))), code(expenseActions.postExpenseAction(e2))]);
      const row = await db.expense.findUnique({ where: { id: e2 } });
      const updates = await db.auditLog.findMany({ where: { entityId: e2, action: "expense.update" } });
      // if the edit was applied, the audit trail must say so; a POSTED row's amount must match its last audited state
      assert.equal(row.status, "POSTED");
      assert.equal(row.amount === 777, updates.length === 1);
    }
  });

  // ------------------------------------------------------------------ permissions / direct access
  test("every finance action rejects a caller without the right permission (server-side)", async () => {
    const acc = await newAccount();
    authMock.session.user.permissions = ["finance.view"];
    for (const call of [
      () => treasuryActions.createDepositAction(fd({ treasuryAccountId: acc.id, amount: "5", transactionDate: "2026-09-01", idempotencyKey: key() })),
      () => treasuryActions.createTreasuryAccountAction(fd({ name: "X", type: "CASH", openingBalance: "1" })),
      () => expenseActions.createExpenseAction(expenseForm(base.s1)),
      () => budgetActions.createBudgetAction(fd({ seasonId: base.s1, allocatedAmount: "1", status: "ACTIVE" }))
    ]) await assert.rejects(call(), /Forbidden/);
    authMock.session.user.permissions = ["finance.manage"];
    for (const call of [() => expenseActions.postExpenseAction("x"), () => treasuryActions.reverseTransactionAction("x", acc.id)]) await assert.rejects(call(), /Forbidden/);
    assert.equal(await db.treasuryTransaction.count(), 0);
  });

  // ------------------------------------------------------------------ Document Engine end to end (real docxtemplater)
  async function seedVersion(type: string, language: string, mappings: [string, "DATABASE_FIELD" | "MANUAL_INPUT" | "AI_ASSISTED", string | null][]) {
    const tpl = await db.documentTemplate.create({ data: { name: `T-${type}`, type, language, createdById: userId } });
    const storageKey = `templates/${type}-${key()}.docx`;
    storageMock.files.set(storageKey, Buffer.from(FIXTURE));
    return db.documentTemplateVersion.create({
      data: {
        templateId: tpl.id, versionNumber: 1, status: "ACTIVE", storageKey, originalFilename: "official-template.docx", sizeBytes: FIXTURE.byteLength,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", detectedFields: mappings.map((m) => m[0]), createdById: userId,
        fieldMappings: { create: mappings.map(([placeholder, sourceType, sourcePath]) => ({ placeholder, label: placeholder, sourceType, sourcePath })) }
      }
    });
  }
  const EXPENSE_MAP: [string, "DATABASE_FIELD" | "MANUAL_INPUT", string | null][] = [
    ["CLUB", "DATABASE_FIELD", "club.name"], ["REF", "DATABASE_FIELD", "expense.referenceNumber"], ["AMOUNT", "DATABASE_FIELD", "expense.amountFormatted"],
    ["CAT", "DATABASE_FIELD", "expense.category"], ["DATE", "DATABASE_FIELD", "expense.date"], ["PAYREF", "DATABASE_FIELD", "payment.referenceNumber"], ["NOTE", "MANUAL_INPUT", null]
  ];
  const TX_MAP = (typeLabelPath = "transaction.type"): [string, "DATABASE_FIELD" | "AI_ASSISTED", string | null][] => [
    ["CLUB", "DATABASE_FIELD", "club.name"], ["REF", "DATABASE_FIELD", "transaction.referenceNumber"], ["AMOUNT", "DATABASE_FIELD", "transaction.amountFormatted"],
    ["CAT", "DATABASE_FIELD", typeLabelPath], ["DATE", "DATABASE_FIELD", "transaction.date"], ["PAYREF", "DATABASE_FIELD", "account.name"], ["NOTE", "AI_ASSISTED", null]
  ];
  const parts = (buf: Buffer) => { const z = new PizZip(buf); return { z, names: Object.keys(z.files), text: (n: string) => z.file(n)!.asText() }; };

  test("EXPENSE_STATEMENT end to end: real DOCX, DB-authoritative values, manual field only, layout parts preserved, template untouched, linked + audited", async () => {
    const { id: expenseId } = await expenseActions.createExpenseAction(expenseForm(base.s1, { amount: "12500", teamId: base.teamId }));
    await expenseActions.postExpenseAction(expenseId);
    const acc = await newAccount(100000);
    const pay = await treasuryActions.createWithdrawalAction(fd({ treasuryAccountId: acc.id, amount: "12500", transactionDate: "2026-09-02", idempotencyKey: key(), relatedExpenseId: expenseId }));
    const version = await seedVersion("EXPENSE_STATEMENT", "fr", EXPENSE_MAP);
    const templateHashBefore = sha(storageMock.files.get(version.storageKey));
    await db.auditLog.deleteMany({});

    const url = await redirectOf(docActions.generateDocumentAction("fr", version.id, fd({ entityId: expenseId, field_AMOUNT: "999999", field_REF: "FAKE", field_NOTE: "Note manuelle", ai_NOTE: "1" })));
    assert.match(url, /^\/fr\/dashboard\/generated-documents\/[^/?]+$/, url);

    const generated = await db.generatedDocument.findFirstOrThrow({});
    assert.equal(generated.relatedEntityType, "Expense"); assert.equal(generated.relatedEntityId, expenseId);
    assert.equal(generated.aiUsed, false); assert.equal(generated.createdById, userId);
    assert.match(generated.storageKey, /\.docx$/); assert.match(generated.mimeType, /wordprocessingml/); // DOCX only — no PDF is produced
    const out = storageMock.files.get(generated.storageKey);
    assert.equal(generated.sizeBytes, out.byteLength);

    const gen = parts(out), tpl = parts(FIXTURE);
    const body = gen.text("word/document.xml"), header = gen.text("word/header1.xml");
    const refNumber = (await db.expense.findUniqueOrThrow({ where: { id: expenseId } })).referenceNumber;
    assert.ok(body.includes(refNumber) && !body.includes("FAKE"));
    assert.ok(body.includes("12\u00A0500") && !body.includes("999999"));
    assert.ok(body.includes("Transport"), "category printed in French, not the raw enum");
    assert.ok(body.includes("1 septembre 2026"));
    assert.ok(body.includes(pay.referenceNumber), "payment reference comes from the linked ledger entry");
    assert.ok(body.includes("Note manuelle"));
    assert.ok(header.includes("Espoir Sidi Hosni"));
    for (const n of gen.names.filter((x) => x.endsWith(".xml"))) assert.ok(!gen.text(n).includes("{{"), `unresolved placeholder in ${n}`);
    // Layout preserved: every part other than the two text-bearing ones is byte-identical to the template.
    // (document/header/footer XML are the parts docxtemplater parses and re-serialises, so they are checked semantically below.)
    for (const n of tpl.names) {
      if (tpl.z.files[n].dir || /^word\/(document|header\d*|footer\d*)\.xml$/.test(n)) continue;
      assert.equal(sha(Buffer.from(gen.z.file(n)!.asUint8Array())), sha(Buffer.from(tpl.z.file(n)!.asUint8Array())), `part changed: ${n}`);
    }
    for (const tag of ["<w:tbl>", "<w:tr>", "<w:tc>", "<w:tblBorders", "<w:jc "]) assert.equal(body.split(tag).length, tpl.text("word/document.xml").split(tag).length, `structure changed: ${tag}`);
    assert.ok(header.includes("<w:drawing"), "logo still in the header");
    assert.ok(gen.text("word/footer1.xml").includes("Document officiel — Espoir Sidi Hosni"), "static footer text preserved");
    // Compare FILE parts only: PizZip writes explicit folder entries ("word/", "_rels/"...) that python-docx does not,
    // which is packaging noise, not a content change.
    const fileParts = (p: { z: any; names: string[] }) => p.names.filter((n) => !p.z.files[n].dir).sort();
    assert.deepEqual(fileParts(gen), fileParts(tpl), "no part added or removed");
    // The output is a valid DOCX that the engine (and Word) can open again.
    const reopened = new Docxtemplater(new PizZip(out), { delimiters: { start: "{{", end: "}}" } });
    assert.ok(reopened.getFullText().includes(refNumber));
    // The stored template was not mutated.
    assert.equal(sha(storageMock.files.get(version.storageKey)), templateHashBefore);
    assert.equal(sha(FIXTURE), sha(Buffer.from(FIXTURE)));
    // Audit: document row + originating entity, both committed with the GeneratedDocument.
    const audits = await db.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    assert.deepEqual(audits.map((a: any) => [a.action, a.entityType, a.entityId]), [["document.generate", "GeneratedDocument", generated.id], ["expense.document_generated", "Expense", expenseId]]);
  });

  test("EXPENSE_STATEMENT (Arabic template) prints Arabic labels; a DRAFT/CANCELLED expense gets no official statement", async () => {
    const { id } = await expenseActions.createExpenseAction(expenseForm(base.s1));
    const version = await seedVersion("EXPENSE_STATEMENT", "ar", EXPENSE_MAP);
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", version.id, fd({ entityId: id }))), /notice=finance\.errors\.DOCUMENT_EXPENSE_NOT_POSTED/);
    assert.equal(await db.generatedDocument.count(), 0);
    await expenseActions.postExpenseAction(id);
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", version.id, fd({ entityId: id }))), /generated-documents\/[^/?]+$/);
    const g = await db.generatedDocument.findFirstOrThrow({});
    assert.ok(parts(storageMock.files.get(g.storageKey)).text("word/document.xml").includes("نقل"));
    await expenseActions.cancelExpenseAction(id);
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", version.id, fd({ entityId: id }))), /DOCUMENT_EXPENSE_NOT_POSTED/);
  });

  test("DEPOSIT_RECEIPT and WITHDRAWAL_RECEIPT end to end; wrong direction, reversed originals and reversal entries are refused", async () => {
    const acc = await newAccount(100000);
    const dep = await svc.postTreasuryMovement(mv(acc.id, { type: "DEPOSIT", amount: 5000 }));
    const wd = await svc.postTreasuryMovement(mv(acc.id, { amount: 3000 }));
    const wd2 = await svc.postTreasuryMovement(mv(acc.id, { amount: 700 }));
    const vDep = await seedVersion("DEPOSIT_RECEIPT", "fr", TX_MAP());
    const vWd = await seedVersion("WITHDRAWAL_RECEIPT", "ar", TX_MAP());
    await db.auditLog.deleteMany({});

    assert.match(await redirectOf(docActions.generateDocumentAction("fr", vDep.id, fd({ entityId: wd.id }))), /WRONG_TRANSACTION_TYPE/);
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", vWd.id, fd({ entityId: dep.id }))), /WRONG_TRANSACTION_TYPE/);
    assert.match(await redirectOf(docActions.generateDocumentAction("fr", vDep.id, fd({ entityId: dep.id, field_NOTE: "x", ai_NOTE: "1" }))), /generated-documents\/[^/?]+$/);
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", vWd.id, fd({ entityId: wd.id }))), /generated-documents\/[^/?]+$/);
    const docs = await db.generatedDocument.findMany({ orderBy: { createdAt: "asc" } });
    assert.deepEqual(docs.map((d: any) => [d.relatedEntityType, d.relatedEntityId, d.aiUsed]), [["TreasuryTransaction", dep.id, false], ["TreasuryTransaction", wd.id, false]]);
    const depBody = parts(storageMock.files.get(docs[0].storageKey)).text("word/document.xml");
    const wdBody = parts(storageMock.files.get(docs[1].storageKey)).text("word/document.xml");
    assert.ok(depBody.includes("Dépôt") && depBody.includes("5\u00A0000") && depBody.includes(dep.referenceNumber));
    assert.ok(wdBody.includes("سحب") && wdBody.includes("3\u00A0000") && wdBody.includes(wd.referenceNumber));
    for (const [d, b] of [[docs[0], depBody], [docs[1], wdBody]] as const) assert.ok(!b.includes("{{") && d.storageKey.endsWith(".docx"));
    assert.equal(await db.auditLog.count({ where: { action: "treasury.document_generated" } }), 2);

    const rev = await svc.reverseTreasuryTransaction({ transactionId: wd2.id, createdById: userId });
    assert.match(await redirectOf(docActions.generateDocumentAction("ar", vWd.id, fd({ entityId: wd2.id }))), /TRANSACTION_NOT_ELIGIBLE/, "reversed original");
    assert.match(await redirectOf(docActions.generateDocumentAction("fr", vDep.id, fd({ entityId: rev.id }))), /TRANSACTION_NOT_ELIGIBLE/, "reversal entry");
    assert.equal(await db.generatedDocument.count(), 2);
  });

  test("Document generation permissions + atomicity + download authorization", async () => {
    const { id } = await expenseActions.createExpenseAction(expenseForm(base.s1));
    await expenseActions.postExpenseAction(id);
    const version = await seedVersion("EXPENSE_STATEMENT", "fr", EXPENSE_MAP);
    const gen = () => docActions.generateDocumentAction("fr", version.id, fd({ entityId: id }));

    authMock.session.user.permissions = ["documents.generate"]; // coach-like: has documents.generate, not finance.*
    assert.match(await redirectOf(gen()), /ERR:Forbidden.*finance\.approve/);
    authMock.session.user.permissions = ["finance.approve", "finance.view"];
    assert.match(await redirectOf(gen()), /ERR:Forbidden.*documents\.generate/);
    authMock.signedOut.value = true;
    assert.match(await redirectOf(gen()), /ERR:Unauthenticated/);
    authMock.signedOut.value = false;
    assert.equal(await db.generatedDocument.count(), 0);

    // atomicity: failing audit => no GeneratedDocument row and no orphan file
    authMock.session.user.permissions = FULL;
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit blocked'; END; $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_fail_audit_trg BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION test_fail_audit()`);
    const filesBefore = storageMock.files.size;
    try {
      assert.match(await redirectOf(gen()), /ERR:[\s\S]*audit blocked/); // Prisma's message spans several lines
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_audit_trg ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_audit()`);
    }
    assert.equal(await db.generatedDocument.count(), 0);
    assert.equal(storageMock.files.size, filesBefore, "uploaded file removed when the record could not be committed");

    // download route
    assert.match(await redirectOf(gen()), /generated-documents\/[^/?]+$/);
    const g = await db.generatedDocument.findFirstOrThrow({});
    const call = (docId = g.id) => downloadRoute.GET(null, { params: Promise.resolve({ id: docId }) });
    assert.equal((await call()).status, 302);
    authMock.session.user.permissions = ["documents.generate"];
    assert.equal((await call()).status, 403);
    authMock.session.user.permissions = ["finance.view"];
    assert.equal((await call()).status, 403);
    assert.equal((await call("does-not-exist")).status, 404);
    authMock.signedOut.value = true;
    assert.equal((await call()).status, 401);
  });
});
