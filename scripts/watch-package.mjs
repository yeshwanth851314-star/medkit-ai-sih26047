#!/usr/bin/env node
/**
 * MedKit AI — Automated Package Watcher
 * 
 * Watches for source, test, config, doc, asset, or database changes,
 * debounces multi-file changes, and automatically refreshes the validated
 * audit archive set at D:\SIH-zip-files-gpt using the exact same packaging workflow.
 * 
 * Commands:
 *   npm run package:watch         - Start watcher in foreground or background
 *   npm run package:watch:status  - Check if watcher process is currently running
 *   npm run package:watch:stop    - Stop running watcher process cleanly
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPackagingWorkflow } from "./package-audit.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PID_FILE = path.join(__dirname, ".watcher.pid");

// Check CLI flags
if (process.argv.includes("--status")) {
  checkStatus();
  process.exit(0);
}

if (process.argv.includes("--stop")) {
  stopWatcher();
  process.exit(0);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function checkStatus() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("MedKit AI Package Watcher is NOT running (no PID file).");
    return;
  }
  const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
  if (isProcessAlive(pid)) {
    console.log(`MedKit AI Package Watcher is ACTIVE and RUNNING (PID: ${pid}).`);
  } else {
    console.log(`MedKit AI Package Watcher PID file exists (${pid}), but process is not active.`);
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
  }
}

function stopWatcher() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("No active watcher process to stop.");
    return;
  }
  const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Sent SIGTERM to watcher process (PID: ${pid}).`);
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  } else {
    console.log(`Watcher process (PID: ${pid}) was already stopped.`);
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
  console.log("MedKit AI Package Watcher stopped cleanly.");
}

// Ensure only one watcher is running
if (fs.existsSync(PID_FILE)) {
  const existingPid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
  if (isProcessAlive(existingPid)) {
    console.warn(`[Watcher Warning] An instance of the watcher is already running (PID: ${existingPid}).`);
    console.warn(`Run 'npm run package:watch:stop' before starting a new watcher.`);
    process.exit(0);
  }
}

// Write current process PID
fs.writeFileSync(PID_FILE, process.pid.toString(), "utf8");

// Cleanup handler
function cleanup() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
      if (pid === process.pid) {
        fs.unlinkSync(PID_FILE);
      }
    }
  } catch {}
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// Watcher State
let debounceTimer = null;
let isPackaging = false;
let queuedRepackage = false;
const DEBOUNCE_MS = 1500;

const IGNORED_PATH_SUBSTRINGS = [
  "node_modules",
  ".next",
  ".git",
  "test-results",
  "playwright-report",
  "coverage",
  ".staging",
  ".packaging-staging",
  "tsconfig.tsbuildinfo",
  ".watcher.pid",
  ".packaging.lock",
  ".env",
  ".tmp",
  ".swp",
  ".swo",
  ".log",
  ".bak",
  ".zip",
  "SIH-zip-files-gpt",
];

function isIgnored(filename) {
  if (!filename) return true;
  const normalized = filename.split(path.sep).join("/");
  for (const sub of IGNORED_PATH_SUBSTRINGS) {
    if (normalized.includes(sub)) return true;
  }
  return false;
}

async function triggerPackaging(triggerSource) {
  if (isPackaging) {
    queuedRepackage = true;
    console.log(`[Watcher Queue] Packaging in progress. Queued refresh for changes in: ${triggerSource}`);
    return;
  }

  isPackaging = true;
  queuedRepackage = false;
  console.log(`\n[Watcher Event] Detected change in "${triggerSource}". Refreshing archives...`);

  try {
    await runPackagingWorkflow();
  } catch (err) {
    console.error(`[Watcher Error] Refresh failed: ${err.message}`);
  } finally {
    isPackaging = false;
    if (queuedRepackage) {
      console.log(`[Watcher] Executing queued refresh for changes that occurred during previous packaging run.`);
      setTimeout(() => triggerPackaging("queued-changes"), 300);
    }
  }
}

console.log(`=============================================================`);
console.log(` MedKit AI — Package Watcher Active (PID: ${process.pid})`);
console.log(` Watching: ${PROJECT_ROOT}`);
console.log(` Destination: D:\\SIH-zip-files-gpt`);
console.log(` Debounce: ${DEBOUNCE_MS}ms`);
console.log(` Stop command: npm run package:watch:stop`);
console.log(`=============================================================\n`);

// Start native directory watcher
fs.watch(PROJECT_ROOT, { recursive: true }, (eventType, filename) => {
  if (isIgnored(filename)) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    triggerPackaging(filename);
  }, DEBOUNCE_MS);
});
