// Fix team-assignment.test.ts: correct the regex patterns that should match
// requirePermission calls regardless of whether the source uses single or
// double quotes.
//
// The WRONG pattern  was: /requirePermission(["']users.manage["'])/
//   — unescaped ( and ) are groups, not literal parens
//
// The CORRECT pattern is: /requirePermission\(["']users\.manage["']\)/
//   — \( \) match literal parens; ["'] matches either quote char
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const testPath = join(root, "tests", "rbac", "unit", "team-assignment.test.ts");

let content = readFileSync(testPath, "utf8");

// Current (wrong) patterns written by the previous fix script:
const wrongUsersManage  = `/requirePermission(["']users\\.manage["'])/`;
const wrongStaffUpdate  = `/requirePermission(["']staff\\.update["'])/`;
const wrongStaffUpdate2 = `/requirePermission(["']staff\\.update["'])/.test(userActions)`;

// Correct patterns: escaped parens, escaped dot
const rightUsersManage  = `/requirePermission\\(["']users\\.manage["']\\)/`;
const rightStaffUpdate  = `/requirePermission\\(["']staff\\.update["']\\)/`;
const rightStaffUpdate2 = `/requirePermission\\(["']staff\\.update["']\\)/.test(userActions)`;

content = content
  .replaceAll(wrongStaffUpdate2, rightStaffUpdate2)   // must come first (longest match)
  .replaceAll(wrongUsersManage,  rightUsersManage)
  .replaceAll(wrongStaffUpdate,  rightStaffUpdate);

writeFileSync(testPath, content, "utf8");

// Verify
const updated = readFileSync(testPath, "utf8");
console.log("Has correct users.manage:", updated.includes(rightUsersManage));
console.log("Has correct staff.update:", updated.includes(rightStaffUpdate));
console.log("Has correct staff.update test:", updated.includes(rightStaffUpdate2));
console.log("Still has wrong users.manage:", updated.includes(wrongUsersManage));
console.log("Still has wrong staff.update:", updated.includes(wrongStaffUpdate));
