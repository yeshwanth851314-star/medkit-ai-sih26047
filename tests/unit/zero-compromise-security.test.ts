import { describe, it, expect, beforeEach } from "vitest";
import { mockDb } from "@/lib/db/mock-adapter";
import {
  createCase,
  getCaseById,
  updateCase,
  createIntakeSession,
  getIntakeSessionById,
  updateIntakeSession,
  getCaseAmendments,
  reserveIdempotencyKey,
  executeIdempotentMutation,
  uploadDocumentToStorage,
} from "@/lib/db/supabase";
import {
  signIntakeCapabilityToken,
  verifyIntakeCapabilityToken,
  revokeIntakeCapabilityToken,
  requireIntakeOrClinicalAuth,
} from "@/lib/auth/kiosk-capability";
import {
  addCaseAmendment,
  createCaseDraft,
  finalizeCase,
} from "@/features/cases/case-service";
import {
  createInterviewSession,
  getInterviewSession,
  getInterviewSessionAsync,
  submitInterviewAnswer,
  submitInterviewAnswerAsync,
  teardownInterviewSession,
} from "@/features/interview/interview-service";
import { mapCaseToFhirBundle } from "@/features/interoperability/fhir-mapper";
import { validateFhirBundle } from "@/features/interoperability/fhir-validator";
import { ClinicalCase, Patient } from "@/types/database";

describe("Zero-Compromise Remediation Gate - Security & Integrity Invariants", () => {
  const testPatient: Patient = {
    id: "11111111-1111-4111-8111-111111111111",
    patient_code: "MED-TEST-001",
    full_name: "Surendra Rao",
    date_of_birth: "1980-01-01",
    gender: "male",
    facility_id: "fac-hyd-01",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe("1. Idempotency Key & Payload Hash Conflict Rejection", () => {
    it("rejects duplicate idempotency key when payload hash differs (conflict status)", async () => {
      const idempotencyKey = `idem-test-${crypto.randomUUID()}`;
      const originalHash = "sha256-original-payload-hash";
      const differentHash = "sha256-tampered-payload-hash";

      // 1. First reservation succeeds
      const firstReservation = await reserveIdempotencyKey({
        key: idempotencyKey,
        userId: "doc-01",
        entity: "cases",
        action: "create",
        payloadHash: originalHash,
      });

      expect(firstReservation.claimed).toBe(true);
      expect(firstReservation.status).toBe("in_progress");

      // 2. Re-attempt with identical key but different payload hash must be flagged as conflict
      const conflictingReservation = await reserveIdempotencyKey({
        key: idempotencyKey,
        userId: "doc-01",
        entity: "cases",
        action: "create",
        payloadHash: differentHash,
      });

      expect(conflictingReservation.claimed).toBe(false);
      expect((conflictingReservation as any).status).toBe("conflict");
    });
  });

  describe("2. Canonical Finalized Case Immutability & Append-Only Amendments", () => {
    it("prevents direct mutation of finalized case and enforces append-only amendments", async () => {
      // Create draft case
      const testDraft = await createCaseDraft({
        patientId: testPatient.id,
        caseType: "general",
        patientLanguage: "en",
        chiefComplaint: "Severe fever and body aches for 3 days",
        status: "draft",
      });

      expect(testDraft.status).toBe("draft");

      // Finalize case
      const finalized = await finalizeCase(testDraft.id, "doc-01");
      expect(finalized.status).toBe("final");
      const canonicalUpdatedAt = finalized.updated_at;

      // Direct mutation on finalized case must fail closed
      await expect(
        updateCase(testDraft.id, {
          chiefComplaint: "Tampered complaint",
        } as any)
      ).rejects.toThrow(/CANNOT_MUTATE_FINAL/);

      // Adding an amendment must succeed via case_amendments WITHOUT modifying canonical cases row
      const amended = await addCaseAmendment(testDraft.id, {
        actorId: "doc-01",
        actorName: "Dr. Rao",
        reason: "Follow-up telephonic consultation with updated vitals",
        notes: "Patient reported fever reduced to 99F after paracetamol.",
      });

      expect(amended.amendments).toBeDefined();
      expect(amended.amendments?.length).toBe(1);
      expect(amended.amendments?.[0].version).toBe(1);
      expect(amended.amendments?.[0].notes).toContain("paracetamol");

      // Verify amendments are in dedicated table
      const storedAmendments = await getCaseAmendments(testDraft.id);
      expect(storedAmendments.length).toBe(1);
      expect(storedAmendments[0].author_id).toBe("doc-01");

      // Verify canonical case reload combines amendments cleanly
      const reloaded = await getCaseById(testDraft.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.status).toBe("final");
      expect(reloaded?.chief_complaint).toBe("Severe fever and body aches for 3 days");
      expect(reloaded?.amendments?.length).toBe(1);
    });
  });

  describe("3. Durable Intake Sessions", () => {
    it("persists intake session in database and restores after in-memory cache eviction", async () => {
      const session = createInterviewSession(testPatient.id, "en", undefined, "fac-hyd-01");
      expect(session.status).toBe("active");

      submitInterviewAnswer(session.id, "Chronic persistent knee joint pain", "touch");

      // Verify session exists in persistent store
      const dbSession = await getIntakeSessionById(session.id);
      expect(dbSession).not.toBeNull();
      expect(dbSession?.facility_id).toBe("fac-hyd-01");
      expect(dbSession?.patient_id).toBe(testPatient.id);
      expect(dbSession?.answers?.chief_complaint?.rawAnswer).toBe("Chronic persistent knee joint pain");

      // Simulate in-memory cache eviction
      const globalForSessions = globalThis as any;
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(session.id);
      }

      // In-memory sync lookup is null
      expect(getInterviewSession(session.id)).toBeNull();

      // Async persistent recovery restores the session from database
      const restored = await getInterviewSessionAsync(session.id);
      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(session.id);
      expect(restored?.answers?.chief_complaint?.rawAnswer).toBe("Chronic persistent knee joint pain");

      // Teardown durably completes the session
      teardownInterviewSession(session.id);
      const tornDownDb = await getIntakeSessionById(session.id);
      expect(tornDownDb?.status).toBe("submitted");
    });
  });

  describe("4. AYUSH Clinical Case Persistence & Dashavidha Pariksha", () => {
    it("creates and reloads a complete AYUSH clinical case with all 10 Pariksha parameters", async () => {
      const ayushCase = await createCaseDraft({
        patientId: testPatient.id,
        caseType: "ayush",
        patientLanguage: "te",
        chiefComplaint: "కీళ్ల నొప్పులు మరియు అజీర్ణం (Joint pain and indigestion)",
        ayushAssessment: {
          prakriti: "Vata-Kapha",
          vikriti: "Vata Prakopa with Kaphanubandha",
          sara: "Asthi Sara",
          samhanana: "Su-samhanana",
          pramana: "Sama-pramana",
          satmya: "Pravara (Sarva-rasa satmya)",
          sattva: "Pravara",
          ahara_shakti: "Vishama (Vishamagni)",
          vyayama_shakti: "Madhyama",
          vaya: "Madhyama (Adult)",
          ahara_vihara: {
            dietary_habits: "Takes cold food and irregular curd consumption at night",
            daily_routine: "Late sleeping pattern, morning stiffness for 1 hour",
          },
          source: "clinician",
        },
        status: "draft",
      });

      expect(ayushCase.case_type).toBe("ayush");
      expect(ayushCase.ayush_assessment).toBeDefined();
      expect(ayushCase.ayush_assessment?.prakriti).toBe("Vata-Kapha");
      expect(ayushCase.ayush_assessment?.ahara_shakti).toBe("Vishama (Vishamagni)");
      expect(ayushCase.ayush_assessment?.ahara_vihara?.dietary_habits).toContain("cold food");

      // Reload case from database
      const reloaded = await getCaseById(ayushCase.id);
      expect(reloaded?.case_type).toBe("ayush");
      expect(reloaded?.ayush_assessment?.vikriti).toBe("Vata Prakopa with Kaphanubandha");
      expect(reloaded?.ayush_assessment?.sara).toBe("Asthi Sara");
      expect(reloaded?.ayush_assessment?.ahara_vihara?.daily_routine).toContain("morning stiffness");
    });
  });

  describe("5. FHIR R4 Document & NRCES/ABDM Profile Validator", () => {
    it("validates a compliant FHIR R4 Bundle produced by mapper", () => {
      const clinicalCase: ClinicalCase = {
        id: "c-fhir-test-01",
        patient_id: testPatient.id,
        status: "final",
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Acute dry cough and low-grade fever",
        examination: {
          vitals: {
            blood_pressure: "120/80",
            heart_rate: 76,
            temperature: 99.2,
            spo2: 98,
          },
        },
        allergy_history: [
          {
            substance: "Amoxicillin",
            reaction: "Skin rash",
            severity: "Moderate",
          },
        ],
        medication_history: [
          {
            name: "Paracetamol",
            dose: "650mg",
            frequency: "TDS",
            duration: "3 days",
          },
        ],
        created_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      };

      const bundle = mapCaseToFhirBundle({
        clinicalCase,
        patient: testPatient,
        documents: [],
      });

      const result = validateFhirBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects malformed bundles and catches missing mandatory FHIR elements", () => {
      // Malformed 1: Non-document bundle
      const badTypeBundle: any = {
        resourceType: "Bundle",
        id: "bad-bundle-1",
        type: "collection",
        entry: [],
      };
      const r1 = validateFhirBundle(badTypeBundle);
      expect(r1.valid).toBe(false);
      expect(r1.errors.some((e) => e.includes("type for clinical record transfer must be 'document'"))).toBe(true);

      // Malformed 2: Missing Composition entry[0]
      const badEntryBundle: any = {
        resourceType: "Bundle",
        id: "bad-bundle-2",
        type: "document",
        entry: [
          {
            fullUrl: "urn:uuid:patient-01",
            resource: {
              resourceType: "Patient",
              id: "patient-01",
              name: [{ text: "Patient Name" }],
              gender: "male",
            },
          },
        ],
      };
      const r2 = validateFhirBundle(badEntryBundle);
      expect(r2.valid).toBe(false);
      expect(r2.errors.some((e) => e.includes("entry[0] to be a 'Composition'"))).toBe(true);

      // Malformed 3: Unresolved URN reference
      const unresolvedRefBundle: any = {
        resourceType: "Bundle",
        id: "bad-bundle-3",
        type: "document",
        entry: [
          {
            fullUrl: "urn:uuid:comp-01",
            resource: {
              resourceType: "Composition",
              id: "comp-01",
              status: "final",
              type: { text: "Consultation" },
              title: "Consultation Note",
              date: new Date().toISOString(),
              subject: { reference: "urn:uuid:non-existent-patient-id" }, // Broken reference
              author: [{ reference: "urn:uuid:comp-01" }],
            },
          },
        ],
      };
      const r3 = validateFhirBundle(unresolvedRefBundle);
      expect(r3.valid).toBe(false);
      expect(r3.errors.some((e) => e.includes("Unresolved reference"))).toBe(true);
    });
  });

  describe("6. Pure RFC 4122 UUID Format for Amendments", () => {
    it("ensures amendment IDs conform to canonical RFC 4122 UUID schema without string prefixes", async () => {
      const testDraft = await createCaseDraft({
        patientId: testPatient.id,
        caseType: "general",
        patientLanguage: "en",
        chiefComplaint: "Severe persistent headache and dizziness",
        status: "draft",
      });
      await finalizeCase(testDraft.id, "doc-01");

      const amended = await addCaseAmendment(testDraft.id, {
        actorId: "doc-01",
        actorName: "Dr. Rao",
        reason: "Patient called back regarding dosage adjustment",
        notes: "Advised increasing hydration and resting.",
      });

      const amendmentId = amended.amendments?.[0]?.id;
      expect(amendmentId).toBeDefined();
      // Must be pure UUID, not prefixed with amend-
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(amendmentId).toMatch(uuidRegex);
      expect(amendmentId?.startsWith("amend-")).toBe(false);
    });
  });

  describe("7. Idempotency Key Orphan Lease Timeout Recovery", () => {
    it("allows a subsequent worker to reclaim an in_progress key once its lease expires", async () => {
      const idempotencyKey = `idem-lease-${crypto.randomUUID()}`;
      const payloadHash = "sha256-payload-lease-test";

      // 1. First worker reserves key
      const first = await reserveIdempotencyKey({
        key: idempotencyKey,
        userId: "worker-01",
        entity: "cases",
        action: "create",
        payloadHash,
      });
      expect(first.claimed).toBe(true);
      expect(first.status).toBe("in_progress");

      // 2. Immediate second request by another worker sees in_progress and cannot claim
      const immediate = await reserveIdempotencyKey({
        key: idempotencyKey,
        userId: "worker-01",
        entity: "cases",
        action: "create",
        payloadHash,
      });
      expect(immediate.claimed).toBe(false);
      expect(immediate.status).toBe("in_progress");

      // 3. Simulate lease expiration (orphan crashed worker)
      const record = mockDb.getSyncMutation(idempotencyKey);
      if (record) {
        record.lease_expires_at = new Date(Date.now() - 5000).toISOString(); // 5 seconds in past
      }

      // 4. Retry after lease expiration successfully reclaims the key
      const reclaimed = await reserveIdempotencyKey({
        key: idempotencyKey,
        userId: "worker-01",
        entity: "cases",
        action: "create",
        payloadHash,
      });
      expect(reclaimed.claimed).toBe(true);
      expect(reclaimed.status).toBe("in_progress");
    });
  });

  describe("8. Atomic Idempotent Mutation RPC Execution & Replay Safeguards", () => {
    it("binds replay to the actual payload instead of trusting caller-supplied hashes", async () => {
      const idempotencyKey = `idem-rpc-${crypto.randomUUID()}`;
      const patientId = crypto.randomUUID();
      const payload = { id: patientId, fullName: "Atomic Replay Patient" };

      const res1 = await executeIdempotentMutation({
        idempotencyKey,
        userId: "usr-doctor-001",
        entity: "patients",
        action: "create",
        payloadHash: "forged-caller-hash-a",
        payload,
      });

      expect(res1.idempotencyKey).toBe(idempotencyKey);
      expect(res1.status).toBe("completed");
      expect(res1.isReplay).toBe(false);
      expect(res1.mutationId).toBeDefined();
      expect(res1.resourceId).toBe(patientId);

      const res2 = await executeIdempotentMutation({
        idempotencyKey,
        userId: "usr-doctor-001",
        entity: "patients",
        action: "create",
        payloadHash: "forged-caller-hash-b",
        payload,
      });

      expect(res2.status).toBe("completed");
      expect(res2.isReplay).toBe(true);
      expect(res2.mutationId).toBe(res1.mutationId);
      expect(res2.resourceId).toBe(patientId);

      await expect(
        executeIdempotentMutation({
          idempotencyKey,
          userId: "usr-doctor-001",
          entity: "patients",
          action: "create",
          payloadHash: "forged-caller-hash-b",
          payload: { ...payload, fullName: "Tampered Patient" },
        })
      ).rejects.toThrow(/CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH/);
    });

    it("rejects unsupported entity/action combinations instead of recording fake success", async () => {
      await expect(
        executeIdempotentMutation({
          idempotencyKey: `unsupported-${crypto.randomUUID()}`,
          userId: "usr-doctor-001",
          entity: "vitals",
          action: "record",
          payloadHash: "ignored",
          payload: { bp: "120/80" },
        })
      ).rejects.toThrow(/UNSUPPORTED_ENTITY/);
    });

    it("rejects facility-bound clinical callers that have no assigned facility", async () => {
      const userId = `usr-no-fac-${crypto.randomUUID()}`;
      mockDb.setUserProfile(userId, { role: "doctor", facilityId: null });

      await expect(
        executeIdempotentMutation({
          idempotencyKey: `no-facility-${crypto.randomUUID()}`,
          userId,
          entity: "patients",
          action: "create",
          payloadHash: "ignored",
          payload: { id: crypto.randomUUID(), fullName: "No Facility Patient" },
        })
      ).rejects.toThrow(/FACILITY_REQUIRED/);
    });

    it("rejects case creation when consent belongs to another patient", async () => {
      const consent = await mockDb.recordConsent({
        id: crypto.randomUUID(),
        patient_id: "22222222-2222-4222-8222-222222222222",
        status: "granted",
        revoked: false,
        revoked_at: null,
      });

      await expect(
        executeIdempotentMutation({
          idempotencyKey: `wrong-consent-patient-${crypto.randomUUID()}`,
          userId: "usr-doctor-001",
          entity: "cases",
          action: "create",
          payloadHash: "ignored",
          payload: {
            id: crypto.randomUUID(),
            patientId: "11111111-1111-4111-8111-111111111111",
            consentId: consent.id,
            chiefComplaint: "Synthetic test complaint",
          },
        })
      ).rejects.toThrow(/CONSENT_PATIENT_MISMATCH/);
    });

    it("rejects case creation with a revoked consent", async () => {
      const consent = await mockDb.recordConsent({
        id: crypto.randomUUID(),
        patient_id: "11111111-1111-4111-8111-111111111111",
        status: "granted",
        revoked: false,
        revoked_at: null,
      });
      // Mutate through the mock revocation API so this test exercises the same
      // persisted lifecycle state the production RPC checks.
      await mockDb.revokeConsent(
        consent.id,
        "usr-doctor-001",
        "Synthetic withdrawal",
        "doctor",
        "fac-hyd-01"
      );

      await expect(
        executeIdempotentMutation({
          idempotencyKey: `revoked-consent-${crypto.randomUUID()}`,
          userId: "usr-doctor-001",
          entity: "cases",
          action: "create",
          payloadHash: "ignored",
          payload: {
            id: crypto.randomUUID(),
            patientId: "11111111-1111-4111-8111-111111111111",
            consentId: consent.id,
            chiefComplaint: "Synthetic test complaint",
          },
        })
      ).rejects.toThrow(/CONSENT_INVALID/);
    });
  });

  describe("9. Durable Intake Session Recovery Across Cold Cache Restarts", () => {
    it("preserves answer progression when in-memory cache is wiped between questions", async () => {
      // 1. Create intake session
      const session = createInterviewSession(testPatient.id, "en", undefined, "fac-hyd-01");
      expect(session.status).toBe("active");

      // 2. Submit Question 1
      await submitInterviewAnswerAsync(session.id, "Fever and sore throat for 4 days", "touch");

      // 3. Wipe in-memory session cache to simulate worker restart
      const globalForSessions = globalThis as any;
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(session.id);
      }

      expect(getInterviewSession(session.id)).toBeNull();

      // 4. Recover session from persistent database
      const restored = await getInterviewSessionAsync(session.id);
      expect(restored).not.toBeNull();
      expect(restored?.answers?.chief_complaint?.rawAnswer).toBe("Fever and sore throat for 4 days");

      // 5. Submit Question 2 on restored session
      await submitInterviewAnswerAsync(session.id, "Dry cough with mild chest tightness", "touch");

      // 6. Wipe in-memory cache again
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(session.id);
      }

      // 7. Verify both answers persist durably in database
      const dbRecord = await getIntakeSessionById(session.id);
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.answers?.chief_complaint?.rawAnswer).toBe("Fever and sore throat for 4 days");
      expect(dbRecord?.answers?.general_onset?.rawAnswer).toBe("Dry cough with mild chest tightness");
    });
  });

  describe("10. Durable Capability Token Revocation & Persistent Session Guard", () => {
    it("rejects revoked intake session even after in-memory revocation cache is wiped", async () => {
      // 1. Create intake session and capability token
      const session = createInterviewSession(testPatient.id, "en", undefined, "fac-hyd-01");
      const token = signIntakeCapabilityToken({
        sessionId: session.id,
        patientId: testPatient.id,
        facilityId: "fac-hyd-01",
      });

      // 2. Token is initially valid
      const verified = verifyIntakeCapabilityToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.sessionId).toBe(session.id);

      // 3. Revoke capability token
      revokeIntakeCapabilityToken(session.id);

      // In-memory lookup rejects it
      expect(verifyIntakeCapabilityToken(token)).toBeNull();

      // Ensure persistent DB status update completes
      await updateIntakeSession(session.id, { status: "abandoned" });

      // 4. Wipe in-memory revocation Set to simulate server restart / new container
      const globalForRevocations = globalThis as any;
      if (globalForRevocations.__medkit_revoked_capability_sessions) {
        globalForRevocations.__medkit_revoked_capability_sessions.clear();
      }

      // In-memory token verification alone would see clear Set, BUT requireIntakeOrClinicalAuth checks persistent DB
      const request = new Request(`http://localhost:3000/api/interviews/${session.id}/answers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const authResult = await requireIntakeOrClinicalAuth(request, {
        targetSessionId: session.id,
        targetPatientId: testPatient.id,
      });

      // Must be rejected because persistent store marked session as abandoned upon revocation
      expect(authResult.authorized).toBe(false);
      if (!authResult.authorized) {
        const errorJson = await authResult.errorResponse.json();
        expect(errorJson.error).toContain("UNAUTHORIZED");
      }
    });
  });
});

