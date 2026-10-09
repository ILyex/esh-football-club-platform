import { spawn } from "node:child_process";
import { closeSync, createWriteStream, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const healthUrl = "http://127.0.0.1:3000/api/health?type=liveness";
const appEntry = path.join(root, "app.js");
const lockPath = path.join(root, ".local-admin-supervisor.pid");
const maintenancePath = path.join(root, ".local-admin-maintenance");
const serverLog = path.join(root, ".local-admin.log");
const serverErrorLog = path.join(root, ".local-admin-error.log");
const supervisorLog = path.join(root, ".local-admin-supervisor.log");
const pollIntervalMs = 30_000;
const failedChecksBeforeRestart = 3;
const maxLogBytes = 5 * 1024 * 1024;

let lockFd;
let server = null;
let failedChecks = 0;
let stopping = false;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const fd = openSync(supervisorLog, "a");
    writeFileSync(fd, line);
    closeSync(fd);
  } catch {}
}

function rotateLogIfNeeded(filePath) {
  try {
    if (!existsSync(filePath) || statSync(filePath).size <= maxLogBytes) return;
    const archivePath = `${filePath}.1`;
    try { unlinkSync(archivePath); } catch {}
    renameSync(filePath, archivePath);
  } catch {}
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function acquireLock() {
  try {
    lockFd = openSync(lockPath, "wx");
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let previousPid = 0;
    try {
      previousPid = Number(readFileSync(lockPath, "utf8").trim());
    } catch {}
    if (previousPid > 0 && processExists(previousPid)) return false;
    try { unlinkSync(lockPath); } catch {}
    lockFd = openSync(lockPath, "wx");
  }
  writeFileSync(lockFd, String(process.pid));
  return true;
}

function releaseLock() {
  try { closeSync(lockFd); } catch {}
  try {
    if (Number(readFileSync(lockPath, "utf8").trim()) === process.pid) unlinkSync(lockPath);
  } catch {}
}

function hasListener() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 3000 });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(800);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(true));
  });
}

async function isHealthy() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
    return response.status === 200;
  } catch {
    return false;
  }
}

function startServer() {
  if (!existsSync(appEntry)) {
    log("Server entry file is missing; retrying later.");
    return;
  }

  log("Starting local production server.");
  // Keep an unhealthy integration or repeated restart from filling the local
  // disk. The active log is capped at 5 MiB and one rotated copy is retained.
  rotateLogIfNeeded(serverLog);
  rotateLogIfNeeded(serverErrorLog);
  rotateLogIfNeeded(supervisorLog);
  const env = {
    ...process.env,
    DEPLOY_TARGET: "node",
    NODE_OPTIONS: "--max-old-space-size=768 --max-http-header-size=65536",
    OLLAMA_NUM_PARALLEL: "1",
    OLLAMA_MAX_LOADED_MODELS: "1"
  };
  const child = spawn(process.execPath, [appEntry], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.pipe(createWriteStream(serverLog, { flags: "a" }));
  child.stderr?.pipe(createWriteStream(serverErrorLog, { flags: "a" }));
  server = child;
  child.once("error", (error) => {
    log(`Could not start the server: ${error.message}`);
    if (server === child) server = null;
  });
  child.once("exit", (code, signal) => {
    log(`Server process stopped (code ${code ?? "none"}, signal ${signal ?? "none"}).`);
    if (server === child) server = null;
  });
}

async function stopServerTree() {
  if (!server) return;
  const child = server;
  server = null;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
  } else {
    child.kill("SIGTERM");
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!acquireLock()) return;
  log("Lightweight supervisor started.");
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });

  while (!stopping) {
    if (existsSync(maintenancePath)) {
      let markerAgeMs = 0;
      try { markerAgeMs = Date.now() - statSync(maintenancePath).mtimeMs; } catch { markerAgeMs = Infinity; }
      if (markerAgeMs < 10 * 60_000) {
        await wait(5_000);
        continue;
      }
      try { unlinkSync(maintenancePath); } catch {}
      log("Expired maintenance marker cleared; resuming health checks.");
    }

    if (await isHealthy()) {
      failedChecks = 0;
    } else {
      failedChecks++;
      if (server && failedChecks >= failedChecksBeforeRestart) {
        log("Health checks failed for about 90 seconds; restarting the server.");
        await stopServerTree();
        failedChecks = 0;
        await wait(2_000);
      }

      if (!server) {
        if (await hasListener()) {
          if (failedChecks === failedChecksBeforeRestart) {
            log("Port 3000 is occupied by a non-responsive process outside this supervisor; leaving it untouched.");
          }
        } else {
          startServer();
        }
      }
    }

    await wait(pollIntervalMs);
  }

  await stopServerTree();
  releaseLock();
}

run().catch((error) => {
  log(`Supervisor stopped after an error: ${error?.stack ?? error}`);
  releaseLock();
  process.exitCode = 1;
});
