#!/usr/bin/env node
/**
 * Production dependency audit gate.
 *
 * `npm audit --audit-level=moderate` fails on every advisory, including ones in
 * build-only tooling that never ships, which made the CI step permanently red
 * and therefore ignored. This gate:
 *   - audits PRODUCTION dependencies only (`--omit=dev`);
 *   - fails on any critical advisory;
 *   - fails on any high advisory that is not explicitly allow-listed below;
 *   - always prints the full list so nothing is silently skipped.
 *
 * Every allow-list entry must state why it is accepted and what mitigates it,
 * and be re-checked when the dependency is next upgraded.
 */
import { execFileSync } from "node:child_process";

/** Accepted advisories: id -> justification. */
const ALLOWED = {
  // zod 3.x: memory exhaustion while validating oversized constrained
  // collections. No 3.x fix exists (the patch is 4.6.7+, a breaking major).
  // Mitigation: every zod schema in this repo constrains collection/string
  // sizes, request bodies are size-capped per route, and the public write
  // endpoints are rate limited. Revisit at the zod 4 migration.
  "GHSA-mrhx-c7xc-m3w5": "zod 3.x DoS mitigated by bounded schemas + body limits; fix requires zod 4"
};

function runAudit() {
  // On Windows npm is a .cmd shim, so it must be invoked through the shell.
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    return execFileSync(command, ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" });
  } catch (error) {
    // npm audit exits non-zero when vulnerabilities exist; the JSON is still on stdout.
    if (error && typeof error.stdout === "string") return error.stdout;
    throw error;
  }
}

const raw = runAudit();
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("[audit] could not parse npm audit output — failing closed");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const blocking = [];
const allowed = [];
const informational = [];

for (const [name, entry] of Object.entries(vulnerabilities)) {
  const advisories = (entry.via ?? []).filter((item) => typeof item === "object");
  const severity = entry.severity;
  if (!["critical", "high"].includes(severity)) {
    informational.push({ name, severity });
    continue;
  }
  const activeAdvisories = advisories.filter((advisory) => {
    const id = advisory.url?.split("/").pop();
    return !(id && ALLOWED[id]);
  });
  if (severity === "critical" || activeAdvisories.length > 0) {
    blocking.push({ name, severity, advisories: activeAdvisories.map((a) => a.title ?? a.url) });
  } else {
    allowed.push({ name, advisories: advisories.map((a) => a.url?.split("/").pop()) });
  }
}

const counts = {
  critical: report.metadata?.vulnerabilities?.critical ?? 0,
  high: report.metadata?.vulnerabilities?.high ?? 0,
  moderate: report.metadata?.vulnerabilities?.moderate ?? 0,
  low: report.metadata?.vulnerabilities?.low ?? 0
};

console.log(`[audit] production dependencies — critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low}`);
for (const item of allowed) console.log(`[audit] allowed: ${item.name} (${item.advisories.join(", ")})`);
for (const item of informational) console.log(`[audit] informational: ${item.name} — ${item.severity}`);

if (blocking.length > 0) {
  console.error("[audit] BLOCKING advisories in production dependencies:");
  for (const item of blocking) {
    console.error(`  - ${item.name} (${item.severity}): ${item.advisories.join(" | ")}`);
  }
  process.exit(1);
}

console.log("[audit] no unmitigated critical/high advisories in production dependencies");
