import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase B Target 4: TOTP Service Isolation Architecture Boundary", () => {
  const scannedDirs = [
    path.join(process.cwd(), "src", "app", "api", "auth"),
    path.join(process.cwd(), "src", "features", "auth"),
    path.join(process.cwd(), "src", "lib", "auth"),
  ];

  function getFilesRecursively(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getFilesRecursively(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("verifies zero clinician auth, login, or onboarding routes import totp-service", () => {
    const allFiles: string[] = [];
    for (const dir of scannedDirs) {
      allFiles.push(...getFilesRecursively(dir));
    }

    // Also include clinician onboarding service
    allFiles.push(path.join(process.cwd(), "src", "features", "onboarding", "clinician-onboarding-service.ts"));

    expect(allFiles.length).toBeGreaterThanOrEqual(5);

    const violatingFiles: { file: string; match: string }[] = [];

    for (const filePath of allFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf-8");

      // Check for totp-service import
      if (content.includes("totp-service")) {
        violatingFiles.push({ file: filePath, match: "totp-service import" });
      }
    }

    expect(
      violatingFiles,
      `Architecture violation: Clinician auth code must NOT import totp-service: ${JSON.stringify(violatingFiles)}`
    ).toEqual([]);
  });

  it("verifies clinician-onboarding-service relies exclusively on Supabase Auth MFA in production", () => {
    const servicePath = path.join(process.cwd(), "src", "features", "onboarding", "clinician-onboarding-service.ts");
    const content = fs.readFileSync(servicePath, "utf-8");

    // Must call Supabase Auth MFA methods
    expect(content).toContain("userClient.auth.mfa.enroll");
    expect(content).toContain("userClient.auth.mfa.challengeAndVerify");

    // Must NOT import totp-service
    expect(content).not.toContain('from "./totp-service"');
    expect(content).not.toContain('from "@/features/onboarding/totp-service"');
  });

  it("verifies api-guard enforces current-session AAL2 and rejects AAL1 sessions", () => {
    const guardPath = path.join(process.cwd(), "src", "lib", "auth", "api-guard.ts");
    const content = fs.readFileSync(guardPath, "utf-8");

    expect(content).toContain('user.aal !== "aal2"');
    expect(content).toContain('error: "MFA_REQUIRED"');
  });
});
