import fs from "node:fs";
import path from "node:path";

// Excluded directories from credential scanning
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "test-results",
  "playwright-report",
  "dist",
  "build",
]);

// High-confidence credential-shaped regular expressions constructed safely to prevent self-detection
const SECRET_RULES = [
  {
    name: "Anthropic API Key",
    regex: new RegExp(["sk", "ant", "api[0-9]{2}", "[a-zA-Z0-9_\\-]{40,}"].join("-")),
  },
  {
    name: "Google API Key",
    regex: new RegExp("AIza" + "Sy[a-zA-Z0-9_\\-]{33}"),
  },
  {
    name: "OpenAI Project API Key",
    regex: new RegExp(["sk", "proj", "[a-zA-Z0-9_\\-]{40,}"].join("-")),
  },
  {
    name: "AWS Access Key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN (?:RSA|EC|OPENSSH|PGP|ENCRYPTED|DSA)? ?PRIVATE KEY-----/,
  },
];

let totalFilesScanned = 0;
let violationsFound = 0;

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      totalFilesScanned++;
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  // Avoid scanning binary or very large archives
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".zip", ".tar", ".gz", ".woff", ".woff2"].includes(ext)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const rule of SECRET_RULES) {
        if (rule.regex.test(line)) {
          // Verify it is not an example or placeholder
          if (
            line.includes("placeholder") ||
            line.includes("your-api-key") ||
            line.includes("sk-ant-api03-EXAMPLE") ||
            line.includes("AIzaSyEXAMPLE")
          ) {
            continue;
          }

          console.error(
            `::error file=${filePath},line=${i + 1}::Potential hardcoded credential detected [${rule.name}]`
          );
          violationsFound++;
        }
      }
    }
  } catch {
    // Non-text file or unreadable; skip safely
  }
}

console.log("Starting repository secret hygiene scan...");
scanDirectory(process.cwd());

console.log(`Scan completed: ${totalFilesScanned} files evaluated.`);

if (violationsFound > 0) {
  console.error(`FAILURE: Found ${violationsFound} potential hardcoded credential leak(s).`);
  process.exit(1);
} else {
  console.log("SUCCESS: Zero credential leaks detected across scanned repository.");
  process.exit(0);
}
