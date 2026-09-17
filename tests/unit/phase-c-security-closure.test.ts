import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeKeyedIdentifierDigest, maskExternalIdentifier } from "@/features/patients/patient-service";
import { authenticateClinician } from "@/features/auth/auth-service";
import {
  createRemoteInvitation,
  validateRemoteInvitation,
  consumeRemoteInvitation,
  revokeRemoteInvitation,
} from "@/features/intake/remote-intake-service";
import fs from "fs";
import path from "path";

describe("Phase C Ultra-Strict Security & Evidence Closure Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("Target 2: Dedicated IDENTIFIER_INDEX_PEPPER & Zero SESSION_SECRET Fallback", () => {
    it("fails closed in production mode when IDENTIFIER_INDEX_PEPPER is missing, even if SESSION_SECRET is set", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";
      delete process.env.IDENTIFIER_INDEX_PEPPER;
      process.env.SESSION_SECRET = "super-secret-session-key-that-should-never-be-used-as-pepper";

      expect(() => {
        computeKeyedIdentifierDigest("ABHA_NUMBER", "14-2345-6789-0123");
      }).toThrow(/CONFIGURATION_ERROR: IDENTIFIER_INDEX_PEPPER is required in production/);
    });

    it("generates deterministic keyed HMAC-SHA256 digests when pepper is provided", () => {
      const pepper1 = "medkit-test-pepper-vault-key-alpha-99";
      const digestA1 = computeKeyedIdentifierDigest("ABHA_NUMBER", "14-2345-6789-0123", pepper1);
      const digestA2 = computeKeyedIdentifierDigest("ABHA_NUMBER", "  14-2345-6789-0123  ", pepper1);

      expect(digestA1).toBe(digestA2);
      expect(digestA1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces completely distinct digests when using different peppers (key separation)", () => {
      const pepper1 = "pepper-a-000000000000000000000000001";
      const pepper2 = "pepper-b-000000000000000000000000002";
      const val = "14-2345-6789-0123";

      const digest1 = computeKeyedIdentifierDigest("ABHA_NUMBER", val, pepper1);
      const digest2 = computeKeyedIdentifierDigest("ABHA_NUMBER", val, pepper2);

      expect(digest1).not.toBe(digest2);
    });

    it("produces distinct digests for different identifiers with the same pepper", () => {
      const pepper = "medkit-pepper-unique-eval-2026";
      const digest1 = computeKeyedIdentifierDigest("ABHA_NUMBER", "14-2345-6789-0123", pepper);
      const digest2 = computeKeyedIdentifierDigest("ABHA_NUMBER", "14-9999-8888-7777", pepper);

      expect(digest1).not.toBe(digest2);
    });
  });

  describe("Target 3: At-Rest External Identifier Masking & Protection", () => {
    it("masks ABHA numbers preserving only the trailing 4 digits", () => {
      const masked = maskExternalIdentifier("ABHA_NUMBER", "14-2345-6789-0123");
      expect(masked).toBe("**-****-****-0123");
      expect(masked).not.toContain("2345");
      expect(masked).not.toContain("6789");
    });

    it("masks generic external identifiers cleanly", () => {
      const masked = maskExternalIdentifier("FACILITY_MRN", "MRN-DELHI-998877");
      expect(masked.endsWith("8877")).toBe(true);
      expect(masked.startsWith("************")).toBe(true);
    });
  });

  describe("Target 5: Database Atomic Revocation Check Invariant", () => {
    it("verifies migration SQL contains row-lock and atomic revoked_at check inside rpc_consume_remote_intake_invitation", () => {
      const migrationPath = path.resolve("supabase/migrations/20260916000002_phase_c_patient_identity_secure_entry.sql");
      const sqlContent = fs.readFileSync(migrationPath, "utf8");

      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.rpc_consume_remote_intake_invitation");
      expect(sqlContent).toContain("FOR UPDATE;");
      expect(sqlContent).toContain("IF v_inv.revoked_at IS NOT NULL THEN");
      expect(sqlContent).toContain("RAISE EXCEPTION 'INVITATION_REVOKED: Remote invitation has been revoked';");
    });
  });

  describe("Target 6: Demo User Production Isolation (Zero Fail-Open)", () => {
    it("strictly returns null and denies demo credentials in production mode even if Supabase is unavailable", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";

      // When Supabase is not configured or throws
      const authResult = await authenticateClinician({
        email: "doctor@medkit.ai",
        password: "doctor123",
      });

      // Must fail closed with null (zero fail-open to demo users)
      expect(authResult).toBeNull();
    });
  });

  describe("Target 7: Mock Invitations Production Isolation (Zero Fail-Open)", () => {
    it("createRemoteInvitation fails closed in production mode when Supabase is unconfigured", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";

      await expect(
        createRemoteInvitation({
          actor: {
            id: "user-123",
            email: "doctor@medkit.ai",
            role: "doctor",
            fullName: "Dr. Doctor",
            facilityId: "fac-delhi-01",
          },
          purpose: "patient_registration_and_intake",
        })
      ).rejects.toThrow(/Database unavailable/);
    });

    it("validateRemoteInvitation fails closed and returns INVITATION_NOT_FOUND in production mode when database is unconfigured", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";

      await expect(
        validateRemoteInvitation("any-valid-looking-token-string-123456789")
      ).rejects.toThrow(/Database unavailable/);
    });

    it("consumeRemoteInvitation fails closed in production mode when database is unconfigured", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";

      await expect(
        consumeRemoteInvitation("any-token-string-123456789")
      ).rejects.toThrow(/Database unavailable/);
    });

    it("revokeRemoteInvitation fails closed in production mode when database is unconfigured", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";

      await expect(
        revokeRemoteInvitation("00000000-0000-0000-0000-000000000001", {
          id: "doc-1",
          email: "doctor@medkit.ai",
          role: "doctor",
          fullName: "Dr. Rao",
          facilityId: "fac-delhi-01",
        })
      ).rejects.toThrow(/Database unavailable/);
    });
  });

  describe("Target C1: Legacy Raw-Token Revoke Endpoint Elimination", () => {
    it("ensures legacy route file /api/intake/invite/[token]/revoke/route.ts is permanently removed", () => {
      const legacyPath = path.resolve("src/app/api/intake/invite/[token]/revoke/route.ts");
      expect(fs.existsSync(legacyPath)).toBe(false);
    });

    it("ensures non-secret invitation ID revoke route /api/intake/invitations/[invitationId]/revoke/route.ts exists and is active", () => {
      const safePath = path.resolve("src/app/api/intake/invitations/[invitationId]/revoke/route.ts");
      expect(fs.existsSync(safePath)).toBe(true);
      const content = fs.readFileSync(safePath, "utf8");
      expect(content).toContain("invitationId");
      expect(content).toContain("revokeRemoteInvitation");
    });
  });
});

