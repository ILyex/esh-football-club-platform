import fs from "fs";

console.log("=== GENDOC DETAIL PAGE ===");
console.log(fs.readFileSync("src/app/[locale]/(dashboard)/dashboard/generated-documents/[id]/page.tsx", "utf8").slice(0, 2000));

console.log("\n=== GENDOC DOWNLOAD ROUTE ===");
console.log(fs.readFileSync("src/app/api/generated-documents/[id]/download/route.ts", "utf8"));
