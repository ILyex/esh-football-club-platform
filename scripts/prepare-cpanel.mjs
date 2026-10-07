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
  fs.rmSync(staticTarget, { recursive: true, force: true });
  fs.cpSync(staticSource, staticTarget, { recursive: true, force: true });
}

const publicSource = path.join(projectRoot, "public");
const publicTarget = path.join(standaloneRoot, "public");
if (fs.existsSync(publicSource)) {
  fs.rmSync(publicTarget, { recursive: true, force: true });
  fs.cpSync(publicSource, publicTarget, { recursive: true, force: true });
}

// Next's standalone file tracing does not always include Prisma's WASM query
// compiler. Copy the generated runtime artefacts explicitly so credentials,
// health checks, and every database query work from the cPanel bundle.
const prismaRuntimeSource = path.join(projectRoot, "node_modules", ".prisma", "client");
const prismaRuntimeTarget = path.join(standaloneRoot, "node_modules", ".prisma", "client");
if (fs.existsSync(prismaRuntimeSource)) {
  fs.cpSync(prismaRuntimeSource, prismaRuntimeTarget, { recursive: true, force: true });
}

const prismaWasm = path.join(prismaRuntimeTarget, "query_compiler_bg.wasm");
if (!fs.existsSync(prismaWasm)) {
  throw new Error("Prisma WASM query compiler is missing from the cPanel runtime bundle.");
}

console.log("Prepared .next/standalone for cPanel (server, static assets, and public files).");
