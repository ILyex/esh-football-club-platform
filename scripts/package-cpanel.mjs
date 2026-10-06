import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const outputRoot = path.join(projectRoot, "release", "cpanel");
const standaloneServer = path.join(standaloneRoot, "server.js");
const privateArtifactFiles = /^(?:\.env(?:\..*)?|\.dev\.vars|\.npmrc|.*\.enc|.*\.log)$/i;
const privateArtifactDirectories = new Set([".storage", ".git", ".wrangler", "scratch"]);

if (!fs.existsSync(standaloneServer)) {
  throw new Error("Missing .next/standalone/server.js. Run `npm run build:cpanel` first.");
}

// The standalone server has its own traced node_modules and Next.js runtime.
// Include only that runtime plus the tiny Passenger entry point: never ship
// source control metadata, development dependencies, environment files, or
// the developer's local upload directory in the deployment artifact.
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, ".next", "standalone"), { recursive: true });
fs.cpSync(standaloneRoot, path.join(outputRoot, ".next", "standalone"), { recursive: true });
fs.copyFileSync(path.join(projectRoot, "app.js"), path.join(outputRoot, "app.js"));

function removePrivateLocalArtifacts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (privateArtifactDirectories.has(entry.name) || entry.name.startsWith(".scratch-")) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        removePrivateLocalArtifacts(target);
      }
    } else if (privateArtifactFiles.test(entry.name)) {
      fs.rmSync(target, { force: true });
    }
  }
}

removePrivateLocalArtifacts(outputRoot);

for (const forbidden of [".env", ".env.local", ".dev.vars", ".npmrc", ".storage"]) {
  if (fs.existsSync(path.join(outputRoot, ".next", "standalone", forbidden))) {
    throw new Error(`Refusing to package local secret or user data: ${forbidden}`);
  }
}

fs.writeFileSync(
  path.join(outputRoot, "package.json"),
  `${JSON.stringify({
    name: "esh-football-platform-cpanel",
    private: true,
    engines: { node: ">=22.12.0" },
    scripts: { start: "node app.js" }
  }, null, 2)}\n`
);

console.log(`Prepared cPanel runtime package at ${path.relative(projectRoot, outputRoot)}.`);
