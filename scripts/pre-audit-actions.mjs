import fs from "fs";

console.log("=== generateDocumentAction ===");
const genDocs = fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts", "utf8");
console.log(genDocs.slice(genDocs.indexOf("generateDocumentAction"), genDocs.indexOf("generateDocumentAction") + 2500));

console.log("\n=== uploadDocumentAction ===");
const docs = fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/documents/actions.ts", "utf8");
console.log(docs.slice(docs.indexOf("uploadDocumentAction"), docs.indexOf("uploadDocumentAction") + 2500));
