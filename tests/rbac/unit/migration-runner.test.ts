import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// STATIC / SYNTHETIC TESTS FOR THE P1 MIGRATION RUNNER
// ----------------------------------------------------------------------------
// This sandbox has no PowerShell (`pwsh`/`powershell` are both absent) and no
// Windows cmd.exe, so scripts/rbac-p1-migration.cmd and its .ps1 helpers
// cannot actually be EXECUTED here — only the user's Windows machine can do
// that (see scripts/rbac-p1-migration.cmd's own header and the delivery
// report). This file does two different, both honest, things instead:
//
//  1. Re-implements the two PowerShell helpers' ALGORITHMS in TypeScript,
//     line-for-line matching their .ps1 counterparts (cross-referenced by
//     comment), and tests THAT reimplementation against synthetic inputs
//     chosen to probe the exact edge cases the hardening pass was about
//     (a database name that only shares a substring with "test", FK
//     REFERENCES clauses that must not be mistaken for ALTER/CREATE targets,
//     etc.). This proves the ALGORITHM is correct; it does not prove
//     PowerShell will execute it identically, which is why every test in
//     this section is prefixed "logic:" rather than claiming to test the
//     .ps1 file itself.
//
//  2. Reads the ACTUAL shipped .cmd/.ps1 files and asserts structural
//     properties on their real source — e.g. "no line uses `enabledelayed
//     expansion`", "every `migrate deploy` invocation is immediately
//     followed by an exit-code capture and a fail-closed branch before the
//     next `prisma generate`". These tests run against the real delivered
//     files, so a future edit that reintroduces a bug like the previous
//     missing `>>` redirect (found and fixed during this hardening pass)
//     would fail here, not just rely on a human re-reading the file.
// ============================================================================

const ROOT = join(__dirname, "..", "..", "..");
const cmdSource = readFileSync(join(ROOT, "scripts/rbac-p1-migration.cmd"), "utf8");
const verifySqlPs1 = readFileSync(join(ROOT, "scripts/verify-p1-sql.ps1"), "utf8");
const checkDbTargetPs1 = readFileSync(join(ROOT, "scripts/check-database-target.ps1"), "utf8");
const checkContractPs1 = readFileSync(join(ROOT, "scripts/check-contract-unchanged.ps1"), "utf8");

// ---------------------------------------------------------------------------
// Part 1a: logic reimplementation — check-database-target.ps1's database-name
// extraction and comparison (see that file's own body for the PowerShell).
// ---------------------------------------------------------------------------
function extractDatabaseName(url: string): string | null {
  try {
    const u = new URL(url);
    const name = u.pathname.replace(/^\//, "");
    return name || null;
  } catch {
    return null;
  }
}
function databaseNameMatches(url: string, expected: string): boolean {
  const name = extractDatabaseName(url);
  return name !== null && name.toLowerCase() === expected.toLowerCase();
}

test("logic: database-target check accepts the exact expected test database name", () => {
  assert.equal(databaseNameMatches("postgresql://u:p@host/football_club_test?sslmode=require", "football_club_test"), true);
});
test("logic: database-target check accepts query strings after the database name (sslmode, channel_binding)", () => {
  assert.equal(databaseNameMatches("postgresql://u:p@host/football_club_test?sslmode=require&channel_binding=require", "football_club_test"), true);
});
test("logic: database-target check is the fix for the exact gap the old substring check had — rejects a database that merely CONTAINS the word 'test'", () => {
  // This is the concrete regression this hardening pass closes: the OLD guard was `findstr "test"`,
  // which would have wrongly ACCEPTED this URL. The new check must reject it.
  assert.equal(databaseNameMatches("postgresql://u:p@host/some_other_testing_db", "football_club_test"), false);
});
test("logic: database-target check rejects the production-looking database name", () => {
  assert.equal(databaseNameMatches("postgresql://u:p@host/football_club", "football_club_test"), false);
});
test("logic: database-target check tolerates '!' and URL-encoded characters in the credentials without affecting the extracted name", () => {
  assert.equal(databaseNameMatches("postgresql://user:p%40ss!word@host/football_club_test", "football_club_test"), true);
});
test("logic: database-target check is case-insensitive on the database name", () => {
  assert.equal(databaseNameMatches("postgresql://u:p@host/Football_Club_Test", "football_club_test"), true);
});

// ---------------------------------------------------------------------------
// Part 1b: logic reimplementation — verify-p1-sql.ps1's table-touched
// allowlist, DROP detection, and Contract-mention detection.
// ---------------------------------------------------------------------------
const ALLOWED_TABLES = new Set(["Role", "Staff", "UserTeam", "StaffTeam"]);
type SqlVerifyResult = { ok: true; touched: string[] } | { ok: false; reason: "DROP_FOUND" | "CONTRACT_MENTIONED" | "UNEXPECTED_TABLES" | "NO_CHANGES_DETECTED"; detail?: string };
function verifyP1Sql(sql: string): SqlVerifyResult {
  const touched = new Set<string>();
  for (const m of sql.matchAll(/^\s*ALTER TABLE\s+"(\w+)"/gim)) touched.add(m[1]!);
  for (const m of sql.matchAll(/^\s*CREATE TABLE\s+"(\w+)"/gim)) touched.add(m[1]!);
  if (/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i.test(sql)) return { ok: false, reason: "DROP_FOUND" };
  if (/"Contract"/i.test(sql)) return { ok: false, reason: "CONTRACT_MENTIONED" };
  const unexpected = [...touched].filter((t) => !ALLOWED_TABLES.has(t));
  if (unexpected.length > 0) return { ok: false, reason: "UNEXPECTED_TABLES", detail: unexpected.join(",") };
  if (touched.size === 0) return { ok: false, reason: "NO_CHANGES_DETECTED" };
  return { ok: true, touched: [...touched] };
}

const REALISTIC_P1_SQL = `
-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "teamScoped" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "UserTeam" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "StaffTeam" (
    "staffId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "StaffTeam_pkey" PRIMARY KEY ("staffId","teamId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTeam" ADD CONSTRAINT "StaffTeam_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTeam" ADD CONSTRAINT "StaffTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

test("logic: a realistic P1 SQL (matching exactly what Prisma would emit for the 4 approved changes) passes verification", () => {
  const result = verifyP1Sql(REALISTIC_P1_SQL);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.touched.sort(), ["Role", "StaffTeam", "Staff", "UserTeam"].sort());
});
test("logic: FK REFERENCES clauses pointing at User/Team are correctly NOT counted as touched tables (the exact false-positive a naive keyword grep would produce)", () => {
  const result = verifyP1Sql(REALISTIC_P1_SQL);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.touched.includes("User"), false);
    assert.equal(result.touched.includes("Team"), false);
  }
});
test("logic: a DROP statement anywhere fails verification, even amid otherwise-valid SQL", () => {
  const result = verifyP1Sql(REALISTIC_P1_SQL + '\nDROP TABLE "SomethingElse";\n');
  assert.deepEqual(result, { ok: false, reason: "DROP_FOUND" });
});
test("logic: any mention of \"Contract\" fails verification", () => {
  const result = verifyP1Sql(REALISTIC_P1_SQL + '\nALTER TABLE "Contract" ADD COLUMN "x" TEXT;\n');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "CONTRACT_MENTIONED");
});
test("logic: an ALTER/CREATE on any table outside the allowlist fails verification", () => {
  const result = verifyP1Sql(REALISTIC_P1_SQL + '\nCREATE TABLE "Expense" ("id" TEXT NOT NULL);\n');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "UNEXPECTED_TABLES");
    assert.equal(result.detail, "Expense");
  }
});
test("logic: empty/no-op SQL fails verification (a migration that changes nothing is itself suspicious here)", () => {
  assert.deepEqual(verifyP1Sql("-- no changes\n"), { ok: false, reason: "NO_CHANGES_DETECTED" });
});

// ---------------------------------------------------------------------------
// Part 2: structural assertions on the ACTUAL shipped .cmd / .ps1 source —
// these run against the real files, so a future edit that reintroduces a bug
// found during this hardening pass would fail here, not just rely on a
// human re-reading the diff.
// ---------------------------------------------------------------------------

test("the .cmd script does not use enabledelayedexpansion (any '!' in the connection string must stay a literal character)", () => {
  const codeLines = cmdSource.split("\n").filter((l) => !l.trim().toUpperCase().startsWith("REM"));
  assert.equal(codeLines.some((l) => /enabledelayedexpansion/i.test(l)), false, "enabledelayedexpansion found outside a comment");
});

test("every '===== N. ...' section header echo is redirected into %REPORT% (regression guard for the missing '>>' bug found in this pass)", () => {
  // Require a space then a non-'=' character right after the opening "===== " so purely
  // decorative banner lines (echo ===============...) are correctly excluded — they are
  // meant for the interactive console prompt, not the report.
  const headers = [...cmdSource.matchAll(/^echo ===== [^=\s].*$/gm)];
  assert.ok(headers.length >= 10, `expected many section headers, found ${headers.length}`);
  for (const h of headers) assert.match(h[0], />> %REPORT%/, `missing redirect: ${h[0]}`);
});

test("DATABASE_URL_TEST is never piped through an unquoted echo (the old, removed, unsafe pattern)", () => {
  assert.equal(/echo %DATABASE_URL_TEST%\s*\|/.test(cmdSource), false);
});

test("every remaining use of %DATABASE_URL_TEST% as a command argument is inside double quotes", () => {
  const lines = cmdSource
    .split("\n")
    .filter((l) => l.includes("%DATABASE_URL_TEST%") && !l.trim().toUpperCase().startsWith("REM"));
  assert.ok(lines.length >= 3, `expected several usages, found ${lines.length}`);
  for (const line of lines) {
    const isPlainAssignment = /^\s*set DATABASE_URL=%DATABASE_URL_TEST%\s*$/.test(line);
    const isQuoted = /"[^"]*%DATABASE_URL_TEST%[^"]*"/.test(line);
    assert.ok(isPlainAssignment || isQuoted, `unquoted, non-assignment use of DATABASE_URL_TEST: ${line}`);
  }
});

test("the strict database-name check (check-database-target.ps1) is invoked before DATABASE_URL is ever set, and its failure stops the script", () => {
  // Search only actual code lines — this file's own header comment explains the
  // DATABASE_URL fix using the literal quoted-assignment text, which would otherwise
  // be found first by a plain indexOf() long before the real guard/assignment lines.
  const codeOnly = cmdSource
    .split("\n")
    .map((l) => (l.trim().toUpperCase().startsWith("REM") ? "" : l))
    .join("\n");
  const checkIdx = codeOnly.indexOf("check-database-target.ps1");
  const setIdx = codeOnly.indexOf('set "DATABASE_URL=%DATABASE_URL_TEST%"');
  assert.ok(checkIdx > -1 && setIdx > -1, `checkIdx=${checkIdx}, setIdx=${setIdx}`);
  assert.ok(checkIdx < setIdx, "database-name check must run before DATABASE_URL is derived");
  const after = codeOnly.slice(checkIdx, setIdx);
  assert.match(after, /goto :fail_report/);
});

test("the DATABASE_URL assignment uses the quoted form (set \"VAR=value\"), not a bare unquoted assignment", () => {
  assert.equal(/^set DATABASE_URL=%DATABASE_URL_TEST%\s*$/m.test(cmdSource), false, "found the old unquoted assignment form");
  assert.match(cmdSource, /set "DATABASE_URL=%DATABASE_URL_TEST%"/);
});

test("migrate deploy's exit code is captured and checked BEFORE prisma generate/tsc/build/tests run (fail-closed after migration)", () => {
  // Search for the actual invocation (npx prisma migrate deploy), not the bare phrase
  // "prisma migrate deploy", which also appears in this file's own explanatory comments.
  const deployIdx = cmdSource.indexOf("npx prisma migrate deploy");
  assert.ok(deployIdx > -1, "no actual 'npx prisma migrate deploy' invocation found");
  const after = cmdSource.slice(deployIdx, deployIdx + 1500);
  assert.match(after, /set DEPLOY_RESULT=%ERRORLEVEL%/, "exit code not captured immediately");
  assert.match(after, /if not "%DEPLOY_RESULT%"=="0"/, "exit code not checked immediately");
  const gateIdx = after.indexOf('if not "%DEPLOY_RESULT%"=="0"');
  const failGotoIdx = after.indexOf("goto :fail_report", gateIdx);
  // Search for the actual next invocation (npx prisma generate), not the bare phrase
  // "prisma generate", which this script's own failure message legitimately mentions
  // in prose ("NOT running prisma generate...") before its goto :fail_report.
  const generateIdx = after.indexOf("npx prisma generate", gateIdx);
  assert.ok(failGotoIdx > -1 && (generateIdx === -1 || failGotoIdx < generateIdx), "goto :fail_report on deploy failure must appear before the next actual prisma-generate invocation");
});

test("a P1 SQL that fails its own guard is quarantined (renamed, not deleted) before the script stops", () => {
  const guardIdx = cmdSource.indexOf("P1 SQL verification exit code");
  assert.ok(guardIdx > -1);
  const after = cmdSource.slice(guardIdx, guardIdx + 600);
  assert.match(after, /ren "prisma\\migrations\\%MIGDIR%" "%MIGDIR%_REJECTED"/, "rejected P1 migration must be renamed (quarantined), not left in place or deleted");
  assert.equal(/del\s+.*MIGDIR/i.test(after), false, "must never delete the rejected migration folder");
});

test("the three recovery markers are all written, and every write site is preceded by a real success/verification, not written speculatively", () => {
  for (const marker of [".baseline_resolved", ".p1_delta_ready", ".p1_deployed"]) {
    assert.ok(cmdSource.includes(marker), `marker ${marker} not referenced at all`);
  }
  // .baseline_resolved and .p1_delta_ready each have exactly one legitimate write site
  // (immediately after the one real operation that earns them).
  for (const marker of [".baseline_resolved", ".p1_delta_ready"]) {
    const writeCount = (cmdSource.match(new RegExp(`> prisma\\\\migrations\\\\${marker.replace(".", "\\.")}`, "g")) || []).length;
    assert.equal(writeCount, 1, `marker ${marker} should be written in exactly one place, found ${writeCount}`);
  }
  // .p1_deployed legitimately has THREE write sites in this hardened design: the normal
  // "deploy just succeeded" path, and two "resume discovered the DB already matches the
  // full P1 schema even though no marker was ever written" paths (one reached from
  // .p1_delta_ready, one from .baseline_resolved-only). Each of the three must be
  // immediately preceded by either a successful `migrate deploy` exit-code check or a
  // fresh POSTP1_STATE=="MATCH" check — never written unconditionally.
  const deployedWrites = [...cmdSource.matchAll(/> prisma\\migrations\\\.p1_deployed/g)];
  assert.equal(deployedWrites.length, 3, `expected exactly 3 legitimate .p1_deployed write sites (1 real deploy + 2 fresh-verified discoveries), found ${deployedWrites.length}`);
  for (const m of deployedWrites) {
    // Search backwards from the write with no arbitrary window limit — find the nearest
    // preceding guard of either kind and confirm it actually is the more recent one
    // (i.e. no unrelated write/reset happens between the guard and this write).
    const upTo = cmdSource.slice(0, m.index!);
    const deployGuardIdx = upTo.lastIndexOf('if not "%DEPLOY_RESULT%"=="0" (');
    const freshCheckGuardIdx = upTo.lastIndexOf('if "%POSTP1_STATE%"=="MATCH" (');
    const guardedByDeploy = deployGuardIdx > -1 && /echo migrate deploy succeeded\./.test(cmdSource.slice(deployGuardIdx, m.index!));
    const guardedByFreshCheck = freshCheckGuardIdx > -1 && /Discovery: the database ALREADY matches|Discovery: the database already matches/.test(cmdSource.slice(freshCheckGuardIdx, m.index!));
    assert.ok(guardedByDeploy || guardedByFreshCheck, `a .p1_deployed write site (at index ${m.index}) is not immediately preceded by a real success/verification check`);
  }

  // Every resume branch's marker CONDITION check (if exist ...) must still be present,
  // reached via a goto-chain rather than nested inside one shared block (see the
  // "goto-based" test below for the structural property that fixed the stale-value bug).
  for (const marker of [".p1_deployed", ".p1_delta_ready", ".baseline_resolved"]) {
    assert.match(cmdSource, new RegExp(`if not exist prisma\\\\migrations\\\\${marker.replace(".", "\\.")} goto :`), `no goto-guarded condition check found for ${marker}`);
  }
  assert.match(cmdSource, /none of the expected marker files/, "an unrecognized migrations-folder state must have an explicit fail-closed branch");
});

test("no variable is set and then read via %VAR% again within the same parenthesized block (the exact stale-value bug class found and fixed in this pass)", () => {
  // Re-implements the same scanner used during development to find this bug class,
  // as a permanent regression guard against reintroducing it.
  const lines = cmdSource.split("\n");
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/\($/.test(line.trimEnd()) && /\b(if|for|\) else)\b/.test(line)) {
      let depth = 0;
      const start = i;
      let j = i;
      const collected: string[] = [];
      while (j < lines.length) {
        depth += (lines[j]!.match(/\(/g) || []).length - (lines[j]!.match(/\)/g) || []).length;
        collected.push(lines[j]!);
        if (depth === 0) break;
        j++;
      }
      blocks.push(collected.join("\n"));
      i = j + 1;
    } else {
      i++;
    }
  }
  assert.ok(blocks.length >= 20, `expected many compound blocks, found ${blocks.length}`);
  const problems: string[] = [];
  for (const content of blocks) {
    const assigns = new Set([...content.matchAll(/set\s+(?:\/p\s+)?(\w+)=/g)].map((m) => m[1]!));
    for (const varName of assigns) {
      const marker = content.includes(`set ${varName}=`) ? `set ${varName}=` : `/p ${varName}=`;
      const assignPos = content.indexOf(marker);
      const rest = content.slice(assignPos + content.slice(assignPos).indexOf("\n"));
      if (rest.includes(`%${varName}%`)) problems.push(varName);
    }
  }
  assert.deepEqual(problems, [], `variables set-then-read within the same block (stale-value risk): ${problems.join(", ")}`);
});

test("the resume block never contains db push, migrate reset, or a delete of migration history", () => {
  const resumeStart = cmdSource.indexOf("RESUME:");
  const freshRunLabelMatch = /^:fresh_run\s*$/m.exec(cmdSource);
  const resumeBlock = cmdSource.slice(resumeStart, freshRunLabelMatch!.index);
  assert.ok(resumeBlock.length > 200, `resume block looks too short (${resumeBlock.length} chars)`);
  assert.equal(/db push/i.test(resumeBlock), false);
  assert.equal(/migrate reset/i.test(resumeBlock), false);
  assert.equal(/rmdir|del\s/i.test(resumeBlock), false);
});

test("the P1 delta is still generated only via migrate diff --from-schema-datamodel / --to-schema-datamodel (no migrate dev, no shadow database)", () => {
  const codeLines = cmdSource.split("\n").filter((l) => !l.trim().toUpperCase().startsWith("REM"));
  assert.equal(codeLines.some((l) => /migrate dev/.test(l)), false, "an actual 'migrate dev' invocation was found outside comments");
  assert.match(cmdSource, /migrate diff --from-schema-datamodel scripts\\reference-v3-schema\.prisma --to-schema-datamodel prisma\\schema\.prisma/);
});

test("no embedded multi-part 'powershell -Command \"...\" \"...\"' pattern remains anywhere (the fragile pattern replaced in the previous pass)", () => {
  assert.equal(/-Command "[^"]*"\s*\^\s*\n\s*"/.test(cmdSource), false);
});

test("all four PowerShell helper files are syntactically balanced (brace/paren/bracket/quote parity) — best-effort in the absence of a real PowerShell host", () => {
  for (const src of [verifySqlPs1, checkDbTargetPs1, checkContractPs1]) {
    for (const [open, close] of [["{", "}"], ["(", ")"], ["[", "]"]] as const) {
      let depth = 0;
      for (const ch of src) {
        if (ch === open) depth++;
        else if (ch === close) depth--;
      }
      assert.equal(depth, 0, `unbalanced ${open}${close} in a helper script`);
    }
    assert.equal(src.split('"').length % 2, 1, "double quotes must be balanced (odd split-length = even count)");
  }
});

// ---------------------------------------------------------------------------
// Part 2 continued: v6 blocker-fix regression guards
// ---------------------------------------------------------------------------

test("no echo line inside a parenthesized if-block contains an unescaped ')' that could prematurely close the block (CMD parser hazard fixed in v6)", () => {
  // Re-implements the scanner that found the two hazard sites at the former
  // lines 213 and 255 (both: `echo %DATE% %TIME% (recorded on resume...)>`).
  // An unescaped ')' inside `if (...) (` terminates the block early in CMD,
  // causing any redirection or goto on that same line to execute outside it.
  // The fix is to escape as `^(` / `^)` in the echo text.
  const lines = cmdSource.split("\n");
  let depth = 0;
  const violations: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const isRem = trimmed.toUpperCase().startsWith("REM");
    // Maintain parenthesis depth only on non-comment lines
    if (!isRem) {
      // Count ( and ) that are NOT escaped with ^
      // A bare ( or ) is one that is NOT immediately preceded by ^
      // We walk the string character by character
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        const prev = c > 0 ? line[c - 1] : "";
        if (ch === "(" && prev !== "^") depth++;
        else if (ch === ")" && prev !== "^") depth--;
      }
      // If we are inside a block (depth > 0 before this line was processed,
      // which means we entered via the opening-( of an if/for block), and
      // this is an echo line with a bare ) in the echo TEXT (not a structural
      // closing paren), flag it.
      // The check: after depth accounting for this line, if an echo line
      // contains a ) not preceded by ^ somewhere between "echo " and the
      // end of the line, and the block was open before this line, that is
      // the hazard.
    }
    // A simpler and accurate re-implementation: just scan for echo lines that
    // (a) are indented (inside a block) and (b) contain ) not escaped as ^).
    // "Indented echo" is a reliable proxy for "inside a block" given this
    // script's consistent formatting.
    if (/^\s{2,}echo /.test(line) && !isRem) {
      // Extract the echo text (everything after "echo ")
      const echoText = line.replace(/^\s*echo\s/, "");
      // Check for bare ) — a ) not preceded by ^
      // We look for ) that is not immediately preceded by ^
      const hasBareClose = /(?<!\^)\)/.test(echoText);
      if (hasBareClose) {
        violations.push(`line ${i + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(violations, [], `echo lines with unescaped ')' inside parenthesized blocks: ${violations.join("; ")}`);
});

test("npm install failure stops the script before prisma generate is called (fail-closed dependency chain fixed in v6)", () => {
  const codeOnly = cmdSource
    .split("\n")
    .map((l) => (l.trim().toUpperCase().startsWith("REM") ? "" : l))
    .join("\n");
  // Find the npm install invocation
  const npmInstallIdx = codeOnly.indexOf("call npm install");
  assert.ok(npmInstallIdx > -1, "npm install not found");
  // After npm install, before the next prisma generate call, there must be
  // a fail-closed branch (goto :fail_report) that fires if npm install failed.
  const afterInstall = codeOnly.slice(npmInstallIdx);
  const nextGenerateIdx = afterInstall.indexOf("call npx prisma generate");
  assert.ok(nextGenerateIdx > -1, "prisma generate not found after npm install");
  const between = afterInstall.slice(0, nextGenerateIdx);
  assert.match(between, /goto :fail_report/, "no fail-closed goto between npm install and prisma generate");
});

test("prisma validate failure stops the script before any migration/resume logic runs (fail-closed dependency chain fixed in v6)", () => {
  const codeOnly = cmdSource
    .split("\n")
    .map((l) => (l.trim().toUpperCase().startsWith("REM") ? "" : l))
    .join("\n");
  // Find prisma validate
  const validateIdx = codeOnly.indexOf("call npx prisma validate");
  assert.ok(validateIdx > -1, "prisma validate not found");
  // After validate, before the resume/fresh-run logic, there must be a
  // fail-closed branch. The resume logic is keyed on "RECOVERY / RESUME LOGIC"
  // or the actual `if not exist prisma\\migrations goto :fresh_run` line.
  const afterValidate = codeOnly.slice(validateIdx);
  const resumeIdx = afterValidate.search(/if not exist prisma\\migrations/);
  assert.ok(resumeIdx > -1, "resume logic entry not found after prisma validate");
  const between = afterValidate.slice(0, resumeIdx);
  assert.match(between, /goto :fail_report/, "no fail-closed goto between prisma validate and migration resume logic");
});

