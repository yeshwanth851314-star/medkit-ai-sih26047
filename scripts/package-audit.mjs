#!/usr/bin/env node
/**
 * MedKit AI — Repeatable Source-Packaging & Audit Workflow
 * 
 * Generates three synchronized, disjoint ZIP archives and manifest at:
 * D:\SIH-zip-files-gpt
 * 
 * Archives:
 * 1. medkit-source-assets.zip   - Application source and assets (src/, public/)
 * 2. medkit-tests.zip           - All unit, integration, and e2e tests & fixtures (tests/)
 * 3. medkit-supabase-config.zip - Supabase migrations, config, scripts, docs, lockfile
 * 
 * Manifest:
 * audit-package-manifest.json (placed beside the ZIPs, never inside)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Target destination
const DEFAULT_DESTINATION = "D:\\SIH-zip-files-gpt";
const destinationArgIndex = process.argv.indexOf("--dest");
const DESTINATION_DIR =
  destinationArgIndex !== -1 && process.argv[destinationArgIndex + 1]
    ? path.resolve(process.argv[destinationArgIndex + 1])
    : process.env.PACKAGE_DESTINATION
    ? path.resolve(process.env.PACKAGE_DESTINATION)
    : DEFAULT_DESTINATION;

// Archive file names
export const ARCHIVES = {
  SOURCE_ASSETS: "medkit-source-assets.zip",
  TESTS: "medkit-tests.zip",
  SUPABASE_CONFIG: "medkit-supabase-config.zip",
};

export const MANIFEST_NAME = "audit-package-manifest.json";

// Universal Exclusion Rules
const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "test-results",
  "playwright-report",
  "coverage",
  ".vercel",
  ".idea",
  ".vscode",
  ".staging",
  ".packaging-staging",
]);

const EXCLUDED_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  "tsconfig.tsbuildinfo",
  ".watcher.pid",
  ".packaging.lock",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".tmp",
  ".swp",
  ".swo",
  ".log",
  ".zip",
  ".bak",
]);

const EXCLUSION_PATTERNS = [
  "node_modules/**",
  ".next/**",
  ".git/**",
  "test-results/**",
  "playwright-report/**",
  "coverage/**",
  ".env (except .env.example)",
  ".env.*",
  "*.tsbuildinfo",
  ".packaging.lock",
  "*.tmp",
  "*.swp",
  "*.swo",
  "*.log",
  "*.zip",
  "*.bak",
  "Thumbs.db",
  ".DS_Store",
  `${DESTINATION_DIR}/**`,
];

// Suspicious secret patterns for pre-packaging security check
const SECRET_DETECTION_PATTERNS = [
  { name: "Google API Key", regex: /AIzaSy[A-Za-z0-9_-]{33}/ },
  { name: "OpenAI Secret Key", regex: /sk-[a-zA-Z0-9]{32,}/ },
  { name: "Anthropic Secret Key", regex: /sk-ant-[a-zA-Z0-9]{32,}/ },
  { name: "Generic Private Key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS Secret Access Key", regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*=\s*[A-Za-z0-9/+=]{40}/ },
];

/**
 * Normalizes relative file paths to forward-slash format
 */
function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

/**
 * Calculates SHA-256 hash of a file or buffer
 */
function sha256(contentOrPath) {
  const hash = crypto.createHash("sha256");
  if (typeof contentOrPath === "string" && fs.existsSync(contentOrPath)) {
    const buffer = fs.readFileSync(contentOrPath);
    hash.update(buffer);
  } else if (Buffer.isBuffer(contentOrPath)) {
    hash.update(contentOrPath);
  } else {
    hash.update(contentOrPath, "utf8");
  }
  return hash.digest("hex");
}

/**
 * Scan eligible files from project root
 */
function scanEligibleFiles(baseDir, currentRel = "") {
  const currentFull = path.join(baseDir, currentRel);
  if (!fs.existsSync(currentFull)) return [];

  // Exclude destination folder if it is located inside source root
  if (path.resolve(currentFull) === path.resolve(DESTINATION_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(currentFull, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
    const entryFull = path.join(baseDir, entryRel);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith(".staging-") || entry.name.startsWith("tmp-")) continue;
      results.push(...scanEligibleFiles(baseDir, entryRel));
    } else {
      if (EXCLUDED_FILE_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith(".env.") && entry.name !== ".env.example") continue;
      if (entry.name.startsWith(".")) {
        // Exclude OS metadata
        if (entry.name === ".DS_Store" || entry.name === ".Thumbs.db") continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDED_EXTENSIONS.has(ext)) continue;
      if (entry.name === "Thumbs.db") continue;

      const stats = fs.statSync(entryFull);
      results.push({
        relativePath: toPosix(entryRel),
        fullPath: entryFull,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    }
  }

  return results;
}

/**
 * Assign an eligible file to exactly one archive.
 */
export function categorizeFile(posixRelPath) {
  // 1. Source & Assets
  if (posixRelPath.startsWith("src/") || posixRelPath.startsWith("public/")) {
    return ARCHIVES.SOURCE_ASSETS;
  }

  // 2. Tests
  if (posixRelPath.startsWith("tests/")) {
    return ARCHIVES.TESTS;
  }

  // 3. Supabase & Configuration & Documentation
  if (
    posixRelPath.startsWith("supabase/") ||
    posixRelPath.startsWith("docs/") ||
    posixRelPath.startsWith(".github/") ||
    posixRelPath.startsWith("scripts/") ||
    [
      ".env.example",
      ".eslintrc.json",
      ".gitignore",
      "next-env.d.ts",
      "next.config.ts",
      "package-lock.json",
      "package.json",
      "playwright.config.ts",
      "postcss.config.mjs",
      "README.md",
      "AGENTS.md",
      "prompt_full.txt",
      "tailwind.config.ts",
      "tsconfig.json",
      "vitest.config.ts",
    ].includes(posixRelPath)
  ) {
    return ARCHIVES.SUPABASE_CONFIG;
  }

  // Unknown file: throw to avoid silent omission
  throw new Error(`Uncategorized eligible source file: "${posixRelPath}". Please update categorization rules.`);
}

/**
 * Scans staged files for leaked credentials or secrets
 */
function scanForSecrets(stagedFiles) {
  const violations = [];

  for (const file of stagedFiles) {
    // Only scan text / script / config files
    const ext = path.extname(file.relativePath).toLowerCase();
    const isTextFile = [
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".sql", ".yml", ".yaml", ".example", ".css"
    ].includes(ext);

    if (!isTextFile) continue;

    const content = fs.readFileSync(file.stagedPath, "utf8");

    // Special validation for .env.example: values must be placeholders
    if (file.relativePath === ".env.example") {
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const lineWithoutComment = trimmed.split(/\s+#/)[0].trim();
        const [key, ...rest] = lineWithoutComment.split("=");
        let val = rest.join("=").trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (
          val &&
          !val.startsWith("your-") &&
          !val.startsWith("http://localhost") &&
          !val.startsWith("https://your-project") &&
          !["true", "false", "demo", "production", "info", "debug", "warn", "error", "MedKit AI", "1.0.0", "gemini-2.5-flash"].includes(val)
        ) {
          violations.push({
            file: file.relativePath,
            reason: `Non-placeholder value found in .env.example for key ${key}`,
          });
        }
      }
      continue;
    }

    for (const pattern of SECRET_DETECTION_PATTERNS) {
      if (pattern.regex.test(content)) {
        violations.push({
          file: file.relativePath,
          reason: `Potential embedded credential matching pattern '${pattern.name}'`,
        });
        break;
      }
    }
  }

  if (violations.length > 0) {
    console.error("\n[SECURITY AUDIT FAILURE] Potentially sensitive credentials detected in eligible files:");
    for (const v of violations) {
      console.error(` - ${v.file}: ${v.reason}`);
    }
    console.error("Publication of archives is strictly blocked until resolved.\n");
    throw new Error("Secret scan failed. Publication aborted.");
  }
}

/**
 * Gets Git repository metadata if available
 */
function getGitMetadata() {
  try {
    const commit = execSync("git rev-parse HEAD", { cwd: PROJECT_ROOT, stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();
    const statusOutput = execSync("git status --porcelain", { cwd: PROJECT_ROOT, stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();
    return {
      commit,
      isDirty: statusOutput.length > 0,
    };
  } catch {
    return {
      commit: "unavailable",
      isDirty: "unavailable",
    };
  }
}

/**
 * Reads project version from package.json
 */
function getProjectVersion() {
  try {
    const pkgPath = path.join(PROJECT_ROOT, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Creates staged snapshot with change detection and retry
 */
function createStagedSnapshot(maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const initialScan = scanEligibleFiles(PROJECT_ROOT);
    const snapshotId = `snapshot-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const stagingDir = path.join(os.tmpdir(), `medkit-audit-stage-${snapshotId}`);
    fs.mkdirSync(stagingDir, { recursive: true });

    const stagedFiles = [];

    // Copy all eligible files to staging
    for (const file of initialScan) {
      const targetPath = path.join(stagingDir, file.relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(file.fullPath, targetPath);
      stagedFiles.push({
        relativePath: file.relativePath,
        stagedPath: targetPath,
        size: file.size,
        mtimeMs: file.mtimeMs,
        archive: categorizeFile(file.relativePath),
      });
    }

    // Verify source integrity during snapshot creation
    const postScan = scanEligibleFiles(PROJECT_ROOT);
    let changed = false;

    if (postScan.length !== initialScan.length) {
      changed = true;
    } else {
      const initialMap = new Map(initialScan.map((f) => [f.relativePath, f]));
      for (const current of postScan) {
        const prev = initialMap.get(current.relativePath);
        if (!prev || prev.size !== current.size || Math.abs(prev.mtimeMs - current.mtimeMs) > 10) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return { snapshotId, stagingDir, stagedFiles };
    }

    console.warn(`[Snapshot Notice] Source change detected during snapshot attempt ${attempt}/${maxRetries}. Retrying...`);
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}

    // Sleep 400ms before retry
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
  }

  throw new Error("Source tree modified during snapshot creation across all retry attempts. Aborting.");
}

/**
 * Builds ZIP archive using native Windows tar.exe
 */
function createZipArchive(stagingDir, fileList, outputZipPath) {
  const fileListPath = path.join(stagingDir, `filelist-${crypto.randomBytes(4).toString("hex")}.txt`);
  fs.writeFileSync(fileListPath, fileList.join("\n"), "utf8");

  try {
    // bsdtar / tar.exe creates native standard zip when file ends in .zip
    execFileSync("tar.exe", ["-a", "-c", "-f", outputZipPath, "-C", stagingDir, "-T", fileListPath], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } finally {
    try {
      fs.unlinkSync(fileListPath);
    } catch {}
  }

  if (!fs.existsSync(outputZipPath)) {
    throw new Error(`Failed to generate archive: ${outputZipPath}`);
  }

  const stat = fs.statSync(outputZipPath);
  const hash = sha256(outputZipPath);
  return {
    sizeBytes: stat.size,
    sha256: hash,
    fileCount: fileList.length,
  };
}

/**
 * Validates the generated ZIP archives in an isolated temporary extraction folder
 */
function validateStagedArchives(stagingDir, archivePaths, expectedFiles, manifest) {
  const validationDir = path.join(os.tmpdir(), `medkit-audit-val-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(validationDir, { recursive: true });

  try {
    // 1. Extract all archives into the same root
    for (const [archiveName, zipPath] of Object.entries(archivePaths)) {
      execFileSync("tar.exe", ["-xf", zipPath, "-C", validationDir], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    }

    // 2. Verify all expected files are present and match checksums
    const extractedFileSet = new Set();
    function scanExtracted(dir, rel = "") {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const eRel = rel ? `${rel}/${e.name}` : e.name;
        const eFull = path.join(dir, e.name);
        if (e.isDirectory()) {
          scanExtracted(eFull, eRel);
        } else {
          extractedFileSet.add(toPosix(eRel));
        }
      }
    }
    scanExtracted(validationDir);

    const expectedMap = new Map(expectedFiles.map((f) => [f.relativePath, f]));

    // Check for missing files
    for (const expected of expectedFiles) {
      if (!extractedFileSet.has(expected.relativePath)) {
        throw new Error(`Validation Error: File "${expected.relativePath}" missing from extracted archives.`);
      }
      const extractedPath = path.join(validationDir, expected.relativePath);
      const extractedHash = sha256(extractedPath);
      if (extractedHash !== expected.sha256) {
        throw new Error(`Validation Error: SHA-256 mismatch for "${expected.relativePath}". Expected ${expected.sha256}, got ${extractedHash}`);
      }
    }

    // Check for unexpected extra files
    for (const extracted of extractedFileSet) {
      if (!expectedMap.has(extracted)) {
        throw new Error(`Validation Error: Unexpected file "${extracted}" found in extracted archives.`);
      }
    }

    // Verify package.json and lockfile are intact
    const pkgJsonPath = path.join(validationDir, "package.json");
    const lockfilePath = path.join(validationDir, "package-lock.json");
    if (!fs.existsSync(pkgJsonPath)) throw new Error("Validation Error: package.json missing from config archive.");
    if (!fs.existsSync(lockfilePath)) throw new Error("Validation Error: package-lock.json missing from config archive.");

    JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")); // Parse test
    const lockStat = fs.statSync(lockfilePath);
    if (lockStat.size < 1000) throw new Error("Validation Error: package-lock.json appears corrupted or empty.");

    // Check that manifest does not introduce self-referential hash
    if (manifest.archives[MANIFEST_NAME]) {
      throw new Error("Validation Error: Manifest must not be an entry inside the archives.");
    }

    return true;
  } finally {
    try {
      fs.rmSync(validationDir, { recursive: true, force: true });
    } catch {}
  }
}

const LOCK_FILE = path.join(PROJECT_ROOT, ".packaging.lock");

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(timeoutMs = 60000) {
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(LOCK_FILE, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code === "EEXIST") {
        try {
          const content = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
          const isDead = content.pid && !isProcessAlive(content.pid);
          const isStale = content.createdAt && Date.now() - content.createdAt > 300000;
          if (isDead || isStale) {
            console.warn(`[Lock Warning] Removing stale lock from PID ${content.pid}.`);
            try {
              fs.unlinkSync(LOCK_FILE);
            } catch {}
            continue;
          }
        } catch {}

        if (Date.now() - start > timeoutMs) {
          throw new Error(`Packaging lock acquisition timed out after ${timeoutMs}ms. Another packaging process is active.`);
        }
        console.warn("[Lock Notice] Another packaging process holds .packaging.lock. Waiting...");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      } else {
        throw err;
      }
    }
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      if (content.pid === process.pid) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {}
}

process.on("exit", releaseLock);
process.on("SIGINT", () => {
  releaseLock();
  process.exit(1);
});
process.on("SIGTERM", () => {
  releaseLock();
  process.exit(1);
});

/**
 * Main Packaging Execution
 */
export async function runPackagingWorkflow() {
  acquireLock();
  try {
    return await executePackagingWorkflow();
  } finally {
    releaseLock();
  }
}

async function executePackagingWorkflow() {
  const startTime = Date.now();
  console.log(`\n=============================================================`);
  console.log(` MedKit AI — Source Packaging & Audit Generation`);
  console.log(` Destination: ${DESTINATION_DIR}`);
  console.log(`=============================================================`);

  // Ensure destination exists
  fs.mkdirSync(DESTINATION_DIR, { recursive: true });

  // 1. Create Staged Snapshot
  console.log("[1/6] Capturing verified project snapshot...");
  const { snapshotId, stagingDir, stagedFiles } = createStagedSnapshot();
  console.log(` -> Snapshot ID: ${snapshotId}`);
  console.log(` -> Total eligible files: ${stagedFiles.length}`);

  try {
    // 2. Secret Scan
    console.log("[2/6] Performing pre-packaging credential & security audit...");
    scanForSecrets(stagedFiles);
    console.log(" -> Clean. No hardcoded credentials or real keys found.");

    // 3. Compute Hashes & Partition Files
    console.log("[3/6] Categorizing files into disjoint distribution archives...");
    const filesByArchive = {
      [ARCHIVES.SOURCE_ASSETS]: [],
      [ARCHIVES.TESTS]: [],
      [ARCHIVES.SUPABASE_CONFIG]: [],
    };

    const manifestFiles = [];

    for (const file of stagedFiles) {
      const fileHash = sha256(file.stagedPath);
      file.sha256 = fileHash;
      filesByArchive[file.archive].push(file.relativePath);
      manifestFiles.push({
        relativePath: file.relativePath,
        archive: file.archive,
        sizeBytes: file.size,
        sha256: fileHash,
      });
    }

    // Sort deterministically
    manifestFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    for (const archiveName of Object.keys(filesByArchive)) {
      filesByArchive[archiveName].sort();
    }

    console.log(` -> ${ARCHIVES.SOURCE_ASSETS}: ${filesByArchive[ARCHIVES.SOURCE_ASSETS].length} files`);
    console.log(` -> ${ARCHIVES.TESTS}: ${filesByArchive[ARCHIVES.TESTS].length} files`);
    console.log(` -> ${ARCHIVES.SUPABASE_CONFIG}: ${filesByArchive[ARCHIVES.SUPABASE_CONFIG].length} files`);

    // 4. Create Archives in Temp Staging
    console.log("[4/6] Building compressed ZIP archives with native tar engine...");
    const tempArchivesDir = path.join(stagingDir, "out-zips");
    fs.mkdirSync(tempArchivesDir, { recursive: true });

    const archiveMetadata = {};
    const archivePaths = {};

    for (const [archiveName, fileList] of Object.entries(filesByArchive)) {
      const outZipPath = path.join(tempArchivesDir, archiveName);
      archivePaths[archiveName] = outZipPath;
      const meta = createZipArchive(stagingDir, fileList, outZipPath);
      archiveMetadata[archiveName] = meta;
      console.log(` -> Created ${archiveName}: ${(meta.sizeBytes / 1024).toFixed(1)} KB (SHA-256: ${meta.sha256.slice(0, 12)}...)`);
    }

    // 5. Construct & Write Manifest
    console.log("[5/6] Generating audit manifest & validating extracted packages...");
    const gitMeta = getGitMetadata();
    const manifest = {
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      snapshotId,
      projectVersion: getProjectVersion(),
      git: gitMeta,
      destination: DESTINATION_DIR,
      archives: archiveMetadata,
      files: manifestFiles,
      exclusions: EXCLUSION_PATTERNS,
      limitations: [],
    };

    const tempManifestPath = path.join(tempArchivesDir, MANIFEST_NAME);
    fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2), "utf8");

    // Perform complete extract-validation
    validateStagedArchives(stagingDir, archivePaths, manifestFiles, manifest);
    console.log(" -> Extraction validation passed: 100% file coverage, valid checksums, zero collisions.");

    // 6. Atomic Replacement in Destination
    console.log("[6/6] Publishing validated package set to destination...");

    const filesToDeploy = [
      ...Object.keys(ARCHIVES).map((k) => ARCHIVES[k]),
      MANIFEST_NAME,
    ];

    const backupsCreated = [];

    try {
      // Create .bak for existing files
      for (const fileName of filesToDeploy) {
        const destFilePath = path.join(DESTINATION_DIR, fileName);
        if (fs.existsSync(destFilePath)) {
          const bakPath = path.join(DESTINATION_DIR, `${fileName}.bak`);
          fs.copyFileSync(destFilePath, bakPath);
          backupsCreated.push({ orig: destFilePath, bak: bakPath });
        }
      }

      // Copy new files
      for (const fileName of filesToDeploy) {
        const srcPath = path.join(tempArchivesDir, fileName);
        const destPath = path.join(DESTINATION_DIR, fileName);
        fs.copyFileSync(srcPath, destPath);
      }

      // Cleanup .bak files on success
      for (const b of backupsCreated) {
        try {
          fs.unlinkSync(b.bak);
        } catch {}
      }
    } catch (deployErr) {
      console.error("[Deploy Error] Failed during destination write. Rolling back to previous good set...");
      for (const b of backupsCreated) {
        try {
          if (fs.existsSync(b.bak)) {
            fs.copyFileSync(b.bak, b.orig);
            fs.unlinkSync(b.bak);
          }
        } catch {}
      }
      throw deployErr;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=============================================================`);
    console.log(` SUCCESS: MedKit AI audit packages published in ${elapsed}s`);
    console.log(` Destination: ${DESTINATION_DIR}`);
    console.log(` - ${ARCHIVES.SOURCE_ASSETS}: ${(archiveMetadata[ARCHIVES.SOURCE_ASSETS].sizeBytes / 1024).toFixed(1)} KB`);
    console.log(` - ${ARCHIVES.TESTS}: ${(archiveMetadata[ARCHIVES.TESTS].sizeBytes / 1024).toFixed(1)} KB`);
    console.log(` - ${ARCHIVES.SUPABASE_CONFIG}: ${(archiveMetadata[ARCHIVES.SUPABASE_CONFIG].sizeBytes / 1024).toFixed(1)} KB`);
    console.log(` - ${MANIFEST_NAME}: ${(fs.statSync(path.join(DESTINATION_DIR, MANIFEST_NAME)).size / 1024).toFixed(1)} KB`);
    console.log(`=============================================================\n`);

    return {
      success: true,
      destination: DESTINATION_DIR,
      archives: archiveMetadata,
      manifest,
    };
  } finally {
    // Always clean up staging directory
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}
  }
}

// CLI execution entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPackagingWorkflow().catch((err) => {
    console.error(`\n[FATAL ERROR] Packaging workflow failed: ${err.message}`);
    process.exit(1);
  });
}
