import fs from "fs";

const content = fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts", "utf8");
const idx = content.indexOf("db.generatedDocument.create");
console.log(content.slice(idx - 100, idx + 1500));
