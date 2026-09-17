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
  role: "doctor",
  facilityId: "fac-hyd-01",
  facilityName: "AIIA Hyderabad",
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
  });
});
