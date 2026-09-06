import { describe, it, expect } from "vitest";
import { genderToDb, genderFromDb } from "@/lib/utils/gender";
import { recordPatientConsent, revokePatientConsent, verifyPatientConsent } from "@/features/consent/consent-service";
import { createCaseDraft, finalizeCase, addCaseAmendment } from "@/features/cases/case-service";
import { registerPatient } from "@/features/patients/patient-service";

describe("Phase 3: Supabase Schema Alignment & Clinical Domain Logic", () => {
  describe("Gender Normalization & Check-Constraint Mapping", () => {
    it("maps UI/Domain gender strings to canonical database values", () => {
      expect(genderToDb("Male")).toBe("male");
      expect(genderToDb("male")).toBe("male");
      expect(genderToDb("M")).toBe("male");
      expect(genderToDb("Female")).toBe("female");
      expect(genderToDb("female")).toBe("female");
      expect(genderToDb("F")).toBe("female");
      expect(genderToDb("Other")).toBe("other");
      expect(genderToDb("o")).toBe("other");
      expect(genderToDb("Unknown")).toBe("unknown");
      expect(genderToDb("")).toBe("unknown");
      expect(genderToDb(null)).toBe("unknown");
      expect(genderToDb(undefined)).toBe("unknown");
      expect(genderToDb("non-binary")).toBe("unknown");
    });

    it("maps database canonical gender to display presentation values", () => {
      expect(genderFromDb("male")).toBe("Male");
      expect(genderFromDb("female")).toBe("Female");
      expect(genderFromDb("other")).toBe("Other");
      expect(genderFromDb("unknown")).toBe("Unknown");
      expect(genderFromDb(null)).toBe("Unknown");
      expect(genderFromDb("")).toBe("Unknown");
    });

    it("registers patient with normalized database gender", async () => {
      const res = await registerPatient({
        fullName: "Test Alignment Patient",
        dateOfBirth: "1990-01-01",
        gender: "Female",
        phone: "+91-99999-12345",
        bloodGroup: "B+",
      });
      expect(res.patient).toBeDefined();
      expect(res.patient.gender).toBe("female");
    });
  });

  describe("Consent Lifecycle & Revocation State Tracking", () => {
    it("records consent with status 'granted', granted_at timestamp, and actor_id", async () => {
      const consent = await recordPatientConsent({
        patientId: "11111111-1111-4111-8111-111111111111",
        purpose: "clinical_care_and_case_taking",
        language: "en",
        consentMethod: "touch_acknowledgement",
        actorId: "staff-101",
      });

      expect(consent.status).toBe("granted");
      expect(consent.revoked).toBe(false);
      expect(consent.granted_at).toBeDefined();
      expect(consent.actor_id).toBe("staff-101");
      expect(consent.revocation_reason).toBeNull();
    });

    it("revokes consent with status 'revoked', revoked_at timestamp, actor_id, and reason", async () => {
      const consent = await recordPatientConsent({
        patientId: "22222222-2222-4222-8222-222222222222",
        purpose: "clinical_care_and_case_taking",
        language: "te",
        actorId: "patient-self",
      });

      const revoked = await revokePatientConsent(
        consent.id,
        "clinician-007",
        "Patient withdrew consent before consultation"
      );

      expect(revoked.status).toBe("revoked");
      expect(revoked.revoked).toBe(true);
      expect(revoked.revoked_at).toBeDefined();
      expect(revoked.actor_id).toBe("clinician-007");
      expect(revoked.revocation_reason).toBe("Patient withdrew consent before consultation");

      const check = await verifyPatientConsent("22222222-2222-4222-8222-222222222222");
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("revoked");
    });
  });

  describe("Case Finalization & Addenda (Amendments)", () => {
    it("finalizes case with finalized_at timestamp and finalized_by clinician ID", async () => {
      const draft = await createCaseDraft(
        {
          patientId: "11111111-1111-4111-8111-111111111111",
          caseType: "general",
          patientLanguage: "en",
          chiefComplaint: "Acute abdominal discomfort and fever for 2 days",
        },
        "doctor-42"
      );

      expect(draft.status).toBe("draft");
      expect(draft.finalized_at).toBeNull();

      const finalized = await finalizeCase(draft.id, "doctor-42");
      expect(finalized.status).toBe("final");
      expect(finalized.finalized_at).toBeDefined();
      expect(finalized.finalized_by).toBe("doctor-42");
    });

    it("records immutable versioned clinical amendments on finalized cases", async () => {
      const draft = await createCaseDraft(
        {
          patientId: "11111111-1111-4111-8111-111111111111",
          caseType: "general",
          patientLanguage: "en",
          chiefComplaint: "Migraine headache with aura",
        },
        "doctor-42"
      );

      await finalizeCase(draft.id, "doctor-42");

      const amended = await addCaseAmendment(draft.id, {
        actorId: "doctor-42",
        actorName: "Dr. Lakshmi Varma",
        reason: "Delayed lab test result received",
        notes: "Serum electrolyte report reviewed: potassium 4.1 mEq/L within normal limits.",
      });

      expect(amended.amendments).toBeDefined();
      expect(amended.amendments?.length).toBe(1);
      expect(amended.amendments![0].version).toBe(1);
      expect(amended.amendments![0].actor_id).toBe("doctor-42");
      expect(amended.amendments![0].reason).toBe("Delayed lab test result received");
      expect(amended.amendments![0].notes).toContain("potassium 4.1");
    });
  });
});
