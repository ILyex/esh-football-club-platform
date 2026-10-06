import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBuild = path.join(projectRoot, ".next");
const standaloneRoot = path.join(nextBuild, "standalone");

if (!fs.existsSync(path.join(standaloneRoot, "server.js"))) {
  throw new Error("Next.js standalone server was not generated. Check `output: standalone` in next.config.mjs.");
}

const staticSource = path.join(nextBuild, "static");
const staticTarget = path.join(standaloneRoot, ".next", "static");
if (fs.existsSync(staticSource)) {
  fs.cpSync(staticSource, staticTarget, { recursive: true, force: true });
}

const publicSource = path.join(projectRoot, "public");
const publicTarget = path.join(standaloneRoot, "public");
if (fs.existsSync(publicSource)) {
  fs.cpSync(publicSource, publicTarget, { recursive: true, force: true });
}

console.log("Prepared .next/standalone for cPanel (server, static assets, and public files).");
