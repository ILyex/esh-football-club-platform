// Deep inspection of the corrupted ar.json structure
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const arPath = join(root, "src", "i18n", "messages", "ar.json");

// Read as Latin-1 first
const asLatin1 = readFileSync(arPath, "latin1");
const asUtf8fromLatin1 = Buffer.from(asLatin1, "latin1").toString("utf8");
const asUtf8direct = readFileSync(arPath, "utf8");

// Parse both and check structure
const directParsed = JSON.parse(asUtf8direct);
const recoveredParsed = JSON.parse(asUtf8fromLatin1);

console.log("=== Direct UTF-8 read ===");
console.log("finance keys:", Object.keys(directParsed.finance ?? {}));
console.log("finance.expense keys:", Object.keys(directParsed.finance?.expense ?? {}));
console.log("finance.expense.categories:", JSON.stringify(directParsed.finance?.expense?.categories));

console.log("\n=== Latin-1 → UTF-8 recovered ===");
console.log("finance keys:", Object.keys(recoveredParsed.finance ?? {}));
console.log("finance.expense keys:", Object.keys(recoveredParsed.finance?.expense ?? {}));
console.log("finance.expense.categories:", JSON.stringify(recoveredParsed.finance?.expense?.categories));

// Find any Arabic characters in the direct parse
let foundArabic = false;
function findArabic(obj, path = "") {
  if (typeof obj === "string") {
    if (/[\u0600-\u06FF]/.test(obj)) {
      if (!foundArabic) { foundArabic = true; console.log("  Arabic found at:", path, "→", obj.slice(0, 30)); }
    }
    return;
  }
  if (typeof obj === "object" && obj !== null) {
    for (const [k, v] of Object.entries(obj)) {
      findArabic(v, path ? path + "." + k : k);
    }
  }
}
console.log("\n=== Searching for valid Arabic in direct parse ===");
findArabic(directParsed);
if (!foundArabic) console.log("  No valid Arabic Unicode characters found in the file");
