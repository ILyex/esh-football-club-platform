import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const directory of [".next", ".open-next"]) {
  const target = path.join(projectRoot, directory);
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed stale build output: ${directory}`);
}
