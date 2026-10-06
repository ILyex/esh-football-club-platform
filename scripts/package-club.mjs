import fs from "node:fs";
import path from "node:path";
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
  "Install-ESH-Platform.vbs", "Setup-ESH-Local-AI.ps1", "Setup-ESH-Local-AI.vbs",
  "Update-ESH-Platform.ps1", "Update-ESH-Platform.vbs"
]) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(internal, name));
}

// Keep the club's existing secrets if a previous prepared package exists.
for (const name of [".env", ".env.local"]) {
  const source = fs.existsSync(path.join(root, name)) ? path.join(root, name) : path.join(previous, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(internal, name));
}

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
