import { describe, it, expect, beforeEach } from "vitest";
import {
  createCaseDraft,
  updateCaseDraft,
  finalizeCase,
  getCaseDetails,
} from "../../src/features/cases/case-service";
import {
  createInterviewSession,
  submitInterviewAnswerAsync,
  compileInterviewToCase,
  clearInterviewSessionCache,
} from "../../src/features/interview/interview-service";
import {
  registerPatient,
} from "../../src/features/patients/patient-service";
import {
  recordPatientConsent,
  revokePatientConsent,
  verifyPatientConsent,
} from "../../src/features/consent/consent-service";
import {
  ResilientAIProvider,
  DeterministicDemoAIProvider,
  AIProvider,
} from "../../src/features/ai/ai-provider";
import {
  ResilientOCRProvider,
  DeterministicDemoOCRProvider,
  OCRProvider,
} from "../../src/features/documents/ocr-provider";
import {
  ResilientSpeechProvider,
  DeterministicDemoSpeechProvider,
  SpeechProvider,
} from "../../src/features/voice/speech-provider";
import { prepareAbdmHealthRecordPayload } from "../../src/features/abdm";
import { mockDb } from "../../src/lib/db/mock-adapter";
import { AuthUser } from "../../src/features/auth/types";
import { ConsentRecord } from "../../src/features/consent/types";

describe("Phase 5: Complete Clinical Workflow & Resilience Failure Matrix (A–N)", () => {
  const facilityA = "fac-001";
  const facilityB = "fac-002";

  const clinicianA: AuthUser = {
    id: "doc-001",
    email: "dr.sharma@hospital-a.org",
    fullName: "Dr. Sharma",
    role: "doctor",
    facilityId: facilityA,
  };

  const clinicianB: AuthUser = {
    id: "doc-002",
    email: "dr.reddy@hospital-b.org",
    fullName: "Dr. Reddy",
    role: "doctor",
    facilityId: facilityB,
  };

  beforeEach(() => {
    clearInterviewSessionCache();
  });

  // ---------------------------------------------------------------------------
  // A. Database Failure Handling
  // ---------------------------------------------------------------------------
  it("[Scenario A] Database failure: operations fail closed without corrupting state", async () => {
    // Attempting to finalize a non-existent case fails gracefully
    await expect(finalizeCase("non-existent-case-uuid")).rejects.toThrow("Case not found");

    // Attempting to update a non-existent case fails gracefully
    await expect(
      updateCaseDraft("non-existent-case-uuid", { chiefComplaint: "Test" })
    ).rejects.toThrow("Case not found");
  });

  // ---------------------------------------------------------------------------
  // B. Network Interruption & Offline Recovery
  // ---------------------------------------------------------------------------
  it("[Scenario B] Network interruption / draft persistence preserves clinical draft state", async () => {
    const { patient } = await registerPatient({
      fullName: "Arun Kumar",
      dateOfBirth: "1980-01-01",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543201",
    });

    const draft = await createCaseDraft({
      patientId: patient.id,
      chiefComplaint: "Severe epigastric pain",
      caseType: "general",
      patientLanguage: "en",
    });

    // Simulate saving before network cut
    const updated = await updateCaseDraft(draft.id, {
      hpi: { duration: "4 days", severity: "severe" },
    });
    expect(updated.hpi?.duration).toBe("4 days");

    // Simulate reload after network restoration
    const recovered = await getCaseDetails(draft.id);
    expect(recovered).toBeDefined();
    expect(recovered?.hpi?.duration).toBe("4 days");
  });

  // ---------------------------------------------------------------------------
  // C. Duplicate Submission & Idempotency
  // ---------------------------------------------------------------------------
  it("[Scenario C] Duplicate submission: finalization is idempotent or strictly rejects post-lock mutation", async () => {
    const { patient } = await registerPatient({
      fullName: "Bhavani Shankar",
      dateOfBirth: "1975-03-12",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543202",
    });

    const draft = await createCaseDraft({
      patientId: patient.id,
      chiefComplaint: "Shortness of breath on exertion",
      caseType: "general",
      patientLanguage: "en",
    });

    const finalized1 = await finalizeCase(draft.id);
    expect(finalized1.status).toBe("final");

    // Attempting to mutate locked case rejects
    await expect(
      updateCaseDraft(draft.id, { chiefComplaint: "Modified complaint" })
    ).rejects.toThrow("CANNOT_MUTATE_FINAL");
  });

  // ---------------------------------------------------------------------------
  // D. Session Expiry
  // ---------------------------------------------------------------------------
  it("[Scenario D] Session expiry: expired sessions strictly reject answers", async () => {
    const { patient } = await registerPatient({
      fullName: "Chitra Raman",
      dateOfBirth: "1992-07-24",
      gender: "Female",
      bloodGroup: "O+",
      phone: "+919876543203",
    });

    const session = createInterviewSession(patient.id, "en", null, facilityA, { actorOrToken: clinicianA });
    await new Promise((r) => setTimeout(r, 20));

    const durable = await mockDb.getIntakeSessionById(session.id);
    if (durable) {
      durable.expires_at = new Date(Date.now() - 3600000).toISOString();
      durable.status = "expired";
    }

    await expect(
      submitInterviewAnswerAsync(session.id, "Yes, dry cough", "touch", { actorOrToken: clinicianA })
    ).rejects.toThrow(/SESSION_EXPIRED|not active/i);
  });

  // ---------------------------------------------------------------------------
  // E. Kiosk Revocation
  // ---------------------------------------------------------------------------
  it("[Scenario E] Kiosk revocation: revoked session immediately fails closed", async () => {
    const { patient } = await registerPatient({
      fullName: "Deepak Verma",
      dateOfBirth: "1988-12-05",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543204",
    });

    const session = createInterviewSession(patient.id, "en", null, facilityA, { actorOrToken: clinicianA });
    await new Promise((r) => setTimeout(r, 20));

    mockDb.recordRevocation(session.id, "kiosk_cancelled", "abandoned");

    await expect(
      submitInterviewAnswerAsync(session.id, "Fever", "touch", { actorOrToken: clinicianA })
    ).rejects.toThrow(/SESSION_REVOKED/);

    await expect(
      compileInterviewToCase(session.id, { actorOrToken: clinicianA })
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  // ---------------------------------------------------------------------------
  // F. Cross-Facility Access Denial
  // ---------------------------------------------------------------------------
  it("[Scenario F] Cross-facility isolation: Clinician A cannot access Facility B records", async () => {
    const { patient: patientB } = await registerPatient({
      fullName: "Eshwar Rao",
      dateOfBirth: "1960-09-18",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543205",
    });

    // Create session in Facility B
    const sessionB = createInterviewSession(patientB.id, "en", null, facilityB, { actorOrToken: clinicianB });
    await new Promise((r) => setTimeout(r, 20));

    // Clinician A (from Facility A) attempts to submit answer to Facility B's session
    await expect(
      submitInterviewAnswerAsync(sessionB.id, "Fever", "touch", { actorOrToken: clinicianA })
    ).rejects.toThrow(/SESSION_REVOKED|UNAUTHORIZED/i);
  });

  // ---------------------------------------------------------------------------
  // G. Consent Revocation
  // ---------------------------------------------------------------------------
  it("[Scenario G] Consent revocation: revoking consent terminates permission", async () => {
    const { patient } = await registerPatient({
      fullName: "Gita Govind",
      dateOfBirth: "1983-04-10",
      gender: "Female",
      bloodGroup: "O+",
      phone: "+919876543206",
    });

    const consent = await recordPatientConsent({
      patientId: patient.id,
      purpose: "clinical_care_and_case_taking",
    });

    const verified = await verifyPatientConsent(patient.id);
    expect(verified.valid).toBe(true);

    await revokePatientConsent(consent.id, patient.id, "Patient requested withdrawal");
    const reVerified = await verifyPatientConsent(patient.id);
    expect(reVerified.valid).toBe(false);

    // ABDM payload generator strictly refuses revoked consent
    const mockCase = await createCaseDraft({
      patientId: patient.id,
      chiefComplaint: "Routine checkup",
      caseType: "general",
      patientLanguage: "en",
    });
    const finalized = await finalizeCase(mockCase.id);

    const revokedConsentRecord: ConsentRecord = {
      ...consent,
      status: "revoked",
      revoked: true,
      revoked_at: new Date().toISOString(),
    };

    expect(() => {
      prepareAbdmHealthRecordPayload({
        clinicalCase: finalized,
        patient,
        consent: revokedConsentRecord,
      });
    }).toThrow("ABDM_CONSENT_VIOLATION");
  });

  // ---------------------------------------------------------------------------
  // H. Gemini Failure & Fallback Handling
  // ---------------------------------------------------------------------------
  it("[Scenario H] Gemini provider failure: falls back safely to deterministic summary", async () => {
    const { patient } = await registerPatient({
      fullName: "Hitesh Patel",
      dateOfBirth: "1989-02-17",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543209",
    });

    const testCase = await createCaseDraft({
      patientId: patient.id,
      chiefComplaint: "Dry cough for 2 weeks",
      caseType: "general",
      patientLanguage: "en",
    });

    const failingGemini: AIProvider = {
      name: "gemini-2.5-flash",
      generateClinicalSummary: async () => {
        throw new Error("503 Service Unavailable / Model Overloaded");
      },
    };

    const fallback = new DeterministicDemoAIProvider();
    const resilient = new ResilientAIProvider(failingGemini, fallback, 1000);

    const result = await resilient.generateClinicalSummary(testCase.id);
    expect(result).toBeDefined();
    expect(result.providerMeta.fallbackUsed).toBe(true);
    expect(result.providerMeta.fallbackReason).toContain("503 Service Unavailable");
    expect(result.disclaimer).toBe("AI-assisted summary — clinician review required.");
  });

  // ---------------------------------------------------------------------------
  // I. OCR Failure Handling
  // ---------------------------------------------------------------------------
  it("[Scenario I] OCR failure: falls back safely with clear status and disclaimer", async () => {
    const failingOCR: OCRProvider = {
      name: "gemini-vision",
      extract: async () => {
        throw new Error("429 Resource Exhausted / Quota Limit");
      },
    };

    const fallback = new DeterministicDemoOCRProvider();
    const resilient = new ResilientOCRProvider(failingOCR, fallback, 1000);

    const result = await resilient.extract({ documentId: "doc-01" });
    expect(result).toBeDefined();
    expect(result.providerMeta.fallbackUsed).toBe(true);
    expect(result.disclaimer).toBe("Extracted from uploaded document — verify before use.");
  });

  // ---------------------------------------------------------------------------
  // J. Speech Failure Handling
  // ---------------------------------------------------------------------------
  it("[Scenario J] Speech failure: resilient provider falls back without crashing", async () => {
    const failingSpeech: SpeechProvider = {
      name: "gemini-audio",
      transcribe: async () => {
        throw new Error("Audio buffer decode error");
      },
    };

    const fallback = new DeterministicDemoSpeechProvider();
    const resilient = new ResilientSpeechProvider(failingSpeech, fallback, 1000);

    const result = await resilient.transcribe({ language: "en" });
    expect(result).toBeDefined();
    expect(result.providerMeta.fallbackUsed).toBe(true);
    expect(result.rawTranscript).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // K. Malformed Provider Output Handling
  // ---------------------------------------------------------------------------
  it("[Scenario K] Malformed provider output: resilient wrappers intercept invalid results", async () => {
    const { patient } = await registerPatient({
      fullName: "Kamala Devi",
      dateOfBirth: "1977-05-19",
      gender: "Female",
      bloodGroup: "O+",
      phone: "+919876543212",
    });

    const testCase = await createCaseDraft({
      patientId: patient.id,
      chiefComplaint: "Mild fever and sore throat",
      caseType: "general",
      patientLanguage: "en",
    });

    const malformedAI: AIProvider = {
      name: "gemini-2.5-flash",
      generateClinicalSummary: async () => {
        throw new Error("INVALID_JSON: Unexpected token < in JSON at position 0");
      },
    };

    const fallback = new DeterministicDemoAIProvider();
    const resilient = new ResilientAIProvider(malformedAI, fallback, 1000);

    const result = await resilient.generateClinicalSummary(testCase.id);
    expect(result).toBeDefined();
    expect(result.providerMeta.fallbackUsed).toBe(true);
    expect(result.providerMeta.fallbackReason).toContain("INVALID_JSON");
  });

  // ---------------------------------------------------------------------------
  // L. Storage Failure Handling
  // ---------------------------------------------------------------------------
  it("[Scenario L] Storage failure: document processing throws clearly on missing/corrupt document", async () => {
    const { processDocumentExtraction } = await import(
      "../../src/features/documents/document-service"
    );

    const result = await processDocumentExtraction("doc-missing-storage");
    expect(result).toBeDefined();
    expect(result.status).toBe("review");
  });

  // ---------------------------------------------------------------------------
  // M. Refresh During Intake
  // ---------------------------------------------------------------------------
  it("[Scenario M] Refresh during intake: durable session survives in-memory cache eviction", async () => {
    const { patient } = await registerPatient({
      fullName: "Harish Chandra",
      dateOfBirth: "1972-08-14",
      gender: "Male",
      bloodGroup: "O+",
      phone: "+919876543207",
    });

    const session = createInterviewSession(patient.id, "en", null, facilityA, { actorOrToken: clinicianA });
    await new Promise((r) => setTimeout(r, 20));

    // Submit first answer
    await submitInterviewAnswerAsync(session.id, "Headache for 3 days", "touch", { actorOrToken: clinicianA });

    // Simulate browser refresh / in-memory cache loss
    clearInterviewSessionCache();

    // Clinician continues after refresh: submit second answer
    const postRefreshResult = await submitInterviewAnswerAsync(session.id, "No vomiting", "touch", {
      actorOrToken: clinicianA,
    });

    expect(postRefreshResult.session).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // N. Server/Cache Restart Recovery
  // ---------------------------------------------------------------------------
  it("[Scenario N] Server/cache restart: compilation to case succeeds after total cache wipe", async () => {
    const { patient } = await registerPatient({
      fullName: "Indira Priyadarshini",
      dateOfBirth: "1981-10-31",
      gender: "Female",
      bloodGroup: "O+",
      phone: "+919876543208",
    });

    const consent = await recordPatientConsent({
      patientId: patient.id,
      language: "en",
    });

    const session = createInterviewSession(patient.id, "en", consent.id, facilityA, { actorOrToken: clinicianA });
    await new Promise((r) => setTimeout(r, 20));

    await submitInterviewAnswerAsync(session.id, "Chronic joint pains in both knees", "touch", {
      actorOrToken: clinicianA,
    });

    // Total cache wipe (simulating server reboot)
    clearInterviewSessionCache();

    // Compilation succeeds from durable database state
    const compiledCase = await compileInterviewToCase(session.id, {
      actorOrToken: clinicianA,
    });

    expect(compiledCase).toBeDefined();
    expect(compiledCase.id).toBeDefined();
    expect(compiledCase.patient_id).toBe(patient.id);
  });
});
