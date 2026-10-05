import fs from "fs";

const content = fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/generated-documents/actions.ts", "utf8");
const gIdx = content.indexOf("tx.generatedDocument.create");
console.log(content.slice(gIdx, gIdx + 2000));
