import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const varsPath = ".dev.vars";
const current = existsSync(varsPath) ? readFileSync(varsPath, "utf8") : "";
const values = new Map(current.split(/\r?\n/).filter(Boolean).map((line) => {
  const split = line.indexOf("=");
  return split > 0 ? [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")] : ["", ""];
}));

if (!values.get("VAPID_PUBLIC_KEY") || !values.get("VAPID_PRIVATE_KEY")) {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error("Unable to export P-256 VAPID keys.");
  values.set("VAPID_PUBLIC_KEY", Buffer.concat([
    Buffer.from([0x04]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")
  ]).toString("base64url"));
  values.set("VAPID_PRIVATE_KEY", jwk.d);
}
values.set("VAPID_SUBJECT", values.get("VAPID_SUBJECT") || "mailto:dev@esh.dz");

const content = [...current.split(/\r?\n/).filter((line) => line && !/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=/.test(line))];
for (const name of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) {
  content.push(`${name}=${values.get(name)}`);
}
writeFileSync(varsPath, `${content.join("\n")}\n`, { mode: 0o600 });

const wrangler = process.platform === "win32" ? "npx.cmd" : "npx";
for (const name of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) {
  const result = spawnSync(wrangler, ["wrangler", "secret", "put", name], {
    input: values.get(name),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["pipe", "ignore", "inherit"]
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Could not store ${name} in Cloudflare (${result.error?.message ?? result.status}).`);
  }
  console.log(`Stored ${name} as a Cloudflare secret.`);
}
console.log(`A local backup is stored in ignored ${varsPath}. Keep it private and do not rotate these keys after subscribers opt in.`);
