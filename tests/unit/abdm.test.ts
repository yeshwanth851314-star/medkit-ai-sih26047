import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateAbhaIdentifier,
  hasLinkedAbha,
  getPatientAbhaIdentifier,
  isLocalClinicalConsentActive,
  isAbdmExchangeConsentValid,
  isHealthRecordExchangePermitted,
  prepareAbdmHealthRecordPayload,
  AbdmClient,
  ABDM_DISCLAIMER,
  getAbdmConfig,
  isGatewayConfigured,
  isHipConfigured,
  isConsentExchangeConfigured,
  getAbdmReadiness,
  AbdmConsentArtifact,
  normalizeAbdmPatientIdentity,
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
    facility_id: "facility-aiia-delhi",
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
    facility_id: "facility-aiia-delhi",
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

  const mockValidAbdmArtifact: AbdmConsentArtifact = {
    consentId: "abdm-consent-12345",
    status: "GRANTED",
    createdAt: "2026-09-01T10:00:00Z",
    purpose: {
      code: "CAREMGT",
      text: "Care Management",
    },
    patient: {
      id: "14-2345-6789-0123",
    },
    hip: {
      id: "AIIA_DELHI_01",
      name: "All India Institute of Ayurveda",
    },
    permission: {
      accessMode: "VIEW",
      dateRange: {
        from: "2026-01-01T00:00:00Z",
        to: "2026-12-31T23:59:59Z",
      },
      dataEraseAt: new Date(Date.now() + 86400000).toISOString(),
      frequency: {
        unit: "HOUR",
        value: 1,
        repeats: 0,
      },
      hiTypes: ["OPConsultation"],
    },
  };

  describe("ABDM and Local Consent Independence (Mandatory Separation)", () => {
    it("recognizes active local consent independently from ABDM consent", () => {
      expect(isLocalClinicalConsentActive(mockActiveConsent)).toBe(true);

      const revokedLocal: ConsentRecord = {
        ...mockActiveConsent,
        revoked: true,
        revoked_at: new Date().toISOString(),
      };
      expect(isLocalClinicalConsentActive(revokedLocal)).toBe(false);

      const revokedStatusLocal: ConsentRecord = {
        ...mockActiveConsent,
        status: "revoked",
      };
      expect(isLocalClinicalConsentActive(revokedStatusLocal)).toBe(false);

      expect(isLocalClinicalConsentActive(null as any)).toBe(false);
    });

    // Test 1: local consent = GRANTED, ABDM artifact = MISSING -> DENIED
    it("Test 1: denies exchange when local consent is GRANTED but ABDM artifact is MISSING (Mandatory)", () => {
      const check = isHealthRecordExchangePermitted(mockActiveConsent, undefined);
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("ABDM consent artifact is required");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: undefined,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    // Test 2: local consent = GRANTED, ABDM artifact = GRANTED + valid -> PERMITTED
    it("Test 2: permits exchange when local consent is GRANTED and ABDM artifact is valid GRANTED", () => {
      const check = isHealthRecordExchangePermitted(mockActiveConsent, mockValidAbdmArtifact);
      expect(check.permitted).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    // Test 3: local consent = REVOKED, ABDM artifact = GRANTED -> DENIED
    it("Test 3: denies exchange when local consent is REVOKED even if ABDM artifact is GRANTED", () => {
      const revokedLocal: ConsentRecord = {
        ...mockActiveConsent,
        revoked: true,
        revoked_at: new Date().toISOString(),
      };
      const check = isHealthRecordExchangePermitted(revokedLocal, mockValidAbdmArtifact);
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("Local clinical consent is inactive or revoked");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: revokedLocal,
          abdmConsentArtifact: mockValidAbdmArtifact,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    // Test 4: local consent = GRANTED, ABDM artifact = REVOKED -> DENIED
    it("Test 4: denies exchange when local consent is GRANTED but ABDM artifact is REVOKED", () => {
      const revokedArtifact: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        status: "REVOKED",
      };
      const check = isHealthRecordExchangePermitted(mockActiveConsent, revokedArtifact);
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("REVOKED");
    });

    // Test 5: ABDM artifact expired -> DENIED
    it("Test 5: denies exchange when ABDM artifact has expired (dataEraseAt lapsed)", () => {
      const expiredArtifact: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        permission: {
          ...mockValidAbdmArtifact.permission,
          dataEraseAt: "2020-01-01T00:00:00Z",
        },
      };
      const check = isHealthRecordExchangePermitted(mockActiveConsent, expiredArtifact);
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("expired");
    });

    // Test 6: requested date range outside consent -> DENIED
    it("Test 6: denies exchange when clinical case date falls outside ABDM consent date range", () => {
      const futureCase: ClinicalCase = {
        ...mockFinalizedCase,
        created_at: "2027-05-01T10:00:00Z",
        finalized_at: "2027-05-01T11:00:00Z",
      };
      const check = isHealthRecordExchangePermitted(mockActiveConsent, mockValidAbdmArtifact, {
        clinicalCase: futureCase,
      });
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("dateRange");

      const pastCase: ClinicalCase = {
        ...mockFinalizedCase,
        created_at: "2025-05-01T10:00:00Z",
        finalized_at: "2025-05-01T11:00:00Z",
      };
      const checkPast = isHealthRecordExchangePermitted(mockActiveConsent, mockValidAbdmArtifact, {
        clinicalCase: pastCase,
      });
      expect(checkPast.permitted).toBe(false);
      expect(checkPast.reason).toContain("dateRange");
    });

    // Test 7: requested health information type not granted -> DENIED
    it("Test 7: denies exchange when requested HI type is not permitted by ABDM consent artifact", () => {
      const labOnlyArtifact: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        permission: {
          ...mockValidAbdmArtifact.permission,
          hiTypes: ["DiagnosticReport"],
        },
      };
      const check = isHealthRecordExchangePermitted(mockActiveConsent, labOnlyArtifact, {
        requestedHiType: "OPConsultation",
      });
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("Requested HI type 'OPConsultation' is not permitted");
    });

    // Test 8: wrong HIP/HIU binding -> DENIED
    it("Test 8: denies exchange when target HIP does not match ABDM consent artifact HIP binding", () => {
      const check = isHealthRecordExchangePermitted(mockActiveConsent, mockValidAbdmArtifact, {
        targetHipId: "OTHER_HOSPITAL_999",
      });
      expect(check.permitted).toBe(false);
      expect(check.reason).toContain("Target HIP ID 'OTHER_HOSPITAL_999' does not match");
    });

    // Test 9: valid local + valid ABDM + finalized case + allowed data -> PERMITTED / SUCCESS
    it("Test 9: packages FHIR DocumentBundle successfully when all local and ABDM consent conditions hold", () => {
      const payload = prepareAbdmHealthRecordPayload({
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        consent: mockActiveConsent,
        abdmConsentArtifact: mockValidAbdmArtifact,
        targetHipId: "AIIA_DELHI_01",
      });

      expect(payload).toBeDefined();
      expect(payload.careContextReference).toBe("visit-case-001");
      expect(payload.patientReference).toBe("14-2345-6789-0123");
      expect(payload.consentId).toBe("abdm-consent-12345");
      expect(payload.matchedHipId).toBe("AIIA_DELHI_01");
      expect(payload.fhirBundle).toBeDefined();
      expect(payload.fhirBundle.resourceType).toBe("Bundle");
      expect(payload.fhirBundle.type).toBe("document");
      expect(payload.fhirBundle.meta.versionId).toBe("1");
    });

    it("strictly refuses to prepare ABDM payload for draft cases (immutability invariant)", () => {
      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockDraftCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: mockValidAbdmArtifact,
        });
      }).toThrow("CANNOT_EXCHANGE_DRAFT");
    });
  });

  describe("ABDM Patient & HIU Consent Binding (P4-FINAL-01 & P4-FINAL-02)", () => {
    it("Test 1: permits exchange when MedKit patient ABDM identity matches consent artifact patient identity", () => {
      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: mockValidAbdmArtifact,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
      });
      expect(check.valid).toBe(true);
      expect(check.reason).toBeUndefined();

      const permitted = isHealthRecordExchangePermitted(mockActiveConsent, mockValidAbdmArtifact, {
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
      });
      expect(permitted.permitted).toBe(true);
    });

    it("Test 2: denies exchange when MedKit patient ABDM identity does not match consent artifact patient identity (wrong patient)", () => {
      const wrongPatientArtifact: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        patient: {
          id: "99-9999-9999-9999",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: wrongPatientArtifact,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("does not match requested patient");

      const permitted = isHealthRecordExchangePermitted(mockActiveConsent, wrongPatientArtifact, {
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
      });
      expect(permitted.permitted).toBe(false);
      expect(permitted.reason).toContain("does not match requested patient");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: wrongPatientArtifact,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 3: denies exchange when patient has no linked ABHA identity, while leaving local MedKit workflows unaffected", () => {
      // 1. Local clinical consent remains valid and unaffected
      expect(isLocalClinicalConsentActive(mockActiveConsent)).toBe(true);
      expect(mockPatientWithoutAbha.patient_code).toBe("MED-2026-0002");

      // 2. ABDM exchange must be denied for patient without ABHA
      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: mockValidAbdmArtifact,
        clinicalCase: {
          ...mockFinalizedCase,
          patient_id: mockPatientWithoutAbha.id,
        },
        patient: mockPatientWithoutAbha,
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Patient has no linked ABHA identifier");

      const consentForPatientWithoutAbha: ConsentRecord = {
        ...mockActiveConsent,
        patient_id: mockPatientWithoutAbha.id,
      };

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: {
            ...mockFinalizedCase,
            patient_id: mockPatientWithoutAbha.id,
          },
          patient: mockPatientWithoutAbha,
          consent: consentForPatientWithoutAbha,
          abdmConsentArtifact: mockValidAbdmArtifact,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION: Patient has no linked ABHA identifier");
    });

    it("Test 4: strictly refuses internal patient_code to substitute for missing ABHA identity", () => {
      const patientOnlyWithCode: Patient = {
        id: "p-code-only",
        patient_code: "MED-2026-CODEONLY",
        full_name: "Internal Code Patient",
        gender: "female",
        date_of_birth: "1992-04-10",
        phone: "+919876543299",
        facility_id: "facility-aiia-delhi",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const artifactMatchingCode: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        patient: {
          id: "MED-2026-CODEONLY",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactMatchingCode,
        clinicalCase: {
          ...mockFinalizedCase,
          patient_id: patientOnlyWithCode.id,
        },
        patient: patientOnlyWithCode,
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Patient has no linked ABHA identifier");

      const consentForPatient: ConsentRecord = {
        ...mockActiveConsent,
        patient_id: patientOnlyWithCode.id,
      };

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: {
            ...mockFinalizedCase,
            patient_id: patientOnlyWithCode.id,
          },
          patient: patientOnlyWithCode,
          consent: consentForPatient,
          abdmConsentArtifact: artifactMatchingCode,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 5: denies exchange when clinical case patient_id does not match the requested patient (case/patient mismatch)", () => {
      const mismatchedCase: ClinicalCase = {
        ...mockFinalizedCase,
        patient_id: "p-different-patient-999",
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: mockValidAbdmArtifact,
        clinicalCase: mismatchedCase,
        patient: mockPatientWithAbha,
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("does not match requested patient");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mismatchedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: mockValidAbdmArtifact,
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 6: permits exchange when target HIU matches the ABDM consent artifact HIU binding", () => {
      const artifactWithHiu: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        hiu: {
          id: "HIU_AIIMS_DELHI_01",
          name: "All India Institute of Medical Sciences",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactWithHiu,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: "HIU_AIIMS_DELHI_01",
      });
      expect(check.valid).toBe(true);

      const payload = prepareAbdmHealthRecordPayload({
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        consent: mockActiveConsent,
        abdmConsentArtifact: artifactWithHiu,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: "HIU_AIIMS_DELHI_01",
      });
      expect(payload.matchedHiuId).toBe("HIU_AIIMS_DELHI_01");
    });

    it("Test 7: denies exchange when target HIU does not match the ABDM consent artifact HIU binding", () => {
      const artifactWithHiu: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        hiu: {
          id: "HIU_AIIMS_DELHI_01",
          name: "All India Institute of Medical Sciences",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactWithHiu,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: "HIU_APOLLO_CHENNAI_02",
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("does not match ABDM consent artifact HIU binding");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: artifactWithHiu,
          targetHipId: "AIIA_DELHI_01",
          targetHiuId: "HIU_APOLLO_CHENNAI_02",
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 8: denies exchange when ABDM consent artifact specifies an HIU binding but target HIU is missing", () => {
      const artifactWithHiu: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        hiu: {
          id: "HIU_AIIMS_DELHI_01",
          name: "All India Institute of Medical Sciences",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactWithHiu,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: undefined,
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Target HIU ID is required when ABDM consent artifact specifies an HIU binding");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: artifactWithHiu,
          targetHipId: "AIIA_DELHI_01",
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 9: adversarial test — denies exchange when all other criteria match (status, purpose, date, HI type, HIP, HIU) but patient identity mismatches", () => {
      const adversarialArtifact: AbdmConsentArtifact = {
        consentId: "abdm-consent-adversarial-01",
        status: "GRANTED",
        createdAt: "2026-09-01T10:00:00Z",
        purpose: {
          code: "CAREMGT",
          text: "Care Management",
        },
        patient: {
          id: "88-8888-8888-8888",
        },
        hip: {
          id: "AIIA_DELHI_01",
          name: "All India Institute of Ayurveda",
        },
        hiu: {
          id: "HIU_AIIMS_DELHI_01",
          name: "AIIMS New Delhi",
        },
        permission: {
          accessMode: "VIEW",
          dateRange: {
            from: "2026-01-01T00:00:00Z",
            to: "2026-12-31T23:59:59Z",
          },
          dataEraseAt: new Date(Date.now() + 86400000).toISOString(),
          frequency: {
            unit: "HOUR",
            value: 1,
            repeats: 0,
          },
          hiTypes: ["OPConsultation"],
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: adversarialArtifact,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: "HIU_AIIMS_DELHI_01",
        requestedHiType: "OPConsultation",
        requestedPurpose: "CAREMGT",
      });
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("does not match requested patient");

      expect(() => {
        prepareAbdmHealthRecordPayload({
          clinicalCase: mockFinalizedCase,
          patient: mockPatientWithAbha,
          consent: mockActiveConsent,
          abdmConsentArtifact: adversarialArtifact,
          targetHipId: "AIIA_DELHI_01",
          targetHiuId: "HIU_AIIMS_DELHI_01",
          requestedHiType: "OPConsultation",
          requestedPurpose: "CAREMGT",
        });
      }).toThrow("ABDM_CONSENT_VIOLATION");
    });

    it("Test 10: full valid exchange guarantees payload integrity — patientReference is ABDM identity and consentId is authoritative validated artifact ID", () => {
      const fullValidArtifact: AbdmConsentArtifact = {
        consentId: "abdm-consent-authoritative-999",
        status: "GRANTED",
        createdAt: "2026-09-01T10:00:00Z",
        purpose: {
          code: "CAREMGT",
          text: "Care Management",
        },
        patient: {
          id: "14-2345-6789-0123",
        },
        hip: {
          id: "AIIA_DELHI_01",
          name: "All India Institute of Ayurveda",
        },
        hiu: {
          id: "HIU_AIIMS_DELHI_01",
          name: "AIIMS New Delhi",
        },
        permission: {
          accessMode: "VIEW",
          dateRange: {
            from: "2026-01-01T00:00:00Z",
            to: "2026-12-31T23:59:59Z",
          },
          dataEraseAt: new Date(Date.now() + 86400000).toISOString(),
          frequency: {
            unit: "HOUR",
            value: 1,
            repeats: 0,
          },
          hiTypes: ["OPConsultation"],
        },
      };

      const payload = prepareAbdmHealthRecordPayload({
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
        consent: mockActiveConsent,
        abdmConsentArtifact: fullValidArtifact,
        targetHipId: "AIIA_DELHI_01",
        targetHiuId: "HIU_AIIMS_DELHI_01",
        requestedHiType: "OPConsultation",
        requestedPurpose: "CAREMGT",
      });

      expect(payload).toBeDefined();
      expect(payload.patientReference).toBe("14-2345-6789-0123");
      expect(payload.patientReference).not.toBe(mockPatientWithAbha.patient_code);
      expect(payload.consentId).toBe("abdm-consent-authoritative-999");
      expect(payload.matchedHipId).toBe("AIIA_DELHI_01");
      expect(payload.matchedHiuId).toBe("HIU_AIIMS_DELHI_01");
      expect(payload.fhirBundle.meta.versionId).toBe("1");
    });

    it("Test 11: validates and normalizes ABHA identity formats (hyphenated, unhyphenated numeric, ABHA address) and denies mismatched format types", () => {
      // Direct normalization function tests
      expect(normalizeAbdmPatientIdentity("14-2345-6789-0123")).toEqual({
        type: "abha_number",
        value: "14-2345-6789-0123",
      });
      expect(normalizeAbdmPatientIdentity("14234567890123")).toEqual({
        type: "abha_number",
        value: "14-2345-6789-0123",
      });
      expect(normalizeAbdmPatientIdentity("kalyan.ram@abdm")).toEqual({
        type: "abha_address",
        value: "kalyan.ram@abdm",
      });
      expect(normalizeAbdmPatientIdentity("kalyan_sbx@sbx")).toEqual({
        type: "abha_address",
        value: "kalyan_sbx@sbx",
      });
      expect(normalizeAbdmPatientIdentity("")).toBeNull();
      expect(normalizeAbdmPatientIdentity(null)).toBeNull();
      expect(normalizeAbdmPatientIdentity(undefined)).toBeNull();
      expect(normalizeAbdmPatientIdentity("invalid-abha-value")).toBeNull();

      // Exchange with ABHA address patient
      const patientWithAddress: Patient = {
        ...mockPatientWithAbha,
        id: "p-address-001",
        abha_id: "kalyan.ram@abdm",
      };
      const caseWithAddress: ClinicalCase = {
        ...mockFinalizedCase,
        patient_id: "p-address-001",
      };
      const consentWithAddress: ConsentRecord = {
        ...mockActiveConsent,
        patient_id: "p-address-001",
      };
      const artifactWithAddress: AbdmConsentArtifact = {
        ...mockValidAbdmArtifact,
        patient: {
          id: "kalyan.ram@abdm",
        },
      };

      const check = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactWithAddress,
        clinicalCase: caseWithAddress,
        patient: patientWithAddress,
      });
      expect(check.valid).toBe(true);

      // Mismatch between ABHA number and ABHA address
      const checkMismatch = isAbdmExchangeConsentValid({
        abdmConsentArtifact: artifactWithAddress,
        clinicalCase: mockFinalizedCase,
        patient: mockPatientWithAbha,
      });
      expect(checkMismatch.valid).toBe(false);
      expect(checkMismatch.reason).toContain("does not match requested patient");
    });
  });

  describe("ABDM Gateway Configuration & Structured Readiness", () => {
    it("guarantees no fake default HIP ID is fabricated", () => {
      const config = getAbdmConfig();
      expect(config.hipId).not.toBe("IN010000001");
      expect(config.hipId).toBe("");
    });

    it("evaluates structured readiness checks correctly", () => {
      const unconfigured = getAbdmConfig();
      expect(isGatewayConfigured(unconfigured)).toBe(false);
      expect(isHipConfigured(unconfigured)).toBe(false);
      expect(isConsentExchangeConfigured(unconfigured)).toBe(false);

      const readiness = getAbdmReadiness(unconfigured);
      expect(readiness.isGatewayConfigured).toBe(false);
      expect(readiness.missingRequirements).toContain("ABDM_CLIENT_ID");
      expect(readiness.missingRequirements).toContain("ABDM_CLIENT_SECRET");
      expect(readiness.missingRequirements).toContain("ABDM_HIP_ID");

      const configuredMock = {
        gatewayBaseUrl: "https://dev.abdm.gov.in/gateway",
        clientId: "real-client-id-123",
        clientSecret: "real-client-secret-456",
        hipId: "AIIA_DELHI_01",
        hprId: "HPR-123",
        cmId: "sbx",
        isSandboxConfigured: true,
      };

      expect(isGatewayConfigured(configuredMock)).toBe(true);
      expect(isHipConfigured(configuredMock)).toBe(true);
      expect(isConsentExchangeConfigured(configuredMock)).toBe(true);
    });
  });

  describe("ABDM Gateway Client V3 Contract & Transport", () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("fails closed when sandbox credentials are not configured in environment", async () => {
      const client = new AbdmClient();
      expect(client.isConfigured).toBe(false);

      await expect(client.getSessionToken()).rejects.toThrow("ABDM_SANDBOX_BLOCKED_EXTERNAL");
    });

    it("invokes Gateway V3 session endpoint with required headers and client_credentials grant", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init.method || "";
        capturedHeaders = init.headers as Record<string, string>;
        capturedBody = JSON.parse(init.body as string);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "mock-v3-jwt-token-999",
            expiresIn: 1800,
            tokenType: "Bearer",
          }),
        };
      });

      const mockConfig = {
        gatewayBaseUrl: "https://dev.abdm.gov.in/gateway",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        hipId: "AIIA_DELHI_01",
        hprId: "HPR-01",
        cmId: "sbx",
        isSandboxConfigured: true,
      };

      const client = new AbdmClient(mockConfig);
      const token = await client.getSessionToken();

      expect(token).toBe("mock-v3-jwt-token-999");
      expect(capturedUrl).toBe("https://dev.abdm.gov.in/gateway/api/hiecm/gateway/v3/sessions");
      expect(capturedMethod).toBe("POST");
      expect(capturedHeaders["Content-Type"]).toBe("application/json");
      expect(capturedHeaders["X-CM-ID"]).toBe("sbx");
      expect(capturedHeaders["REQUEST-ID"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(capturedHeaders["TIMESTAMP"]).toBeDefined();
      expect(capturedBody.clientId).toBe("test-client-id");
      expect(capturedBody.clientSecret).toBe("test-client-secret");
      expect(capturedBody.grantType).toBe("client_credentials");
    });

    it("uses cached token while unexpired and refreshes when expired", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: `token-call-${callCount}`,
            expiresIn: 3600,
          }),
        };
      });

      const mockConfig = {
        gatewayBaseUrl: "https://dev.abdm.gov.in/gateway",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        hipId: "AIIA_DELHI_01",
        hprId: "HPR-01",
        cmId: "sbx",
        isSandboxConfigured: true,
      };

      const client = new AbdmClient(mockConfig);
      const t1 = await client.getSessionToken();
      const t2 = await client.getSessionToken();

      expect(t1).toBe("token-call-1");
      expect(t2).toBe("token-call-1");
      expect(callCount).toBe(1);

      // Force token expiration in private state
      (client as any).cachedToken.expiresAt = Date.now() - 1000;
      const t3 = await client.getSessionToken();
      expect(t3).toBe("token-call-2");
      expect(callCount).toBe(2);
    });

    it("throws explicit ABDM_GATEWAY_AUTH_FAILURE on HTTP 401 or 403", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid client credentials" }),
      });

      const mockConfig = {
        gatewayBaseUrl: "https://dev.abdm.gov.in/gateway",
        clientId: "wrong-client",
        clientSecret: "wrong-secret",
        hipId: "AIIA_DELHI_01",
        hprId: "HPR-01",
        cmId: "sbx",
        isSandboxConfigured: true,
      };

      const client = new AbdmClient(mockConfig);
      await expect(client.getSessionToken()).rejects.toThrow("ABDM_GATEWAY_AUTH_FAILURE");
    });

    it("builds Gateway V3 request headers with Bearer token, UUID request ID, and timestamp", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "valid-header-token-123",
          expiresIn: 1800,
        }),
      });

      const mockConfig = {
        gatewayBaseUrl: "https://dev.abdm.gov.in/gateway",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        hipId: "AIIA_DELHI_01",
        hprId: "HPR-01",
        cmId: "sbx",
        isSandboxConfigured: true,
      };

      const client = new AbdmClient(mockConfig);
      const headers = await client.buildGatewayHeaders("sbx");

      expect(headers["Authorization"]).toBe("Bearer valid-header-token-123");
      expect(headers["X-CM-ID"]).toBe("sbx");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["REQUEST-ID"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(headers["TIMESTAMP"]).toBeDefined();
    });

    it("provides mandatory non-certification disclaimer", () => {
      expect(ABDM_DISCLAIMER).toContain("ABDM integration-ready architecture");
      expect(ABDM_DISCLAIMER).toContain("requires authorized NHA credentials");
    });
  });
});
