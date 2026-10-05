import fs from "fs";

const content = fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts", "utf8");
const gIdx = content.indexOf("generateDocumentAction");
console.log(content.slice(gIdx + 1200, gIdx + 3000));
