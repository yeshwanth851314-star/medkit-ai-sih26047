import { describe, it, expect } from "vitest";
import {
  validateAbhaIdentifier,
  hasLinkedAbha,
  getPatientAbhaIdentifier,
  mapLocalConsentToAbdmStatus,
  isHealthRecordExchangePermitted,
  prepareAbdmHealthRecordPayload,
  AbdmClient,
  ABDM_DISCLAIMER,
} from "../../src/features/abdm";
import { Patient, ClinicalCase } from "../../src/types/database";
import { ConsentRecord } from "../../src/features/consent/types";

describe("Phase 4: ABDM / ABHA Interoperability & Integration Readiness", () => {
  const mockPatientWithAbha: Patient = {
    id: "p-001",
    patient_code: "MED-2026-0001",
    full_name: "Kalyan Ram",
    gender: "male",
    date_of_birth: "1985-06-15",
    phone: "+919876543210",
    abha_id: "14-2345-6789-0123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPatientWithoutAbha: Patient = {
    id: "p-002",
    patient_code: "MED-2026-0002",
    full_name: "Lakshmi Devi",
    gender: "female",
    date_of_birth: "1990-11-20",
    phone: "+919876543211",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockActiveConsent: ConsentRecord = {
    id: "c-001",
    patient_id: mockPatientWithAbha.id,
    purpose: "clinical_care_and_case_taking",
    scope: ["voice_recording", "document_extraction", "ai_summary"],
    language: "en",
    consent_method: "touch_acknowledgement",
    consent_version: "v1.0",
    consent_timestamp: new Date().toISOString(),
    status: "granted",
    granted_at: new Date().toISOString(),
    revoked: false,
    created_at: new Date().toISOString(),
  };

  const mockFinalizedCase: ClinicalCase = {
    id: "case-001",
    patient_id: mockPatientWithAbha.id,
    status: "final",
    case_type: "general",
    patient_language: "en",
    chief_complaint: "Persistent dry cough for 3 weeks",
    created_at: new Date().toISOString(),
    finalized_at: new Date().toISOString(),
  };

  const mockDraftCase: ClinicalCase = {
    id: "case-002",
    patient_id: mockPatientWithAbha.id,
    status: "draft",
    case_type: "general",
    patient_language: "en",
    chief_complaint: "Mild headache",
    created_at: new Date().toISOString(),
  };

  describe("ABHA Identity Validation & Invariants", () => {
    it("validates and preserves standard 14-digit hyphenated ABHA number", () => {
      const res = validateAbhaIdentifier("14-2345-6789-0123");
      expect(res.valid).toBe(true);
      expect(res.type).toBe("abha_number");
      expect(res.normalizedValue).toBe("14-2345-6789-0123");
    });

    it("normalizes plain 14-digit unhyphenated ABHA number to standard format", () => {
      const res = validateAbhaIdentifier("14234567890123");
      expect(res.valid).toBe(true);
      expect(res.type).toBe("abha_number");
      expect(res.normalizedValue).toBe("14-2345-6789-0123");
    });

    it("validates ABDM and Sandbox ABHA addresses", () => {
      const res1 = validateAbhaIdentifier("kalyan.ram@abdm");
      expect(res1.valid).toBe(true);
      expect(res1.type).toBe("abha_address");
      expect(res1.normalizedValue).toBe("kalyan.ram@abdm");

      const res2 = validateAbhaIdentifier("test_patient@sbx");
      expect(res2.valid).toBe(true);
      expect(res2.type).toBe("abha_address");
    });

    it("rejects invalid ABHA identifiers cleanly without throwing", () => {
      expect(validateAbhaIdentifier("1234").valid).toBe(false);
      expect(validateAbhaIdentifier("invalid-format").valid).toBe(false);
      expect(validateAbhaIdentifier("").valid).toBe(false);
    });

    it("supports patients without ABHA (non-mandatory invariant)", () => {
      expect(hasLinkedAbha(mockPatientWithoutAbha)).toBe(false);
      expect(getPatientAbhaIdentifier(mockPatientWithoutAbha)).toBeNull();

      expect(hasLinkedAbha(mockPatientWithAbha)).toBe(true);
      const idObj = getPatientAbhaIdentifier(mockPatientWithAbha);
      expect(idObj).toBeDefined();
      expect(idObj?.system).toBe("https://healthid.ndhm.gov.in");
      expect(idObj?.value).toBe("14-2345-6789-0123");
    });
  });

  describe("Consent Mapping & Gatekeeping", () => {
    it("maps active local consent to ABDM GRANTED status", () => {
      const status = mapLocalConsentToAbdmStatus(mockActiveConsent);
      expect(status).toBe("GRANTED");
    });

    it("maps revoked local consent to ABDM REVOKED status", () => {
      const revokedConsent: ConsentRecord = {
        ...mockActiveConsent,
        revoked: true,
        revoked_at: new Date().toISOString(),
        revocation_reason: "Patient withdrew consent",
      };
      const status = mapLocalConsentToAbdmStatus(revokedConsent);
      expect(status).toBe("REVOKED");
    });

    it("prevents health record exchange when local consent is revoked", () => {
      const revokedConsent: ConsentRecord = {
        ...mockActiveConsent,
        revoked: true,
        revoked_at: new Date().toISOString(),
      };
      const check = isHealthRecordExchangePermitted(revokedConsent);
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("REVOKED");
    });
  });

  describe("Health Record Exchange Payload Preparation", () => {
    it("prepares ABDM health record push payload from finalized case reusing Phase 3 FHIR", () => {
      const payload = prepareAbdmHealthRecordPayload({
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        consent: mockActiveConsent,
      });

      expect(payload).toBeDefined();
      expect(payload.careContextReference).toBe("visit-case-001");
      expect(payload.patientReference).toBe("14-2345-6789-0123");
      expect(payload.fhirBundle).toBeDefined();
      expect(payload.fhirBundle.resourceType).toBe("Bundle");
      expect(payload.fhirBundle.type).toBe("document");
    });

    it("strictly refuses to prepare ABDM payload for draft cases (immutability invariant)", () => {
      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockDraftCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
        });
      }).toThrow("CANNOT_EXCHANGE_DRAFT");
    });

    it("strictly refuses to prepare ABDM payload when consent is revoked", () => {
      const revokedConsent: ConsentRecord = {
        ...mockActiveConsent,
        revoked: true,
        revoked_at: new Date().toISOString(),
      };
      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: revokedConsent,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });
  });

  describe("ABDM Gateway Client Fail-Closed Behavior", () => {
    it("fails closed when sandbox credentials are not configured in environment", async () => {
      const client = new AbdmClient();
      expect(client.isConfigured).toBe(false);

      await expect(client.getSessionToken()).rejects.toThrow("ABDM_SANDBOX_BLOCKED_EXTERNAL");
    });

    it("provides mandatory non-certification disclaimer", () => {
      expect(ABDM_DISCLAIMER).toContain("ABDM integration-ready architecture");
      expect(ABDM_DISCLAIMER).toContain("requires authorized NHA credentials");
    });
  });
});
