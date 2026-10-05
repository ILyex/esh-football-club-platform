// Show all requirePermission lines in team-assignment.test.ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const testPath = join(root, "tests", "rbac", "unit", "team-assignment.test.ts");

const content = readFileSync(testPath, "utf8");
content.split("\n").forEach((line, i) => {
  if (line.includes("requirePermission")) {
    console.log(i + 1, JSON.stringify(line));
  }
});
