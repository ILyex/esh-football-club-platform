// Detect encoding and show sample bytes of the ar.json file
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const arPath = join(root, "src", "i18n", "messages", "ar.json");

// Read as binary buffer
const buf = readFileSync(arPath);

// Show first 4 bytes (BOM check)
console.log("First 4 bytes hex:", buf.slice(0, 4).toString("hex"));
console.log("BOM present:", buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? "UTF-8 BOM" : buf[0] === 0xff && buf[1] === 0xfe ? "UTF-16 LE" : "None detected");

// Try reading the TRANSPORT value as different encodings
const asUtf8    = buf.toString("utf8");
const asLatin1  = buf.toString("latin1");

const parsedUtf8 = JSON.parse(asUtf8);
console.log("As UTF-8: TRANSPORT =", parsedUtf8.finance?.expense?.categories?.TRANSPORT);

// Check if it looks like double-encoded UTF-8 (common issue)
// Arabic 'نقل' in UTF-8 = D9 86 D9 82 D9 84
// If the file was written as windows-1256, each byte is different
// The mojibake 'ظ†ظ‚ظ„' appears when UTF-8 Arabic bytes are read as latin1/windows-1252 then re-encoded as UTF-8
// نقل = U+0646 U+0642 U+0644 → UTF-8: D9 86 D9 82 D9 84
// ظ = D8 B8 in UTF-8 = U+0638 (ظ character)
// If we see ظ† it means the two bytes D9 86 (which spell نـ in UTF-8) were each treated as a separate Latin-1 char

// Check sample of the corrupted content
const samplePos = asUtf8.indexOf("TRANSPORT");
const sampleStr = asUtf8.slice(samplePos, samplePos + 50);
console.log("Raw TRANSPORT region:", JSON.stringify(sampleStr));

// Try Latin-1 decode → UTF-8 re-encode (reverse the double-encoding)
function fixDoubleEncoded(str) {
  const bytes = Buffer.from(str, "latin1");
  return bytes.toString("utf8");
}

const transportValue = parsedUtf8.finance?.expense?.categories?.TRANSPORT ?? "";
console.log("Attempting fix:", fixDoubleEncoded(transportValue));
