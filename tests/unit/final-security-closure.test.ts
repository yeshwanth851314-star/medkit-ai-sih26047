import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockDb } from "@/lib/db/mock-adapter";
import {
  createInterviewSession,
  submitInterviewAnswerAsync,
  compileInterviewToCase,
  getInterviewSession,
} from "@/features/interview/interview-service";
import { AuthUser, toPublicAuthUser } from "@/features/auth/types";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as meRoute } from "@/app/api/auth/me/route";

describe("MedKit AI — Scope-Frozen Final Security Closure", () => {
  const validPatientId = "00000000-0000-0000-0000-000000000001";
  const validKioskId = "00000000-0000-0000-0000-000000000001";
  const validKioskSecret = "kiosk-secret-hyd-01";

  beforeEach(() => {
    // Reset or clean mock state if needed
  });

  describe("P0-01: Session State Transition Integrity (Trigger & RPC Hardening)", () => {
    it("migration 000005 exists and enforces transition trigger, allowlists, and RPC boundaries", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20260911000005_final_session_state_authority.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // 1. Trigger and trigger function
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.check_intake_session_transition");
      expect(sql).toContain("trg_enforce_intake_session_transitions");
      expect(sql).toContain("INVALID_STATE_TRANSITION");
      expect(sql).toContain("SESSION_REVOKED");

      // 2. rpc_revoke_kiosk_session hardening
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_revoke_kiosk_session");
      expect(sql).toContain("INVALID_TARGET_STATUS");

      // 3. rpc_submit_kiosk_answer revocation check
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_submit_kiosk_answer");
      expect(sql).toContain("FROM public.kiosk_capability_revocations");

      // 4. rpc_submit_intake_to_case privileged service role boundary
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_submit_intake_to_case");
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.rpc_submit_intake_to_case(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.rpc_submit_intake_to_case(UUID, UUID, TEXT, JSONB) TO service_role;");

      // 5. rpc_update_kiosk_intake_session lockdown
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.rpc_update_kiosk_intake_session(UUID, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;");
    });

    it("prevents reopening a terminated session (submitted -> active) via updateIntakeSession", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      // Set to submitted
      await mockDb.updateIntakeSession(session.id, { status: "submitted" });

      // Attempt to reopen to active must fail closed
      await expect(
        mockDb.updateIntakeSession(session.id, { status: "active" })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
    });

    it("prevents reopening an abandoned session (abandoned -> active) via updateIntakeSession", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      await mockDb.updateIntakeSession(session.id, { status: "abandoned" });

      await expect(
        mockDb.updateIntakeSession(session.id, { status: "active" })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
    });

    it("prevents activating a revoked session via updateIntakeSession", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      mockDb.recordRevocation(session.id, "clinician_cancelled", "abandoned");

      await expect(
        mockDb.updateIntakeSession(session.id, { status: "active" })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION|SESSION_REVOKED/);
    });

    it("revokeKioskSession rejects disallowed target status (e.g. active or invalid)", async () => {
      const session = await createInterviewSession(validPatientId, "en");

      await expect(
        mockDb.revokeKioskSession({
          kioskId: validKioskId,
          kioskSecret: validKioskSecret,
          sessionId: session.id,
          targetStatus: "active" as any,
        })
      ).rejects.toThrow(/INVALID_TARGET_STATUS/);
    });

    it("revokeKioskSession rejects invalid transition from submitted to abandoned", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      await mockDb.updateIntakeSession(session.id, { status: "submitted" });

      await expect(
        mockDb.revokeKioskSession({
          kioskId: validKioskId,
          kioskSecret: validKioskSecret,
          sessionId: session.id,
          targetStatus: "abandoned",
        })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
    });

    it("revokeKioskSession permits idempotent replay on already terminal session", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      await mockDb.revokeKioskSession({
        kioskId: validKioskId,
        kioskSecret: validKioskSecret,
        sessionId: session.id,
        targetStatus: "abandoned",
      });

      // Idempotent replay with same targetStatus succeeds
      await expect(
        mockDb.revokeKioskSession({
          kioskId: validKioskId,
          kioskSecret: validKioskSecret,
          sessionId: session.id,
          targetStatus: "abandoned",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("P0-02: Memory Cache Stale Overwrite Prevention", () => {
    it("submitInterviewAnswerAsync evicts cached session and rejects if durable state is revoked", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      expect(getInterviewSession(session.id)).toBeDefined();

      // Durably revoke the session out-of-band (e.g. by clinician)
      mockDb.recordRevocation(session.id, "clinician_cancelled", "abandoned");

      // Attempting to submit an answer must check durable state, evict stale cache, and throw
      await expect(
        submitInterviewAnswerAsync(session.id, "Chest pain since yesterday", "touch")
      ).rejects.toThrow(/SESSION_REVOKED/);

      // In-memory cache must now be evicted
      expect(getInterviewSession(session.id)).toBeNull();
    });

    it("submitInterviewAnswerAsync evicts cached session and rejects if durable state is abandoned", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      expect(getInterviewSession(session.id)).toBeDefined();

      // Out-of-band transition to abandoned
      const existing = await mockDb.getIntakeSessionById(session.id);
      if (existing) {
        existing.status = "abandoned";
      }

      await expect(
        submitInterviewAnswerAsync(session.id, "Persistent dry cough", "touch")
      ).rejects.toThrow(/SESSION_NOT_ACTIVE/);

      expect(getInterviewSession(session.id)).toBeNull();
    });

    it("compileInterviewToCase evicts cached session and rejects if durable state is revoked", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      // Add answer
      await submitInterviewAnswerAsync(session.id, "Severe joint pain and morning stiffness for 3 months", "text");
      expect(getInterviewSession(session.id)).toBeDefined();

      // Clinician revokes session durably
      mockDb.recordRevocation(session.id, "clinician_emergency_override", "abandoned");

      // Compiling must detect durable revocation, evict in-memory cache, and fail closed
      await expect(
        compileInterviewToCase(session.id)
      ).rejects.toThrow(/UNAUTHORIZED/);

      expect(getInterviewSession(session.id)).toBeNull();
    });
  });

  describe("P1-01: Red-Flag Privileged RPC Boundary", () => {
    it("submitIntakeToCase rejects compiling from revoked session in mock adapter", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      mockDb.recordRevocation(session.id, "tampered_session", "abandoned");

      await expect(
        mockDb.submitIntakeToCase({
          sessionId: session.id,
          kioskId: validKioskId,
          kioskSecret: validKioskSecret,
        })
      ).rejects.toThrow(/SESSION_REVOKED/);
    });

    it("submitKioskAnswer in mockDb rejects answer for revoked session", async () => {
      const session = await createInterviewSession(validPatientId, "en");
      mockDb.recordRevocation(session.id, "patient_left", "abandoned");

      await expect(
        mockDb.submitKioskAnswer({
          kioskId: validKioskId,
          kioskSecret: validKioskSecret,
          sessionId: session.id,
          questionKey: "chief_complaint",
          rawAnswer: "Fever and chills",
        })
      ).rejects.toThrow(/SESSION_REVOKED/);
    });
  });

  describe("P1-02: Auth API Credential Leakage Prevention", () => {
    it("toPublicAuthUser strips supabaseToken, refreshToken, and tokenExpiresAt", () => {
      const internalUser: AuthUser = {
        id: "usr-doc-001",
        email: "doctor@aiia.gov.in",
        fullName: "Dr. Ayush Sharma",
        role: "doctor",
        facilityId: "fac-hyd-01",
        supabaseToken: "secret-supabase-jwt-token-12345",
        refreshToken: "secret-refresh-token-67890",
        tokenExpiresAt: 1893456000,
      };

      const publicUser = toPublicAuthUser(internalUser);

      expect(publicUser.id).toBe("usr-doc-001");
      expect(publicUser.email).toBe("doctor@aiia.gov.in");
      expect(publicUser.fullName).toBe("Dr. Ayush Sharma");
      expect(publicUser.role).toBe("doctor");
      expect(publicUser.facilityId).toBe("fac-hyd-01");

      // Verify credentials are not present on the sanitized object
      expect((publicUser as any).supabaseToken).toBeUndefined();
      expect((publicUser as any).refreshToken).toBeUndefined();
      expect((publicUser as any).tokenExpiresAt).toBeUndefined();
    });

    it("POST /api/auth/login does not leak internal tokens in response JSON", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "doctor@medkit.ai",
          password: "doctor123",
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user).toBeDefined();
      expect(json.user.id).toBeDefined();
      expect(json.user.email).toBe("doctor@medkit.ai");

      // Internal credentials must strictly be absent
      expect(json.user.supabaseToken).toBeUndefined();
      expect(json.user.refreshToken).toBeUndefined();
      expect(json.user.tokenExpiresAt).toBeUndefined();
    });

    it("GET /api/auth/me does not leak internal tokens in response JSON", async () => {
      const sessionModule = await import("@/lib/auth/session");

      // 1. When unauthenticated, returns 401
      const unauthSpy = vi.spyOn(sessionModule, "getCurrentUser").mockResolvedValueOnce(null);
      const unauthRes = await meRoute();
      expect(unauthRes.status).toBe(401);
      const unauthJson = await unauthRes.json();
      expect(unauthJson.authenticated).toBe(false);
      expect(unauthJson.user).toBeNull();
      unauthSpy.mockRestore();

      // 2. When authenticated with internal tokens, toPublicAuthUser strictly sanitizes them
      const authSpy = vi.spyOn(sessionModule, "getCurrentUser").mockResolvedValueOnce({
        id: "usr-doc-0001",
        email: "doctor@medkit.ai",
        fullName: "Dr. Ananya Rao, MD",
        role: "doctor",
        facilityId: "fac-hyd-01",
        supabaseToken: "secret-supabase-jwt-token-internal",
        refreshToken: "secret-refresh-internal",
        tokenExpiresAt: 1999999999,
      });

      const res = await meRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.user).toBeDefined();
      expect(json.user.email).toBe("doctor@medkit.ai");
      expect(json.user.supabaseToken).toBeUndefined();
      expect(json.user.refreshToken).toBeUndefined();
      expect(json.user.tokenExpiresAt).toBeUndefined();

      authSpy.mockRestore();
    });
  });
});
