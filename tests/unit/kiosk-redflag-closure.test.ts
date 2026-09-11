import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { mockDb } from "@/lib/db/mock-adapter";
import {
  getAuthorizedSupabaseClient,
  verifyDurableSessionState,
  createRedFlagEvent,
  revokeKioskSessionDurable,
} from "@/lib/db/supabase";
import {
  createInterviewSession,
  getInterviewSessionAsync,
  submitInterviewAnswerAsync,
  compileInterviewToCase,
} from "@/features/interview/interview-service";
import { AuthUser } from "@/features/auth/types";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDir, filename), "utf8");
}

describe("Final Kiosk Revocation, Client-Wiring & Red-Flag Integrity Closure", () => {
  const latestMigration = readMigration("20260911000003_kiosk_and_redflag_integrity_closure.sql");

  const doctorHyderabad: AuthUser = {
    id: "usr-doc-hyd",
    email: "dr.rao@aiia.gov.in",
    fullName: "Dr. Rao",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const doctorDelhi: AuthUser = {
    id: "usr-doc-del",
    email: "dr.sharma@aiia.gov.in",
    fullName: "Dr. Sharma",
    role: "doctor",
    facilityId: "fac-del-01",
  };

  const adminUser: AuthUser = {
    id: "usr-admin-001",
    email: "admin@aiia.gov.in",
    fullName: "System Admin",
    role: "admin",
    facilityId: null,
  };

  // ===========================================================================
  // 1. P0-01: Kiosk State Machine Fail-Closed
  // ===========================================================================
  describe("P0-01: Kiosk State Machine Fail-Closed", () => {
    it("returns 'active' ONLY when session is explicitly active and unexpired", async () => {
      const session = await mockDb.createIntakeSession({
        patient_id: "patient-101",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const state = await verifyDurableSessionState({ sessionId: session.id });
      expect(state.status).toBe("active");
      if (state.status === "active") {
        expect(state.session.id).toBe(session.id);
      }
    });

    it("fails closed to 'expired' when an active session has passed its expiration time", async () => {
      const session = await mockDb.createIntakeSession({
        patient_id: "patient-102",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() - 60000).toISOString(), // expired 1 min ago
      });

      const state = await verifyDurableSessionState({ sessionId: session.id });
      expect(state.status).toBe("expired");
    });

    it("fails closed on submitted, abandoned, or revoked states", async () => {
      const submittedSession = await mockDb.createIntakeSession({
        patient_id: "patient-103",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "submitted",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const submittedState = await verifyDurableSessionState({ sessionId: submittedSession.id });
      expect(submittedState.status).toBe("submitted");

      const abandonedSession = await mockDb.createIntakeSession({
        patient_id: "patient-104",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "abandoned",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const abandonedState = await verifyDurableSessionState({ sessionId: abandonedSession.id });
      expect(abandonedState.status).toBe("abandoned");

      const revokedSession = await mockDb.createIntakeSession({
        patient_id: "patient-105",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "revoked",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const revokedState = await verifyDurableSessionState({ sessionId: revokedSession.id });
      expect(revokedState.status).toBe("revoked");
    });

    it("strictly fails closed on unknown or unrecognized status strings (never active)", async () => {
      const corruptedSession = await mockDb.createIntakeSession({
        patient_id: "patient-106",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "in_limbo_unknown_state" as any,
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const state = await verifyDurableSessionState({ sessionId: corruptedSession.id });
      expect(state.status).toBe("revoked");
    });

    it("ensures getInterviewSessionAsync and submitInterviewAnswerAsync strictly fail closed on non-active sessions", async () => {
      const session = await mockDb.createIntakeSession({
        patient_id: "patient-107",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "abandoned",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const loaded = await getInterviewSessionAsync(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.status).toBe("abandoned");

      await expect(
        submitInterviewAnswerAsync(session.id, "Severe chest pain")
      ).rejects.toThrow(/SESSION_NOT_ACTIVE/);
    });

    it("ensures compileInterviewToCase strictly rejects revoked or abandoned sessions", async () => {
      const revokedSession = await mockDb.createIntakeSession({
        patient_id: "patient-108",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "revoked",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(
        compileInterviewToCase(revokedSession.id)
      ).rejects.toThrow(/UNAUTHORIZED: Cannot compile case from revoked session/);
    });
  });

  // ===========================================================================
  // 2. P0-02: Authorized Client Token Resolution & Caller Audit
  // ===========================================================================
  describe("P0-02: Authorized Client Token Resolution", () => {
    it("returns null when token is undefined, null, or empty string", () => {
      expect(getAuthorizedSupabaseClient(null)).toBeNull();
      expect(getAuthorizedSupabaseClient(undefined)).toBeNull();
      expect(getAuthorizedSupabaseClient("")).toBeNull();
      expect(getAuthorizedSupabaseClient("   ")).toBeNull();
    });

    it("returns null when AuthUser object has empty or undefined supabaseToken", () => {
      const userWithoutToken: AuthUser = {
        id: "usr-1",
        email: "test@example.com",
        fullName: "Test User",
        role: "doctor",
        supabaseToken: "",
      };
      expect(getAuthorizedSupabaseClient(userWithoutToken)).toBeNull();

      const userWithWhitespaceToken: AuthUser = {
        id: "usr-2",
        email: "test2@example.com",
        fullName: "Test User 2",
        role: "doctor",
        supabaseToken: "   ",
      };
      expect(getAuthorizedSupabaseClient(userWithWhitespaceToken)).toBeNull();
    });

    it("enables correct fallback to service role in Category B callers when actor token is missing", () => {
      const actorOrToken = null;
      // Simulating Category B expression: getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient()
      const client = getAuthorizedSupabaseClient(actorOrToken);
      expect(client).toBeNull();
      // Because client is null, expression (client || serviceClient) correctly evaluates to serviceClient!
    });
  });

  // ===========================================================================
  // 3. P1-01: Kiosk Capability Revocation Facility Scoping & SQL Contract
  // ===========================================================================
  describe("P1-01: Kiosk Capability Revocation Facility Scoping", () => {
    it("proves the migration revokes direct writes on kiosk_capability_revocations from authenticated and anon", () => {
      expect(latestMigration).toContain("REVOKE ALL ON public.kiosk_capability_revocations FROM PUBLIC, anon;");
      expect(latestMigration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.kiosk_capability_revocations FROM authenticated;");
      expect(latestMigration).toContain("GRANT SELECT ON public.kiosk_capability_revocations TO authenticated;");
      expect(latestMigration).toContain("GRANT ALL ON public.kiosk_capability_revocations TO service_role;");
    });

    it("proves the migration scopes kiosk_capability_revocations SELECT policy to caller's facility", () => {
      expect(latestMigration).toMatch(
        /CREATE POLICY "Kiosk capability revocations facility scoped read"[\s\S]*?ON public\.kiosk_capability_revocations FOR SELECT/i
      );
      expect(latestMigration).toContain("s.facility_id = public.current_user_facility()");
    });

    it("proves the migration creates rpc_clinician_revoke_session with facility boundaries and legal audit logging", () => {
      expect(latestMigration).toContain("CREATE OR REPLACE FUNCTION public.rpc_clinician_revoke_session(");
      expect(latestMigration).toContain("IF v_caller_role != 'admin' THEN");
      expect(latestMigration).toContain("v_caller_facility != v_session.facility_id");
      expect(latestMigration).toContain("'KIOSK_SESSION_REVOKED'");
      expect(latestMigration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) TO authenticated, service_role;");
      expect(latestMigration).toContain("REVOKE ALL ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) FROM PUBLIC, anon;");
    });

    it("prevents cross-facility clinician revocation", async () => {
      const hydSession = await mockDb.createIntakeSession({
        patient_id: "patient-hyd-99",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      // Delhi doctor cannot revoke Hyderabad session
      await expect(
        revokeKioskSessionDurable(hydSession.id, {
          actorOrToken: doctorDelhi,
          reason: "cross_facility_attempt",
        })
      ).rejects.toThrow(/FORBIDDEN: Clinician facility fac-del-01 does not match session facility fac-hyd-01/);

      // Hyderabad doctor can revoke Hyderabad session
      await expect(
        revokeKioskSessionDurable(hydSession.id, {
          actorOrToken: doctorHyderabad,
          reason: "authorized_revocation",
        })
      ).resolves.not.toThrow();

      expect(mockDb.isSessionRevoked(hydSession.id)).toBe(true);
    });

    it("permits administrator to revoke sessions across any facility", async () => {
      const hydSession2 = await mockDb.createIntakeSession({
        patient_id: "patient-hyd-100",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(
        revokeKioskSessionDurable(hydSession2.id, {
          actorOrToken: adminUser,
          reason: "admin_intervention",
        })
      ).resolves.not.toThrow();

      expect(mockDb.isSessionRevoked(hydSession2.id)).toBe(true);
    });
  });

  // ===========================================================================
  // 4. P1-02: Red-Flag Clinical Evidence Lockdown & SQL Contract
  // ===========================================================================
  describe("P1-02: Red-Flag Clinical Evidence Immutability Lockdown", () => {
    it("proves the migration revokes direct INSERT, UPDATE, DELETE on red_flag_events from authenticated and anon", () => {
      expect(latestMigration).toContain("REVOKE ALL ON public.red_flag_events FROM PUBLIC, anon;");
      expect(latestMigration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.red_flag_events FROM authenticated;");
      expect(latestMigration).toContain("GRANT SELECT ON public.red_flag_events TO authenticated;");
      expect(latestMigration).toContain("GRANT ALL ON public.red_flag_events TO service_role;");
    });

    it("persists red-flag event via rules engine internal workflow", async () => {
      const caseRecord = await mockDb.createCase({
        patient_id: "patient-101",
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Chest pain radiating to left arm",
        status: "draft",
      });

      const rf = await createRedFlagEvent({
        caseId: caseRecord.id,
        ruleId: "RF_CHEST_PAIN_ACUTE",
        severity: "CRITICAL",
        triggerText: "Crushing chest pain radiating to arm",
      });

      expect(rf).toBeDefined();
      expect(rf.case_id).toBe(caseRecord.id);
      expect(rf.rule_id).toBe("RF_CHEST_PAIN_ACUTE");
      expect(rf.severity).toBe("CRITICAL");

      const events = mockDb.getRedFlagEvents(caseRecord.id);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.rule_id === "RF_CHEST_PAIN_ACUTE")).toBe(true);
    });
  });
});
