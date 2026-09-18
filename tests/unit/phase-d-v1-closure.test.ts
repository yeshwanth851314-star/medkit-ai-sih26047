import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDb } from "@/lib/db/mock-adapter";
import { registerPatient } from "@/features/patients/patient-service";
import { updateCase, executeIdempotentMutation } from "@/lib/db/supabase";
import { updateCaseDraft } from "@/features/cases/case-service";
import { logAuditEvent, CRITICAL_AUDIT_ACTIONS } from "@/features/security/audit-service";
import { AuthUser } from "@/features/auth/types";
import { env } from "@/config/env";

const mockDoctor: AuthUser = {
  id: "usr-doctor-001",
  email: "doctor@aiia.gov.in",
  fullName: "Dr. Anand Sharma",
  role: "doctor",
  facilityId: "fac-hyd-01",
  aal: "aal2",
};

describe("Phase D V1 Surgical Closure Verification Gate", () => {
  beforeEach(() => {
    mockDb.clearAll();
    vi.restoreAllMocks();
  });

  describe("T1: Plaintext ABHA Neutralization in Patients Table", () => {
    it("stores null in patients.abha_id while recording keyed HMAC digest in external identifiers", async () => {
      const rawAbha = "12-3456-7890-9999";
      const reg = await registerPatient(
        {
          fullName: "Anand Kumar",
          gender: "Male",
          phone: "+91-9876543210",
          abhaId: rawAbha,
        },
        { actor: mockDoctor }
      );

      expect(reg.patient).toBeDefined();
      // Invariant: patients table MUST NOT store plaintext ABHA
      expect(reg.patient.abha_id).toBeNull();
      expect(reg.patient.identity_status).toBe("ABHA_LINKED");

      // Verify external identifier was created with masked display and keyed digest
      const externalIds = mockDb.getExternalIdentifiers();
      const abhaEntry = externalIds.find((e) => e.patient_id === reg.patient.id);
      expect(abhaEntry).toBeDefined();
      expect(abhaEntry?.identifier_type).toBe("ABHA_NUMBER");
      expect(abhaEntry?.identifier_hash).toBeDefined();
      expect(abhaEntry?.identifier_hash).not.toBe(rawAbha);
      expect(abhaEntry?.identifier_value_encrypted_or_protected).toContain("****");
    });
  });

  describe("T2: Atomic Case Concurrency & TOCTOU Elimination", () => {
    it("successfully updates when expectedUpdatedAt matches current updated_at", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PT-TEST-001",
        full_name: "Patient Concurrency Test",
        gender: "other",
        facility_id: "fac-hyd-01",
        identity_status: "UNVERIFIED",
      });

      const initialCase = await mockDb.createCase({
        patient_id: patient.id,
        facility_id: "fac-hyd-01",
        clinician_id: mockDoctor.id,
        status: "draft",
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Initial headache",
        provenance: {},
      });

      const currentTimestamp = initialCase.updated_at;
      const updated = await updateCaseDraft(
        initialCase.id,
        { chiefComplaint: "Updated headache" },
        { expectedUpdatedAt: currentTimestamp, actor: mockDoctor }
      );

      expect(updated.chief_complaint).toBe("Updated headache");
    });

    it("rejects concurrent update with CONFLICT_CONCURRENT_UPDATE when expectedUpdatedAt is stale", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PT-TEST-002",
        full_name: "Patient Stale Concurrency",
        gender: "female",
        facility_id: "fac-hyd-01",
        identity_status: "UNVERIFIED",
      });

      const initialCase = await mockDb.createCase({
        patient_id: patient.id,
        facility_id: "fac-hyd-01",
        clinician_id: mockDoctor.id,
        status: "draft",
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Initial complaint",
        provenance: {},
      });

      const staleTimestamp = new Date(Date.now() - 60000).toISOString();

      await expect(
        updateCaseDraft(
          initialCase.id,
          { chiefComplaint: "Conflicting update" },
          { expectedUpdatedAt: staleTimestamp, actor: mockDoctor }
        )
      ).rejects.toThrow(/CONFLICT_CONCURRENT_UPDATE/);
    });
  });

  describe("T3: Case Creation Idempotency", () => {
    it("returns replay result on identical request and rejects payload mismatch with 409 error", async () => {
      const patient = await mockDb.createPatient({
        patient_code: "PT-IDEM-001",
        full_name: "Idempotency Patient",
        gender: "male",
        facility_id: "fac-hyd-01",
        identity_status: "UNVERIFIED",
      });

      const idempotencyKey = "idemp-case-test-" + crypto.randomUUID();
      const payload1 = {
        patientId: patient.id,
        caseType: "general",
        patientLanguage: "en",
        chiefComplaint: "Severe fever and cough",
      };

      // First execution: creates case
      const res1 = await executeIdempotentMutation({
        idempotencyKey,
        userId: mockDoctor.id,
        entity: "cases",
        action: "create",
        payload: payload1,
        actorOrToken: mockDoctor,
      });

      expect(res1.status).toBe("completed");
      expect(res1.isReplay).toBe(false);
      expect(res1.resourceId).toBeDefined();

      // Second execution with identical payload: returns replay
      const res2 = await executeIdempotentMutation({
        idempotencyKey,
        userId: mockDoctor.id,
        entity: "cases",
        action: "create",
        payload: payload1,
        actorOrToken: mockDoctor,
      });

      expect(res2.status).toBe("completed");
      expect(res2.isReplay).toBe(true);
      expect(res2.resourceId).toBe(res1.resourceId);

      // Third execution with modified payload on same key: throws mismatch error
      const payloadConflict = {
        ...payload1,
        chiefComplaint: "Different complaint under same key",
      };

      await expect(
        executeIdempotentMutation({
          idempotencyKey,
          userId: mockDoctor.id,
          entity: "cases",
          action: "create",
          payload: payloadConflict,
          actorOrToken: mockDoctor,
        })
      ).rejects.toThrow(/CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH/);
    });
  });

  describe("T4: Durable Production Audit Logging (Zero Mock Fallback)", () => {
    it("fails closed with CRITICAL_AUDIT_FAILURE in production mode when database is unavailable", async () => {
      // Temporarily simulate non-demo (production) mode
      const originalDemoMode = env.isDemoMode;
      try {
        (env as any).isDemoMode = false;

        // In production mode without live Supabase credentials, logAuditEvent MUST throw CRITICAL_AUDIT_FAILURE
        await expect(
          logAuditEvent({
            actorId: mockDoctor.id,
            actorRole: mockDoctor.role,
            action: "CREATE_CASE",
            resourceType: "cases",
            resourceId: crypto.randomUUID(),
            metadata: { note: "test durable audit" },
            actorOrToken: mockDoctor,
          })
        ).rejects.toThrow(/CRITICAL_AUDIT_FAILURE/);
      } finally {
        (env as any).isDemoMode = originalDemoMode;
      }
    });

    it("fails closed on audit trail query when database is unavailable in production (Zero Mock Read Fallback)", async () => {
      const { getAuditTrailForResource, getAllAuditLogs } = await import("@/features/security/audit-service");
      const originalDemoMode = env.isDemoMode;
      try {
        (env as any).isDemoMode = false;

        await expect(
          getAuditTrailForResource("cases", "test-case-id", mockDoctor)
        ).rejects.toThrow(/CRITICAL_AUDIT_FAILURE/);

        await expect(
          getAllAuditLogs(mockDoctor)
        ).rejects.toThrow(/CRITICAL_AUDIT_FAILURE/);
      } finally {
        (env as any).isDemoMode = originalDemoMode;
      }
    });
  });

  describe("T5: Atomic Registration & National ABHA Collision Prevention (R3)", () => {
    it("atomically links ABHA and rejects registration when active ABHA hash exists nationally", async () => {
      const rawAbha = "99-1234-5678-0001";
      const reg1 = await registerPatient(
        {
          fullName: "Unique First Patient",
          gender: "Male",
          phone: "+91-9876599901",
          abhaId: rawAbha,
        },
        { actor: mockDoctor }
      );

      expect(reg1.patient).toBeDefined();
      expect(reg1.patient.id).toBeDefined();
      expect(reg1.patient.identity_status).toBe("ABHA_LINKED");

      // Attempting to register another patient with the same active ABHA must fail atomically
      await expect(
        registerPatient(
          {
            fullName: "Second Patient Colliding",
            gender: "Female",
            phone: "+91-9876599902",
            abhaId: rawAbha,
          },
          { actor: mockDoctor, ignoreDuplicateWarning: true }
        )
      ).rejects.toThrow(/UNIQUE_VIOLATION/);
    });
  });

  describe("T6: Authoritative HMAC Duplicate Candidate Detection (R1)", () => {
    it("detects existing patient via external identifier HMAC index without searching plaintext ABHA", async () => {
      const rawAbha = "55-4321-8765-1111";
      await registerPatient(
        {
          fullName: "Indexed Patient",
          gender: "Female",
          phone: "+91-9876500099",
          abhaId: rawAbha,
        },
        { actor: mockDoctor }
      );

      const { checkDuplicatePatient } = await import("@/features/patients/patient-service");
      const dup = await checkDuplicatePatient(
        {
          fullName: "Different Name",
          gender: "Female",
          phone: "+91-9999999999",
          abhaId: rawAbha,
        },
        mockDoctor,
        "fac-hyd-01"
      );

      expect(dup.isDuplicateSuspect).toBe(true);
      expect(dup.matchConfidence).toBe("STRONG_MATCH");
      expect(dup.matchedName).toBe("Indexed Patient");
    });
  });

  describe("T7: Remote Intake Invitation Audit Resource Type Canonicalization (R6)", () => {
    it("accepts canonical remote_intake_invitations resource type and action", async () => {
      const entry = await logAuditEvent({
        actorId: mockDoctor.id,
        actorRole: mockDoctor.role,
        action: "REMOTE_INVITE_REVOKED",
        resourceType: "remote_intake_invitations",
        resourceId: crypto.randomUUID(),
        metadata: { reason: "Patient cancelled appointment" },
        actorOrToken: mockDoctor,
      });

      expect(entry.resource_type).toBe("remote_intake_invitations");
      expect(entry.action).toBe("REMOTE_INVITE_REVOKED");
    });
  });

  describe("T8: Production ABHA Duplicate Check Fail-Closed (F1)", () => {
    it("fails closed with IDENTITY_DUPLICATE_CHECK_UNAVAILABLE when client is unavailable in production mode", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDemoMode = env.isDemoMode;
      const originalPepper = process.env.IDENTIFIER_INDEX_PEPPER;

      try {
        (process.env as any).NODE_ENV = "production";
        (env as any).isDemoMode = false;
        process.env.IDENTIFIER_INDEX_PEPPER = "test-pepper-production-fail-closed-999";

        const { checkDuplicatePatient } = await import("@/features/patients/patient-service");
        await expect(
          checkDuplicatePatient(
            {
              fullName: "Test FailClosed",
              gender: "Female",
              phone: "+91-9876543210",
              abhaId: "12-3456-7890-1234",
            },
            mockDoctor,
            "fac-hyd-01"
          )
        ).rejects.toThrow(/IDENTITY_DUPLICATE_CHECK_UNAVAILABLE/);
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        (env as any).isDemoMode = originalDemoMode;
        if (originalPepper !== undefined) {
          process.env.IDENTIFIER_INDEX_PEPPER = originalPepper;
        } else {
          delete process.env.IDENTIFIER_INDEX_PEPPER;
        }
      }
    });
  });
});

