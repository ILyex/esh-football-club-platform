import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "release", "club-admin-simple");
const internal = path.join(output, ".platform");
const standalone = path.join(root, ".next", "standalone");
const previous = path.join(root, "release", "club-admin");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Run npm run build:cpanel first.");
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(internal, { recursive: true });

fs.cpSync(standalone, path.join(internal, ".next", "standalone"), { recursive: true });
// The standalone tree can contain local file-storage data from development.
// Public uploads are stored in Neon/S3; never ship local documents, avatars,
// or generated reports inside the handover archive.
fs.rmSync(path.join(internal, ".next", "standalone", ".storage"), { recursive: true, force: true });
// Next may trace the developer's .env into the standalone folder. Remove
// those nested copies so the launcher reads the package root .env/.env.local,
// which are the club-specific settings delivered with this package.
for (const nestedEnv of [".env", ".env.local", ".dev.vars"]) {
  fs.rmSync(path.join(internal, ".next", "standalone", nestedEnv), { force: true });
}
const buildId = path.join(root, ".next", "BUILD_ID");
if (fs.existsSync(buildId)) {
  fs.copyFileSync(buildId, path.join(internal, ".next", "BUILD_ID"));
}
const runtimeSource = fs.existsSync(path.join(root, "runtime", "node.exe"))
  ? path.join(root, "runtime")
  : path.join(previous, "runtime");
if (fs.existsSync(runtimeSource)) fs.cpSync(runtimeSource, path.join(internal, "runtime"), { recursive: true });

for (const name of [
  "app.js", "Launch-ESH-Platform.bat", "Launch-ESH-Platform.vbs",
  "Local-Platform-Supervisor.mjs", "Start-Local-Platform-Supervisor.ps1",
  "Install-ESH-Platform.vbs", "Setup-ESH-Local-AI.ps1", "Setup-ESH-Local-AI.vbs",
  "Update-ESH-Platform.ps1", "Update-ESH-Platform.vbs"
]) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(internal, name));
}

// Build a clean club runtime configuration instead of copying the developer's
// full .env files. DATABASE_URL_TEST, Gmail OAuth secrets and FAF credentials
// must never travel inside a handover ZIP.
function readEnvValue(contents, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = contents.match(new RegExp(`^\\s*${escaped}\\s*=\\s*(.*)$`, "m"));
  if (!match) return "";
  const raw = match[1].trim();
  return ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
    ? raw.slice(1, -1)
    : raw;
}

const sourceEnvPath = fs.existsSync(path.join(root, ".env"))
  ? path.join(root, ".env")
  : path.join(previous, ".env");
if (!fs.existsSync(sourceEnvPath)) throw new Error("A source .env with DATABASE_URL is required to package the club runtime.");
const sourceEnv = fs.readFileSync(sourceEnvPath, "utf8");
const sourceLocalPath = fs.existsSync(path.join(root, ".env.local"))
  ? path.join(root, ".env.local")
  : path.join(previous, ".env.local");
const sourceLocalEnv = fs.existsSync(sourceLocalPath) ? fs.readFileSync(sourceLocalPath, "utf8") : "";
const clubValue = (key, fallback = "") => readEnvValue(sourceEnv, key) || readEnvValue(sourceLocalEnv, key) || fallback;
const databaseUrl = readEnvValue(sourceEnv, "DATABASE_URL");
const authSecret = readEnvValue(sourceEnv, "AUTH_SECRET") || crypto.randomBytes(32).toString("hex");
const cronSecret = readEnvValue(sourceEnv, "CRON_SECRET") || crypto.randomBytes(32).toString("hex");
if (!databaseUrl) throw new Error("DATABASE_URL is missing from the source .env.");

const runtimeEnv = [
  `DATABASE_URL=${JSON.stringify(databaseUrl)}`,
  `AUTH_SECRET=${JSON.stringify(authSecret)}`,
  `CRON_SECRET=${JSON.stringify(cronSecret)}`,
  `NEXTAUTH_URL=${JSON.stringify(clubValue("NEXTAUTH_URL", "http://localhost:3000"))}`,
  `FAF_ENABLED=${JSON.stringify(clubValue("FAF_ENABLED", "false"))}`,
  `FAF_PORTAL_URL=${JSON.stringify(clubValue("FAF_PORTAL_URL"))}`,
  `FAF_CLUB_CODE=${JSON.stringify(clubValue("FAF_CLUB_CODE"))}`,
  `FAF_USERNAME=${JSON.stringify(clubValue("FAF_USERNAME"))}`,
  `FAF_PASSWORD=${JSON.stringify(clubValue("FAF_PASSWORD"))}`,
  `FAF_TIMEOUT_MS=${JSON.stringify(clubValue("FAF_TIMEOUT_MS", "20000"))}`,
  `FAF_RATE_LIMIT_DELAY_MS=${JSON.stringify(clubValue("FAF_RATE_LIMIT_DELAY_MS", "1000"))}`,
  `FAF_SESSION_COOKIE=${JSON.stringify(clubValue("FAF_SESSION_COOKIE"))}`,
  `GOOGLE_CLIENT_ID=${JSON.stringify(clubValue("GOOGLE_CLIENT_ID"))}`,
  `GOOGLE_CLIENT_SECRET=${JSON.stringify(clubValue("GOOGLE_CLIENT_SECRET"))}`,
  `GOOGLE_REDIRECT_URI=${JSON.stringify(clubValue("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback"))}`,
  `GMAIL_TOKEN_ENCRYPTION_KEY=${JSON.stringify(clubValue("GMAIL_TOKEN_ENCRYPTION_KEY", authSecret))}`,
  `STORAGE_DRIVER=${JSON.stringify(clubValue("STORAGE_DRIVER", "database"))}`,
  ""
].join("\n");
const runtimeLocalEnv = [
  "PUBLIC_SITE_ONLY=false",
  "AI_ENABLED=true",
  "NEXT_PUBLIC_AI_ENABLED=true",
  "OLLAMA_BASE_URL=http://127.0.0.1:11434",
  `NEXT_PUBLIC_PUBLIC_SITE_URL=${JSON.stringify(clubValue("NEXT_PUBLIC_PUBLIC_SITE_URL"))}`,
  "OLLAMA_MODEL=qwen2.5:7b",
  "OLLAMA_VISION_MODEL=llava:7b",
  "OLLAMA_KEEP_ALIVE=2m",
  ""
].join("\n");
fs.writeFileSync(path.join(internal, ".env"), runtimeEnv, "utf8");
fs.writeFileSync(path.join(internal, ".env.local"), runtimeLocalEnv, "utf8");

// The updater uses this bounded migration to move existing public uploads
// into the database before switching STORAGE_DRIVER away from local storage.
fs.copyFileSync(
  path.join(root, "scripts", "migrate-local-public-assets-to-database.mjs"),
  path.join(standalone, "migrate-local-public-assets-to-database.mjs")
);

// Next's standalone server resolves env files from its own directory rather
// than the package root. Put the same prepared club configuration there too;
// otherwise Auth.js starts without AUTH_SECRET in the installed package.
const standalonePackage = path.join(internal, ".next", "standalone");
for (const name of [".env", ".env.local"]) {
  const packagedEnv = path.join(internal, name);
  if (fs.existsSync(packagedEnv)) {
    fs.copyFileSync(packagedEnv, path.join(standalonePackage, name));
  }
}

const logo = path.join(internal, ".next", "standalone", "public", "branding", "esh-logo.ico");
if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(output, ".esh-logo.ico"));

// Create two relative shortcuts so the administrator sees only two branded icons.
const shortcutScript = `
Set s=CreateObject("WScript.Shell")
Set f=CreateObject("Scripting.FileSystemObject")
r=f.GetParentFolderName(WScript.ScriptFullName)
Set a=s.CreateShortcut(f.BuildPath(r,"SETUP.lnk"))
a.TargetPath=s.ExpandEnvironmentStrings("%WINDIR%\\System32\\wscript.exe")
a.Arguments=Chr(34) & ".platform\\Install-ESH-Platform.vbs" & Chr(34)
a.WorkingDirectory=r:a.IconLocation=f.BuildPath(r,".esh-logo.ico"):a.Save
Set b=s.CreateShortcut(f.BuildPath(r,"AI SETUP.lnk"))
b.TargetPath=s.ExpandEnvironmentStrings("%WINDIR%\\System32\\wscript.exe")
b.Arguments=Chr(34) & ".platform\\Setup-ESH-Local-AI.vbs" & Chr(34)
b.WorkingDirectory=r:b.IconLocation=f.BuildPath(r,".esh-logo.ico"):b.Save
`;
const helper = path.join(output, ".create-shortcuts.vbs");
fs.writeFileSync(helper, shortcutScript, "utf8");
execFileSync("cscript.exe", ["//nologo", helper], { stdio: "ignore" });
fs.rmSync(helper, { force: true });
try {
  const hidden = [path.join(output, ".platform"), path.join(output, ".esh-logo.ico")]
    .map((item) => `'${item.replaceAll("'", "''")}'`).join(",");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `$paths=@(${hidden}); $paths | ForEach-Object { $i=Get-Item -LiteralPath $_ -Force; $i.Attributes=$i.Attributes -bor [IO.FileAttributes]::Hidden }`], { stdio: "ignore" });
} catch {}

const zip = path.join(root, "release", "club-admin-simple.zip");
fs.rmSync(zip, { force: true });
// Windows ships bsdtar even when the optional PowerShell Archive module is
// unavailable. It creates a standard ZIP without requiring admin rights.
execFileSync("tar.exe", ["-a", "-c", "-f", zip, "-C", output, "."], { stdio: "inherit" });
console.log(`Prepared ${path.relative(root, zip)}.`);
