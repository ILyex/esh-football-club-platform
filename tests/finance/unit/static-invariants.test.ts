import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Source-level guards for the Finance invariants that are true "by construction". They read the repository
// files (no database, no framework) so they run everywhere and fail loudly if someone later adds a bypass.

const ROOT = join(__dirname, "..", "..", "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    if (dir === join(ROOT, "src") && name === "generated") continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(name) && out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).split("\\").join("/");
const sources = [...walk(join(ROOT, "src")), join(ROOT, "prisma", "seed.ts")].map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
// Comments are stripped: several columns carry "never Float" style remarks that must not trip the checks.
const model = (name: string) => schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))![0].replace(/\/\/.*$/gm, "");
const SERVICE = "src/lib/finance/treasury-service.ts";

test("TreasuryTransaction is written only inside treasury-service.ts (direct, nested and raw SQL)", () => {
  const direct = /treasuryTransaction\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
  const nested = /(transactions|treasuryTransaction)\s*:\s*\{\s*(create|createMany|connectOrCreate|update|upsert|delete)\b/;
  const raw = /\$(execute|query)Raw(Unsafe)?[\s\S]{0,300}TreasuryTransaction/i;
  const offenders = sources.filter((s) => s.path !== SERVICE && (direct.test(s.text) || nested.test(s.text) || raw.test(s.text))).map((s) => s.path);
  assert.deepEqual(offenders, []);
  assert.ok(direct.test(sources.find((s) => s.path === SERVICE)!.text), "sanity: the service does write the ledger");
});
test("the ledger service never updates or deletes a TreasuryTransaction (posted rows are immutable)", () => {
  const service = sources.find((s) => s.path === SERVICE)!.text;
  assert.ok(!/treasuryTransaction\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/.test(service));
});
test("money columns are Int; there is no Float/Decimal and no stored balance on any finance model", () => {
  for (const m of ["Budget", "Expense", "TreasuryAccount", "TreasuryTransaction"]) {
    const body = model(m);
    assert.ok(!/\b(Float|Decimal)\b/.test(body), `${m} must not use Float/Decimal`);
  }
  assert.match(model("Budget"), /allocatedAmount\s+Int\b/);
  assert.match(model("Expense"), /\bamount\s+Int\b/);
  assert.match(model("TreasuryTransaction"), /\bamount\s+Int\b/);
  assert.match(model("TreasuryAccount"), /openingBalance\s+Int\b/);
  assert.ok(!/(current|cached|running)Balance|\bbalance\s+Int/i.test(model("TreasuryAccount")), "no mutable balance field on TreasuryAccount");
});
test("database-level uniqueness backs the invariants (idempotency key, one payment per expense, one reversal per transaction)", () => {
  const tx = model("TreasuryTransaction");
  assert.match(tx, /idempotencyKey\s+String\s+@unique/);
  assert.match(tx, /relatedExpenseId\s+String\?\s+@unique/);
  assert.match(tx, /reversalOfTransactionId\s+String\?\s+@unique/);
});
test("no floating-point money arithmetic in finance code", () => {
  const files = sources.filter((s) => /finance|insights\/finance-rules|validations\/finance/.test(s.path) && !s.path.startsWith("tests/"));
  const offenders = files.filter((s) => /parseFloat|\.toFixed\(|Math\.round\([^)]*\/[^)]*\)/.test(s.text.replace(/\/\/.*$/gm, ""))).map((s) => s.path);
  // Budget list/detail render a *display-only* utilisation percentage with Math.round(spent / allocated * 100); it never feeds money.
  const allowed = new Set(["src/app/[locale]/(dashboard)/dashboard/finance/budgets/page.tsx", "src/app/[locale]/(dashboard)/dashboard/finance/budgets/[id]/page.tsx"]);
  assert.deepEqual(offenders.filter((p) => !allowed.has(p)), []);
});
test("every exported finance server action authorizes server-side before doing anything", () => {
  const actionFiles = sources.filter((s) => /dashboard\/finance\/.*\/actions\.ts$/.test(s.path));
  assert.equal(actionFiles.length, 3);
  for (const f of actionFiles) {
    const fns = [...f.text.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}\n/g)];
    assert.ok(fns.length > 0, f.path);
    for (const [, name, body] of fns) assert.match(body!.slice(0, 200), /await requirePermission\("finance\.(view|manage|approve)"\)/, `${f.path}: ${name}`);
  }
});
test("every finance page enforces a permission on the server (direct URL / direct ID access)", () => {
  const pages = sources.filter((s) => /dashboard\/finance\/.*page\.tsx$/.test(s.path));
  assert.ok(pages.length >= 10, `expected the finance pages, found ${pages.length}`);
  for (const p of pages) assert.match(p.text, /await requirePermission\("finance\.(view|manage)"\)/, p.path);
});
test("generated-document surfaces inherit the entity read permission (list, detail, download)", () => {
  const listAlias = sources.find((s) => s.path === "src/app/[locale]/(dashboard)/dashboard/generated-documents/page.tsx")!.text;
  assert.match(listAlias, /redirect\(`\/\$\{locale\}\/dashboard\/documents`\)/, "legacy list URL must redirect to the canonical protected documents surface");
  const canonicalDocuments = sources.find((s) => s.path === "src/app/[locale]/(dashboard)/dashboard/documents/page.tsx")!.text;
  assert.match(canonicalDocuments, /requirePermission\("documents\.view"\)/, "canonical list target must enforce read permission");
  for (const path of ["src/app/[locale]/(dashboard)/dashboard/generated-documents/[id]/page.tsx", "src/app/api/generated-documents/[id]/download/route.ts"]) {
    assert.match(sources.find((s) => s.path === path)!.text, /readPermissionForEntityType|forbiddenGeneratedEntityTypes/, path);
  }
  for (const path of ["src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts", "src/app/[locale]/(dashboard)/dashboard/generated-documents/new/[versionId]/page.tsx"]) {
    assert.match(sources.find((s) => s.path === path)!.text, /requireResolverPermission/, path);
  }
});
test("all finance mutations write their audit row inside the transaction (writeAuditLog(..., tx))", () => {
  for (const path of ["src/app/[locale]/(dashboard)/dashboard/finance/expenses/actions.ts", "src/app/[locale]/(dashboard)/dashboard/finance/budgets/actions.ts", "src/app/[locale]/(dashboard)/dashboard/finance/treasury/actions.ts", "src/lib/finance/treasury-service.ts", "src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts"]) {
    const text = sources.find((s) => s.path === path)!.text;
    const calls = [...text.matchAll(/writeAuditLog\(([\s\S]*?)\n?\s*\)(?:;|\n)/g)];
    assert.ok(calls.length > 0, path);
    for (const c of calls) assert.match(c[0], /,\s*tx\s*\)/, `${path}: audit call without tx: ${c[0].slice(0, 80)}`);
  }
});
