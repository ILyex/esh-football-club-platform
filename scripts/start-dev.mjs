import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const port = 3000;
const projectRoot = path.resolve(process.cwd());

function normalize(value) {
  return value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function windowsListeningPids() {
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess`
      ],
      { encoding: "utf8", windowsHide: true }
    );
    return [...new Set(output.split(/\r?\n/).map((line) => Number(line.trim())).filter(Number.isInteger))];
  } catch {
    return [];
  }
}

function windowsCommandLine(pid) {
  try {
    return execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`
      ],
      { encoding: "utf8", windowsHide: true }
    ).trim();
  } catch {
    return "";
  }
}

function stopWindowsProcess(pid) {
  execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true
  });
}

function unixListeningPids() {
  try {
    const output = execFileSync("lsof", ["-ti", `:${port}`], { encoding: "utf8" });
    return [...new Set(output.split(/\r?\n/).map((line) => Number(line.trim())).filter(Number.isInteger))];
  } catch {
    return [];
  }
}

function stopStaleProjectServer() {
  const expectedRoot = normalize(projectRoot);

  if (process.platform === "win32") {
    for (const pid of windowsListeningPids()) {
      if (pid === process.pid) continue;
      const commandLine = normalize(windowsCommandLine(pid));
      if (commandLine.includes(expectedRoot) && /(?:node|next)/i.test(commandLine)) {
        console.log(`[dev] Stopping stale project server ${pid} on port ${port}...`);
        stopWindowsProcess(pid);
      } else if (commandLine) {
        throw new Error(`Port ${port} is already used by another process. Close it or choose another port.`);
      }
    }
    return;
  }

  for (const pid of unixListeningPids()) {
    if (pid === process.pid) continue;
    let commandLine = "";
    try {
      commandLine = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
    } catch {
      continue;
    }
    if (normalize(commandLine).includes(expectedRoot)) {
      console.log(`[dev] Stopping stale project server ${pid} on port ${port}...`);
      process.kill(pid, "SIGTERM");
    } else {
      throw new Error(`Port ${port} is already used by another process. Close it or choose another port.`);
    }
  }
}

stopStaleProjectServer();

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  throw new Error("Next.js is not installed. Run npm install before starting the platform.");
}

// Webpack is intentionally used for the local server. Turbopack's watcher
// retained large client-manifest graphs in this project and grew past 2 GB
// after normal navigation between dashboard routes.
const child = spawn(process.execPath, [nextBin, "dev", "--port", String(port)], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

