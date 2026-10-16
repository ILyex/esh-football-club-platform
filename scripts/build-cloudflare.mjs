import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const environment = {
  ...process.env,
  DEPLOY_TARGET: "cloudflare",
  AI_ENABLED: "true",
  AI_PROVIDER: "cloudflare",
  AI_MODEL: "@cf/google/gemma-4-26b-a4b-it",
  AI_VISION_MODEL: "@cf/google/gemma-4-26b-a4b-it",
  NEXT_PUBLIC_AI_ENABLED: "true",
  NEXT_DEPLOYMENT_ID: process.env.NEXT_DEPLOYMENT_ID ?? `cf-${Date.now().toString(36)}`
};

function run(command, args) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit",
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npm, ["run", "db:generate"]);
run(process.execPath, ["scripts/clean-build-output.mjs"]);
run(process.execPath, [resolve("node_modules/@opennextjs/cloudflare/dist/cli/index.js"), "build"]);
run(process.execPath, ["scripts/prepare-cpanel.mjs"]);
run(process.execPath, ["scripts/prepare-cloudflare-wasm.mjs"]);
