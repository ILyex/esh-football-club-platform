import fs from "fs";
import path from "path";

const files = [
  "src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts",
  "src/app/[locale]/(dashboard)/dashboard/document-templates/actions.ts",
  "src/app/[locale]/(dashboard)/dashboard/documents/actions.ts",
  "src/lib/documents/template-engine.ts",
  "src/lib/documents/entity-data-resolvers.ts"
];

for (const f of files) {
  console.log(`\n================== ${f} ==================`);
  if (!fs.existsSync(f)) {
    console.log("NOT FOUND");
    continue;
  }
  const content = fs.readFileSync(f, "utf8");
  const funcs = [...content.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g)];
  for (const m of funcs) {
    console.log(`- ${m[1]}(${m[2]})`);
  }
}
