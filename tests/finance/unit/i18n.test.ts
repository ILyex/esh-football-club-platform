import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Runtime-usage coverage for the Arabic/French catalogs (not just key parity): every value the finance UI can
// render through a dynamic key — enum labels, domain error codes, insight/notification texts — must exist and be
// non-empty in BOTH locales.

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const messages: Record<string, any> = { ar: JSON.parse(read("src/i18n/messages/ar.json")), fr: JSON.parse(read("src/i18n/messages/fr.json")) };
const get = (o: any, path: string) => path.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
const schema = read("prisma/schema.prisma");
const enumValues = (name: string) =>
  [...schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))![1]!.matchAll(/^\s+([A-Z][A-Z0-9_]+)\s*(?:\/\/.*)?$/gm)].map((m) => m[1]!);
function leaves(o: any, prefix = ""): [string, unknown][] {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]]));
}
function need(path: string, values: string[]) {
  for (const locale of ["ar", "fr"]) for (const v of values) {
    const text = get(messages[locale], `${path}.${v}`);
    assert.ok(typeof text === "string" && text.trim().length > 0, `${locale}: missing ${path}.${v}`);
  }
}
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(n) && out.push(p); }
  return out;
}

test("Arabic and French catalogs have exactly the same keys, no empty values, and balanced ICU braces", () => {
  const ar = new Map(leaves(messages.ar)), fr = new Map(leaves(messages.fr));
  assert.deepEqual([...ar.keys()].filter((k) => !fr.has(k)), [], "keys only in ar");
  assert.deepEqual([...fr.keys()].filter((k) => !ar.has(k)), [], "keys only in fr");
  for (const [locale, map] of [["ar", ar], ["fr", fr]] as const) for (const [k, v] of map) {
    assert.ok(typeof v === "string" && v.trim() !== "", `${locale}.${k} is empty`);
    let depth = 0;
    for (const ch of v as string) { depth += ch === "{" ? 1 : ch === "}" ? -1 : 0; assert.ok(depth >= 0, `${locale}.${k}: unbalanced braces`); }
    assert.equal(depth, 0, `${locale}.${k}: unbalanced braces`);
    if ((v as string).includes("select,")) assert.ok((v as string).includes("other {"), `${locale}.${k}: select without 'other'`);
  }
});
test("every enum the finance pages render through a dynamic key has a label in both locales", () => {
  need("finance.categories", enumValues("ExpenseCategory"));
  need("finance.paymentMethods", enumValues("PaymentMethod"));
  need("finance.expenseStatuses", enumValues("ExpenseStatus"));
  need("finance.budgetStatuses", enumValues("BudgetStatus"));
  need("finance.accountTypes", enumValues("TreasuryAccountType"));
  need("finance.transactionTypes", enumValues("TreasuryTransactionType"));
  need("finance.paymentStates", ["NONE", "PAID", "REVERSED"]);
  need("templates.types", enumValues("TemplateType"));
  need("teams.categories", enumValues("TeamCategory"));
  need("generatedDocuments.entityTypes", ["Match", "MeetingMinute", "Correspondence", "Expense", "TreasuryTransaction"]);
  need("dashboard.nav", ["budgets", "expenses", "treasury"]);
  need("dashboard.navGroups", ["finance"]);
});
test("every domain error code and every literal finance notice key used by the code is translated", () => {
  const codes = [...read("src/lib/finance/action-notice.ts").match(/FINANCE_ERROR_CODES = \[([\s\S]*?)\] as const/)![1]!.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);
  need("finance.errors", [...codes, "VALIDATION", "NOT_FOUND", "DOCUMENT_EXPENSE_NOT_POSTED", "DOCUMENT_TRANSACTION_NOT_ELIGIBLE", "DOCUMENT_WRONG_TRANSACTION_TYPE"]);
  const sources = walk(join(ROOT, "src")).filter((p) => /finance|entity-data-resolvers/.test(p)).map((p) => readFileSync(p, "utf8")).join("\n");
  // every Error("CODE") / FinanceError("CODE") thrown by finance code must be a code the UI can translate
  const thrown = new Set([...sources.matchAll(/(?:new Error|new FinanceError)\("([A-Z_]{4,})"/g)].map((m) => m[1]!));
  assert.deepEqual([...thrown].filter((c) => !codes.includes(c)), [], "thrown codes without a notice mapping");
  for (const key of new Set([...sources.matchAll(/"(finance\.(?:errors|success)\.[A-Za-z_]+)"/g)].map((m) => m[1]!))) need(key.split(".").slice(0, -1).join("."), [key.split(".").pop()!]);
});
test("every insight type has a text and a label; every notifiable type is renderable per viewer locale", () => {
  const types = [...read("src/lib/insights/rules.ts").match(/export type InsightType =([\s\S]*?);/)![1]!.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);
  need("insights.types", types);
  need("insights.typeLabels", types);
  const notifiable = [...read("src/lib/insights/notifications.ts").matchAll(/notificationType: "([A-Z_]+)"/g)].map((m) => m[1]!);
  need("insights.types", notifiable);
  const enumNames = enumValues("NotificationType");
  assert.deepEqual(notifiable.filter((n) => !enumNames.includes(n)), [], "notifiable types missing from the NotificationType enum");
});
