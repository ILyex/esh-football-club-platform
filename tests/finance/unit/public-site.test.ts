import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ============================================================================
// PHASE 7 — PUBLIC WEBSITE & FAN EXPERIENCE SECURITY & INVARIANT TEST SUITE
// ============================================================================

test("all required Phase 7 public route files exist on disk", () => {
  const requiredRoutes = [
    "src/app/[locale]/(public)/layout.tsx",
    "src/app/[locale]/(public)/page.tsx",
    "src/app/[locale]/(public)/team/page.tsx",
    "src/app/[locale]/(public)/team/[category]/page.tsx",
    "src/app/[locale]/(public)/team/[category]/players/[slug]/page.tsx",
    "src/app/[locale]/(public)/matches/page.tsx",
    "src/app/[locale]/(public)/matches/[id]/page.tsx",
    "src/app/[locale]/(public)/competitions/page.tsx",
    "src/app/[locale]/(public)/news/page.tsx",
    "src/app/[locale]/(public)/news/[slug]/page.tsx",
    "src/app/[locale]/(public)/gallery/page.tsx",
    "src/app/[locale]/(public)/gallery/[id]/page.tsx"
  ];

  for (const route of requiredRoutes) {
    assert.ok(existsSync(join(ROOT, route)), `Missing public route file: ${route}`);
  }
});

test("all required Phase 7 public components exist on disk", () => {
  const requiredComponents = [
    "src/components/public/public-header.tsx",
    "src/components/public/public-footer.tsx",
    "src/components/public/match-card.tsx",
    "src/components/public/player-card.tsx",
    "src/components/public/news-card.tsx"
  ];

  for (const comp of requiredComponents) {
    assert.ok(existsSync(join(ROOT, comp)), `Missing public component: ${comp}`);
  }
});

test("all required Phase 7 public data access modules exist on disk", () => {
  const requiredModules = [
    "src/lib/public/club.ts",
    "src/lib/public/teams.ts",
    "src/lib/public/matches.ts",
    "src/lib/public/news.ts",
    "src/lib/public/competitions.ts",
    "src/lib/public/gallery.ts",
    "src/lib/public/home.ts"
  ];

  for (const mod of requiredModules) {
    assert.ok(existsSync(join(ROOT, mod)), `Missing public data access module: ${mod}`);
  }
});

test("public data access layer strictly enforces server-only boundary", () => {
  const publicModules = [
    "src/lib/public/club.ts",
    "src/lib/public/teams.ts",
    "src/lib/public/matches.ts",
    "src/lib/public/news.ts",
    "src/lib/public/competitions.ts",
    "src/lib/public/gallery.ts",
    "src/lib/public/home.ts"
  ];

  for (const mod of publicModules) {
    const content = read(mod);
    assert.ok(
      content.includes('import "server-only";') || content.includes("import 'server-only';"),
      `${mod} must have server-only guard`
    );
  }
});

test("public data access layer never performs database mutations or imports audit write functions", () => {
  const publicModules = [
    "src/lib/public/club.ts",
    "src/lib/public/teams.ts",
    "src/lib/public/matches.ts",
    "src/lib/public/news.ts",
    "src/lib/public/competitions.ts",
    "src/lib/public/gallery.ts",
    "src/lib/public/home.ts"
  ];

  const mutationPatterns = [
    /\bdb\.\w+\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\b/,
    /\bwriteAuditLog\b/,
    /\brunFinanceAction\b/,
    /\bexecuteJob\b/
  ];

  for (const mod of publicModules) {
    const content = read(mod);
    for (const pat of mutationPatterns) {
      assert.ok(
        !pat.test(content),
        `${mod} violates read-only invariant by containing mutation pattern: ${pat}`
      );
    }
  }
});

test("public data projection security: sensitive fields are never exposed in public models", () => {
  const stripComments = (code: string) => code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const teamsContent = stripComments(read("src/lib/public/teams.ts"));
  const matchesContent = stripComments(read("src/lib/public/matches.ts"));
  const newsContent = stripComments(read("src/lib/public/news.ts"));
  const galleryContent = stripComments(read("src/lib/public/gallery.ts"));

  // Teams & Players must not expose salary, wages, contracts, nationalId, or internal documents
  assert.ok(!/\bcontract\b/i.test(teamsContent), "teams.ts must not reference contracts");
  assert.ok(!/\bsalary\b/i.test(teamsContent), "teams.ts must not reference salaries");
  assert.ok(!/\bwage\b/i.test(teamsContent), "teams.ts must not reference wages");
  assert.ok(!/\bnationalId\b/i.test(teamsContent), "teams.ts must not reference nationalId");
  assert.ok(!/\bdocument\b/i.test(teamsContent), "teams.ts must not reference documents");

  // Matches must not expose expenses, internal notes, or referee payment amounts
  assert.ok(!/\bexpense\b/i.test(matchesContent), "matches.ts must not reference expenses");
  assert.ok(!/\bfee\b/i.test(matchesContent), "matches.ts must not reference referee fees");

  // News must strictly query published status and past/present publishedAt
  assert.match(newsContent, /status:\s*"PUBLISHED"/, "news.ts must require PUBLISHED status");
  assert.match(newsContent, /publishedAt:\s*\{\s*lte:/, "news.ts must require publishedAt <= now");

  // Gallery must strictly query published albums and never expose s3/storage keys
  assert.match(galleryContent, /published:\s*true/, "gallery.ts must require published: true");
  assert.ok(!/\bs3Key\b/i.test(galleryContent), "gallery.ts must not reference s3Key");
  assert.ok(!/\bfilePath\b/i.test(galleryContent), "gallery.ts must not reference raw filePath");
});

test("bilingual i18n parity for public site namespace in ar.json and fr.json", () => {
  const ar = JSON.parse(read("src/i18n/messages/ar.json"));
  const fr = JSON.parse(read("src/i18n/messages/fr.json"));

  assert.ok(ar.publicSite, "ar.json missing publicSite namespace");
  assert.ok(fr.publicSite, "fr.json missing publicSite namespace");

  function getLeaves(obj: any, prefix = ""): [string, string][] {
    return Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" ? getLeaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]]
    );
  }

  const arLeaves = new Map(getLeaves(ar.publicSite));
  const frLeaves = new Map(getLeaves(fr.publicSite));

  assert.deepEqual(
    [...arLeaves.keys()].filter((k) => !frLeaves.has(k)),
    [],
    "publicSite keys present only in ar"
  );
  assert.deepEqual(
    [...frLeaves.keys()].filter((k) => !arLeaves.has(k)),
    [],
    "publicSite keys present only in fr"
  );

  for (const [key, val] of arLeaves) {
    assert.ok(val.trim().length > 0, `ar.publicSite.${key} is empty`);
  }
  for (const [key, val] of frLeaves) {
    assert.ok(val.trim().length > 0, `fr.publicSite.${key} is empty`);
  }
});
