import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { mockDb } from "@/lib/db/mock-adapter";
import {
  revokeKioskSessionDurable,
  getIntakeSessionById,
  createIntakeSession,
} from "@/lib/db/supabase";
import {
  createInterviewSession,
  getInterviewSessionAsync,
  submitInterviewAnswerAsync,
  compileInterviewToCase,
} from "@/features/interview/interview-service";
import { AuthUser } from "@/features/auth/types";
import { signSessionToken } from "@/lib/auth/jwt";
import { POST as startRoute } from "@/app/api/interviews/route";
import { POST as answerRoute } from "@/app/api/interviews/[id]/answer/route";
import { POST as submitRoute } from "@/app/api/interviews/[id]/submit/route";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDir, filename), "utf8");
}

describe("Final Clinician Actor Propagation & Revocation Integrity Closure", () => {
  const latestMigration = readMigration("20260911000004_clinician_actor_and_revocation_integrity.sql");

  const doctorHydBase: Omit<AuthUser, "supabaseToken"> = {
    id: "usr-doc-hyd-closure",
    email: "dr.rao.closure@aiia.gov.in",
    fullName: "Dr. Rao Closure",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };
  const hydToken = signSessionToken(doctorHydBase);
  const doctorHyderabad: AuthUser = {
    ...doctorHydBase,
    supabaseToken: hydToken,
  };

  const doctorDelBase: Omit<AuthUser, "supabaseToken"> = {
    id: "usr-doc-del-closure",
    email: "dr.sharma.closure@aiia.gov.in",
    fullName: "Dr. Sharma Closure",
    role: "doctor",
    facilityId: "fac-del-01",
  };
  const delToken = signSessionToken(doctorDelBase);
  const doctorDelhi: AuthUser = {
    ...doctorDelBase,
    supabaseToken: delToken,
  };

  // ===========================================================================
  // 1. P1-01: Migration SQL Contract & Revocation Transition Integrity
  // ===========================================================================
  describe("P1-01: rpc_clinician_revoke_session Hardened SQL Contract", () => {
    it("proves the migration replaces rpc_clinician_revoke_session", () => {
      expect(latestMigration).toContain("CREATE OR REPLACE FUNCTION public.rpc_clinician_revoke_session(");
    });

    it("proves the migration validates p_target_status against an explicit allowlist", () => {
      expect(latestMigration).toContain("IF p_target_status IS NULL OR p_target_status NOT IN ('abandoned', 'submitted') THEN");
      expect(latestMigration).toContain("RAISE EXCEPTION 'INVALID_TARGET_STATUS: Target status must be abandoned or submitted, received %', p_target_status;");
    });

    it("proves the migration enforces valid state transitions and permits idempotent replay", () => {
      expect(latestMigration).toContain("IF v_session.status = p_target_status THEN");
      expect(latestMigration).toContain("ELSIF v_session.status = 'active' AND p_target_status IN ('abandoned', 'submitted') THEN");
      expect(latestMigration).toContain("RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot transition session % from % to %'");
    });

    it("proves SECURITY DEFINER, search_path hardening, and role privilege boundaries", () => {
      expect(latestMigration).toContain("SECURITY DEFINER SET search_path = public, pg_temp;");
      expect(latestMigration).toContain("REVOKE ALL ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) FROM PUBLIC, anon;");
      expect(latestMigration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) TO authenticated, service_role;");
    });
  });

  describe("P1-01: Runtime Target Status and Transition Validation", () => {
    it("strictly rejects disallowed target statuses with INVALID_TARGET_STATUS", async () => {
      const session = await mockDb.createIntakeSession({
        patient_id: "patient-rev-01",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      // Target status 'active' is not allowed
      await expect(
        revokeKioskSessionDurable(session.id, {
          targetStatus: "active" as any,
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_TARGET_STATUS/);

      // Target status 'expired' is not allowed
      await expect(
        revokeKioskSessionDurable(session.id, {
          targetStatus: "expired" as any,
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_TARGET_STATUS/);

      // Target status 'revoked' is not allowed directly
      await expect(
        revokeKioskSessionDurable(session.id, {
          targetStatus: "revoked" as any,
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_TARGET_STATUS/);

      // Arbitrary string is rejected
      await expect(
        revokeKioskSessionDurable(session.id, {
          targetStatus: "malicious_status" as any,
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_TARGET_STATUS/);
    });

    it("rejects invalid state transitions on already terminated sessions", async () => {
      const submittedSession = await mockDb.createIntakeSession({
        patient_id: "patient-rev-02",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "submitted",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      // Attempting to transition submitted -> abandoned must fail
      await expect(
        revokeKioskSessionDurable(submittedSession.id, {
          targetStatus: "abandoned",
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);

      const abandonedSession = await mockDb.createIntakeSession({
        patient_id: "patient-rev-03",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "abandoned",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      // Attempting to transition abandoned -> submitted must fail
      await expect(
        revokeKioskSessionDurable(abandonedSession.id, {
          targetStatus: "submitted",
          actorOrToken: doctorHyderabad,
        })
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
    });

    it("allows valid transitions from active to abandoned or submitted", async () => {
      const activeSession1 = await mockDb.createIntakeSession({
        patient_id: "patient-rev-04",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(
        revokeKioskSessionDurable(activeSession1.id, {
          targetStatus: "abandoned",
          actorOrToken: doctorHyderabad,
        })
      ).resolves.not.toThrow();

      const activeSession2 = await mockDb.createIntakeSession({
        patient_id: "patient-rev-05",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(
        revokeKioskSessionDurable(activeSession2.id, {
          targetStatus: "submitted",
          actorOrToken: doctorHyderabad,
        })
      ).resolves.not.toThrow();
    });

    it("allows idempotent re-execution to same terminal status", async () => {
      const abandonedSession = await mockDb.createIntakeSession({
        patient_id: "patient-rev-06",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "abandoned",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(
        revokeKioskSessionDurable(abandonedSession.id, {
          targetStatus: "abandoned",
          actorOrToken: doctorHyderabad,
        })
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // 2. P0-01: Clinician Identity Propagation Through Intake Lifecycle
  // ===========================================================================
  describe("P0-01: Clinician Identity Propagation", () => {
    it("createInterviewSession accepts and preserves actorOrToken", async () => {
      const session = await createInterviewSession(
        "patient-actor-01",
        "en",
        "consent-123",
        "fac-hyd-01",
        { actorOrToken: doctorHyderabad }
      );

      expect(session).toBeDefined();
      expect(session.patientId).toBe("patient-actor-01");
      expect(session.facilityId).toBe("fac-hyd-01");
    });

    it("cold-cache getInterviewSessionAsync accepts actorOrToken", async () => {
      const sessionRecord = await mockDb.createIntakeSession({
        patient_id: "patient-actor-02",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const loaded = await getInterviewSessionAsync(sessionRecord.id, {
        actorOrToken: doctorHyderabad,
      });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(sessionRecord.id);
      expect(loaded?.patientId).toBe("patient-actor-02");
    });

    it("cold-cache getInterviewSessionAsync strictly fails closed without credentials in production", async () => {
      const { env } = await import("@/config/env");
      const origDemo = env.isDemoMode;
      try {
        (env as any).isDemoMode = false;
        await expect(
          getInterviewSessionAsync("session-cold-prod", {})
        ).rejects.toThrow(/UNAUTHORIZED: Kiosk device credentials or clinical authentication required to load intake session/);
      } finally {
        (env as any).isDemoMode = origDemo;
      }
    });

    it("submitInterviewAnswerAsync accepts actorOrToken in InterviewAccessContext", async () => {
      const session = await createInterviewSession(
        "patient-actor-03",
        "en",
        "consent-456",
        "fac-hyd-01",
        { actorOrToken: doctorHyderabad }
      );

      const result = await submitInterviewAnswerAsync(
        session.id,
        "Fever for 3 days",
        "touch",
        { actorOrToken: doctorHyderabad }
      );

      expect(result).toBeDefined();
      expect(result.session.answers["chief_complaint"]?.rawAnswer).toBe("Fever for 3 days");
    });

    it("compileInterviewToCase propagates clinician actor to createCaseDraft and session teardown", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PAT-ACTOR-01",
        full_name: "Anita Verma",
        date_of_birth: "1988-03-22",
        gender: "female",
        facility_id: "fac-hyd-01",
      });

      const consent = await mockDb.recordConsent({
        patient_id: patient.id,
        purpose: "clinical_care_and_case_taking",
        scope: ["voice_recording", "document_extraction", "ai_summary"],
        language: "en",
        consent_method: "touch_acknowledgement",
        consent_version: "v1.0",
        consent_timestamp: new Date().toISOString(),
        status: "granted",
        granted_at: new Date().toISOString(),
        actor_id: doctorHyderabad.id,
        revocation_reason: null,
        revoked: false,
        revoked_at: null,
        created_at: new Date().toISOString(),
      });

      const session = await createInterviewSession(
        patient.id,
        "en",
        consent.id,
        "fac-hyd-01",
        { actorOrToken: doctorHyderabad }
      );

      await submitInterviewAnswerAsync(
        session.id,
        "Severe persistent headache",
        "touch",
        { actorOrToken: doctorHyderabad }
      );

      const compiled = await compileInterviewToCase(session.id, {
        actorOrToken: doctorHyderabad,
      });

      expect(compiled).toBeDefined();
      expect(compiled.patient_id).toBe(patient.id);
      expect(compiled.chief_complaint).toBe("Severe persistent headache");
      expect(compiled.status).toBe("draft");
      expect(compiled.created_by).toBe(doctorHyderabad.id);

      // Verify intake session was finalized
      const persistedSession = await mockDb.getIntakeSessionById(session.id);
      expect(persistedSession?.status).toBe("submitted");
      expect(persistedSession?.compiled_case_id).toBe(compiled.id);
    });
  });

  // ===========================================================================
  // 3. API Routes Propagation Verification
  // ===========================================================================
  describe("API Routes Clinician Propagation Wiring", () => {
    it("proves start route POST handles clinician request cleanly", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PAT-ROUTE-01",
        full_name: "Ramesh Patel",
        date_of_birth: "1975-06-15",
        gender: "male",
        facility_id: "fac-hyd-01",
      });

      // Request with clinician auth header
      const request = new Request("http://localhost:3000/api/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hydToken}`,
        },
        body: JSON.stringify({
          patientId: patient.id,
          language: "en",
          consentAcknowledged: true,
        }),
      });

      const response = await startRoute(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessionId).toBeDefined();
      expect(data.intakeToken).toBeDefined();
    });

    it("proves answer route POST accepts answer with clinician auth", async () => {
      const session = await createInterviewSession(
        "patient-route-02",
        "en",
        "consent-route-02",
        "fac-hyd-01",
        { actorOrToken: doctorHyderabad }
      );

      const request = new Request(`http://localhost:3000/api/interviews/${session.id}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hydToken}`,
        },
        body: JSON.stringify({
          answer: "Joint stiffness and knee pain",
          inputMode: "touch",
        }),
      });

      const response = await answerRoute(request, {
        params: Promise.resolve({ id: session.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.session.answers["chief_complaint"]?.rawAnswer).toBe("Joint stiffness and knee pain");
    });

    it("proves submit route POST compiles case with clinician auth", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PAT-ROUTE-02",
        full_name: "Sunita Sharma",
        date_of_birth: "1982-11-04",
        gender: "female",
        facility_id: "fac-hyd-01",
      });

      await mockDb.recordConsent({
        patient_id: patient.id,
        purpose: "clinical_care_and_case_taking",
        scope: ["voice_recording", "document_extraction", "ai_summary"],
        language: "en",
        consent_method: "touch_acknowledgement",
        consent_version: "v1.0",
        consent_timestamp: new Date().toISOString(),
        status: "granted",
        granted_at: new Date().toISOString(),
        actor_id: doctorHyderabad.id,
        revocation_reason: null,
        revoked: false,
        revoked_at: null,
        created_at: new Date().toISOString(),
      });

      const session = await createInterviewSession(
        patient.id,
        "en",
        null,
        "fac-hyd-01",
        { actorOrToken: doctorHyderabad }
      );

      await submitInterviewAnswerAsync(
        session.id,
        "Chronic lower backache",
        "touch",
        { actorOrToken: doctorHyderabad }
      );

      const request = new Request(`http://localhost:3000/api/interviews/${session.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hydToken}`,
        },
      });

      const response = await submitRoute(request, {
        params: Promise.resolve({ id: session.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.case.chief_complaint).toBe("Chronic lower backache");
      expect(data.case.created_by).toBe(doctorHyderabad.id);
    });
  });
});
