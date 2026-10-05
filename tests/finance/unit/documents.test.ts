import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { store, reset, faults } from "../mocks/db";
import { session, signedOut } from "../mocks/auth";
import { files, storageLog } from "../mocks/storage";
import { aiCalls } from "../mocks/ai";
import { Redirect } from "../mocks/next-navigation";
import { generateDocumentAction, improveFieldAction } from "@/app/[locale]/(dashboard)/dashboard/generated-documents/actions";
import { GET as downloadGenerated } from "@/app/api/generated-documents/[id]/download/route";
import { postTreasuryMovement, reverseTreasuryTransaction } from "@/lib/finance/treasury-service";

const TEMPLATE_TEXT = "REF={{REF}};AMOUNT={{AMOUNT}};CAT={{CAT}};PAID={{PAYREF}};NOTE={{NOTE}};DATE={{DATE}};CLUB={{CLUB}}";
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const run = async (p: Promise<any>) => p.then(() => "no-redirect", (e) => (e instanceof Redirect ? e.url : `ERR:${e.message}`));
const coach = ["documents.generate"];
const treasurer = ["documents.generate", "finance.approve", "finance.view"];

function seedVersion(id: string, type: string, mappings: [string, string, string | null][], lang = "fr") {
  files.set(`tpl/${id}.docx`, Buffer.from(TEMPLATE_TEXT));
  store.documentTemplateVersion!.push({
    id, status: "ACTIVE", storageKey: `tpl/${id}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    template: { type, language: lang, name: `T-${id}` },
    fieldMappings: mappings.map(([placeholder, sourceType, sourcePath]) => ({ placeholder, sourceType, sourcePath }))
  });
}
const EXPENSE_MAP: [string, string, string | null][] = [["REF", "DATABASE_FIELD", "expense.referenceNumber"], ["AMOUNT", "DATABASE_FIELD", "expense.amountFormatted"], ["CAT", "DATABASE_FIELD", "expense.category"], ["PAYREF", "DATABASE_FIELD", "payment.referenceNumber"], ["DATE", "DATABASE_FIELD", "expense.date"], ["CLUB", "DATABASE_FIELD", "club.name"], ["NOTE", "MANUAL_INPUT", null]];
const TX_MAP: [string, string, string | null][] = [["REF", "DATABASE_FIELD", "transaction.referenceNumber"], ["AMOUNT", "DATABASE_FIELD", "transaction.amountFormatted"], ["CAT", "DATABASE_FIELD", "transaction.type"], ["PAYREF", "DATABASE_FIELD", "account.name"], ["DATE", "DATABASE_FIELD", "transaction.date"], ["CLUB", "DATABASE_FIELD", "club.name"], ["NOTE", "AI_ASSISTED", null]];

beforeEach(() => {
  reset(); faults.auditCreate = false; files.clear(); storageLog.length = 0; aiCalls.length = 0; signedOut.value = false;
  // Model the authoritative DB-backed role row used by team scope checks.
  store.role!.push({ key: "treasurer", teamScoped: false });
  session.user = { id: "u1", name: "T", email: "", roleKey: "treasurer", roleName: "", permissions: treasurer };
  store.clubSettings!.push({ id: "singleton", name: "Espoir Sidi Hosni", shortName: "ESH" });
  store.treasuryAccount!.push({ id: "acc1", name: "Caisse", type: "CASH", currency: "DZD", openingBalance: 100000, active: true });
  store.expense!.push({ id: "e-posted", referenceNumber: "EXP-2026-AAAA", amount: 12500, category: "TRANSPORT", date: new Date("2026-09-01T00:00:00Z"), description: "Bus", payeeName: "SARL", paymentMethod: "CASH", status: "POSTED", notes: null, team: null, season: { label: "2026/2027" }, budget: null, relatedMatch: null, relatedTraining: null },
    { id: "e-draft", referenceNumber: "EXP-2026-BBBB", amount: 10, category: "FOOD", date: new Date("2026-09-01T00:00:00Z"), description: "d", status: "DRAFT", season: { label: "2026/2027" }, team: null, budget: null });
  seedVersion("v-exp", "EXPENSE_STATEMENT", EXPENSE_MAP);
  seedVersion("v-dep", "DEPOSIT_RECEIPT", TX_MAP);
  seedVersion("v-wd", "WITHDRAWAL_RECEIPT", TX_MAP, "ar");
});

test("EXPENSE_STATEMENT: values come from the DB (fr), hostile form values for authoritative placeholders are ignored, manual field kept, no placeholder remains", async () => {
  const url = await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted", field_AMOUNT: "999999", field_REF: "FAKE", field_NOTE: "Note manuelle", ai_NOTE: "1" })));
  assert.match(url, /^\/fr\/dashboard\/generated-documents\/.+/);
  const g = store.generatedDocument![0]!;
  const out = files.get(g.storageKey)!.toString("utf8");
  assert.equal(out, `REF=EXP-2026-AAAA;AMOUNT=12\u00A0500;CAT=Transport;PAID=;NOTE=Note manuelle;DATE=1 septembre 2026;CLUB=Espoir Sidi Hosni`);
  assert.ok(!out.includes("{{"), "no unresolved placeholder");
  assert.equal(files.get("tpl/v-exp.docx")!.toString(), TEMPLATE_TEXT, "stored template untouched");
  assert.equal(g.relatedEntityType, "Expense"); assert.equal(g.relatedEntityId, "e-posted");
  assert.equal(g.aiUsed, false, "financial types never record AI use, even if the form claims it");
  assert.equal(g.createdById, "u1");
  assert.deepEqual(store.auditLog!.map((a) => [a.action, a.entityType, a.entityId]), [["document.generate", "GeneratedDocument", g.id], ["expense.document_generated", "Expense", "e-posted"]]);
});
test("EXPENSE_STATEMENT in Arabic uses Arabic labels; a paid expense prints its payment reference", async () => {
  seedVersion("v-exp-ar", "EXPENSE_STATEMENT", EXPENSE_MAP, "ar");
  store.treasuryTransaction!.push({ id: "t1", referenceNumber: "WD-2026-CCCC", type: "WITHDRAWAL", amount: 12500, relatedExpenseId: "e-posted", treasuryAccountId: "acc1", transactionDate: new Date("2026-09-02T00:00:00Z"), reversalOfTransactionId: null });
  await run(generateDocumentAction("ar", "v-exp-ar", fd({ entityId: "e-posted" })));
  const out = files.get(store.generatedDocument![0]!.storageKey)!.toString("utf8");
  assert.match(out, /CAT=نقل;PAID=WD-2026-CCCC;/);
});
test("EXPENSE_STATEMENT is refused for DRAFT (notice, nothing stored, no audit)", async () => {
  const url = await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-draft" })));
  assert.match(url, /new\/v-exp\?notice=finance\.errors\.DOCUMENT_EXPENSE_NOT_POSTED/);
  assert.equal(store.generatedDocument!.length, 0); assert.equal(store.auditLog!.length, 0); assert.equal(files.size, 3);
});
test("receipts: WITHDRAWAL/DEPOSIT eligibility — wrong direction, reversed original and reversal entry are all refused; valid ones succeed", async () => {
  const w = await postTreasuryMovement({ treasuryAccountId: "acc1", type: "WITHDRAWAL", amount: 3000, transactionDate: new Date("2026-09-02T00:00:00Z"), idempotencyKey: "a", createdById: "u1" });
  const d = await postTreasuryMovement({ treasuryAccountId: "acc1", type: "DEPOSIT", amount: 500, transactionDate: new Date("2026-09-02T00:00:00Z"), idempotencyKey: "b", createdById: "u1" });
  store.auditLog!.length = 0;
  assert.match(await run(generateDocumentAction("fr", "v-dep", fd({ entityId: w.id }))), /WRONG_TRANSACTION_TYPE/);
  assert.match(await run(generateDocumentAction("fr", "v-wd", fd({ entityId: d.id }))), /WRONG_TRANSACTION_TYPE/);
  assert.match(await run(generateDocumentAction("ar", "v-wd", fd({ entityId: w.id }))), /^\/ar\/dashboard\/generated-documents\//);
  const wdDoc = files.get(store.generatedDocument![0]!.storageKey)!.toString("utf8");
  assert.match(wdDoc, new RegExp(`REF=${w.referenceNumber};AMOUNT=3\u00A0000;CAT=سحب;PAID=Caisse;NOTE=;`));
  const rev = await reverseTreasuryTransaction({ transactionId: w.id, createdById: "u1" });
  assert.match(await run(generateDocumentAction("fr", "v-wd", fd({ entityId: w.id }))), /TRANSACTION_NOT_ELIGIBLE/, "reversed original");
  assert.match(await run(generateDocumentAction("fr", "v-dep", fd({ entityId: rev.id }))), /TRANSACTION_NOT_ELIGIBLE/, "reversal entry");
  assert.match(await run(generateDocumentAction("fr", "v-dep", fd({ entityId: d.id }))), /^\/fr\/dashboard\/generated-documents\//);
  const receiptAudit = store.auditLog!.filter((a) => a.action === "treasury.document_generated");
  assert.deepEqual(receiptAudit.map((a) => a.entityId), [w.id, d.id]);
  assert.equal(store.generatedDocument!.filter((g) => g.relatedEntityType === "TreasuryTransaction").length, 2);
});
test("AI is never applied to financial documents (improve action is a no-op for them)", async () => {
  const url = await run(improveFieldAction("fr", "v-dep", "NOTE", fd({ entityId: "x", field_NOTE: "brouillon" })));
  assert.match(url, /new\/v-dep\?/); assert.equal(aiCalls.length, 0);
});
test("permissions: documents.generate alone (coach) cannot generate/improve financial documents; missing documents.generate cannot either; unauthenticated rejected", async () => {
  session.user.permissions = coach;
  assert.match(await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted" }))), /ERR:Forbidden.*finance\.approve/);
  assert.match(await run(improveFieldAction("fr", "v-exp", "NOTE", fd({ entityId: "e-posted" }))), /ERR:Forbidden.*finance\.approve/);
  session.user.permissions = ["finance.approve", "finance.view"];
  assert.match(await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted" }))), /ERR:Forbidden.*documents\.generate/);
  signedOut.value = true;
  assert.match(await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted" }))), /ERR:Unauthenticated/);
  assert.equal(store.generatedDocument!.length, 0);
});
test("atomicity: if the audit insert fails, no GeneratedDocument row remains and the uploaded file is deleted", async () => {
  faults.auditCreate = true;
  const before = files.size;
  assert.match(await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted" }))), /ERR:audit insert failed/);
  assert.equal(store.generatedDocument!.length, 0);
  assert.equal(files.size, before, "orphan file removed");
  assert.ok(storageLog.some((l) => l.startsWith("del ")));
});
test("download route: 401 signed out, 403 without documents.generate or without finance.view, 404 unknown, 302 + audit when allowed; legacy (non-financial) documents keep the base rule", async () => {
  await run(generateDocumentAction("fr", "v-exp", fd({ entityId: "e-posted" })));
  const id = store.generatedDocument![0]!.id;
  const call = (docId = id) => downloadGenerated(null as any, { params: Promise.resolve({ id: docId }) });
  store.auditLog!.length = 0;
  assert.equal((await call()).status, 302);
  assert.deepEqual(store.auditLog!.map((a) => a.action), ["generatedDocument.download"]);
  session.user.permissions = coach; // documents.generate but no finance.view
  assert.equal((await call()).status, 403);
  assert.ok(store.auditLog!.some((a) => a.action === "generatedDocument.download_denied"));
  session.user.permissions = ["finance.view"]; // finance.view but no documents.generate
  assert.equal((await call()).status, 403);
  assert.equal((await call("nope")).status, 404);
  signedOut.value = true;
  assert.equal((await call()).status, 401);
  // a non-financial generated document is unaffected by the finance gate
  store.generatedDocument!.push({ id: "legacy", relatedEntityType: "Match", relatedEntityId: "m", storageKey: "generated/legacy.docx" });
  signedOut.value = false; session.user.permissions = coach;
  assert.equal((await call("legacy")).status, 302);
});
