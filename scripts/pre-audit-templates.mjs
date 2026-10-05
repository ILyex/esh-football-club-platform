import fs from "fs";

console.log("=== TEMPLATES ACTIONS ===");
console.log(fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/document-templates/actions.ts", "utf8").slice(0, 3000));
