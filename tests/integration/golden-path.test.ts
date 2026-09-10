import { describe, it, expect } from "vitest";
import { registerPatient } from "../../src/features/patients/patient-service";
import { normalizeIntakeSpeech } from "../../src/features/i18n/multilingual-service";
import { evaluateClinicalRedFlags } from "../../src/features/red-flags/rules-engine";
import {
  createCaseDraft,
  finalizeCase,
  updateCaseDraft,
  getCaseDetails,
} from "../../src/features/cases/case-service";
import {
  processDocumentExtraction,
  validateDocumentFile,
} from "../../src/features/documents/document-service";
import { generateDeterministicSummary } from "../../src/features/summaries/summary-service";
import { mapCaseToFhirBundle } from "../../src/features/interoperability/fhir-mapper";
import { logAuditEvent, getAuditTrailForResource } from "../../src/features/security/audit-service";

describe("Phase 17: SIH26047 Complete Golden Path Integration Test", () => {
  it("executes the full clinical intake, copilot, and interoperability loop hermetically", async () => {
    // -------------------------------------------------------------------------
    // Step 1: Patient Registration
    // -------------------------------------------------------------------------
    const { patient } = await registerPatient({
      fullName: "Sita Ramaiah",
      dateOfBirth: "1968-04-14",
      gender: "Female",
      phone: "+919876543219",
      bloodGroup: "O+",
      address: "Guntur, Andhra Pradesh",
    });

    expect(patient.id).toBeDefined();
    expect(patient.patient_code).toMatch(/^MED-2026-\d{4}$/);

    await logAuditEvent({
      actorId: "staff-kiosk-01",
      actorRole: "staff",
      action: "CREATE_PATIENT",
      resourceType: "patients",
      resourceId: patient.id,
      metadata: { patient_code: patient.patient_code },
    });

    // -------------------------------------------------------------------------
    // Step 2: Patient Multilingual Speech Intake (Telugu)
    // -------------------------------------------------------------------------
    const rawTeluguVoice =
      "ఛాతీలో తీవ్రమైన నొప్పి వస్తోంది, ఎడమ భుజం లాగుతోంది, చాలా చెమటలు పోస్తున్నాయి.";

    const bilingual = normalizeIntakeSpeech({
      rawText: rawTeluguVoice,
      language: "te",
      confidence: 0.94,
    });

    // Medical-legal guarantee: Original Telugu verbatim speech is preserved
    expect(bilingual.originalText).toBe(rawTeluguVoice);
    expect(bilingual.normalizedEnglish).toContain("Severe chest pain");
    expect(bilingual.clinicalEntities?.concepts).toContain("chest_pain");

    // -------------------------------------------------------------------------
    // Step 3: Safety Guardrails & Deterministic Red Flag Detection
    // -------------------------------------------------------------------------
    const redFlagAlerts = evaluateClinicalRedFlags({
      chiefComplaint: bilingual.normalizedEnglish,
      hpi: {
        radiation: "left shoulder",
        associated_symptoms: ["profuse sweating"],
      },
    });

    expect(redFlagAlerts.length).toBeGreaterThanOrEqual(1);
    const cardiacFlag = redFlagAlerts.find((rf) => rf.ruleId === "RED_FLAG_ACUTE_CHEST_PAIN");
    expect(cardiacFlag).toBeDefined();
    expect(cardiacFlag?.severity).toBe("critical");
    expect(cardiacFlag?.message).toContain("Potential red flag detected");

    // -------------------------------------------------------------------------
    // Step 4: Case Intake Draft Creation
    // -------------------------------------------------------------------------
    const caseDraft = await createCaseDraft({
      patientId: patient.id,
      caseType: "general",
      patientLanguage: "te",
      chiefComplaint: bilingual.normalizedEnglish,
      rawPatientComplaint: bilingual.originalText,
      status: "draft",
    });

    expect(caseDraft.id).toBeDefined();
    expect(caseDraft.status).toBe("draft");

    // Attach vitals and red flags to case draft
    const updatedDraft = await updateCaseDraft(caseDraft.id, {
      examination: {
        vitals: {
          blood_pressure: "154/98",
          heart_rate: 116,
          temperature: 98.4,
          spo2: 94,
        },
      },
      red_flags: redFlagAlerts.map((rf) => ({
        rule_id: rf.ruleId,
        severity: rf.severity,
        message: rf.message,
        triggered_at: new Date().toISOString(),
        acknowledged_by: null,
        acknowledged_at: null,
      })),
      medicationHistory: [
        {
          name: "Telmisartan",
          dose: "40mg",
          frequency: "OD",
          source: "patient",
        },
      ],
      allergyHistory: [
        {
          substance: "Sulfa drugs",
          severity: "Moderate",
          reaction: "Skin rash",
          source: "patient",
        },
      ],
    });

    expect(updatedDraft.examination?.vitals.blood_pressure).toBe("154/98");

    // -------------------------------------------------------------------------
    // Step 5: Document Intelligence (Prior Prescription OCR)
    // -------------------------------------------------------------------------
    const validation = validateDocumentFile({
      mimeType: "application/pdf",
      sizeBytes: 154200,
    });
    expect(validation.valid).toBe(true);

    const docOcr = await processDocumentExtraction("doc-0001");
    expect(docOcr.confidence).toBeGreaterThan(0.9);
    expect(docOcr.extractedData.medications.length).toBeGreaterThan(0);
    expect(docOcr.disclaimer).toBe("Extracted from uploaded document — verify before use.");

    // -------------------------------------------------------------------------
    // Step 6: AI-Assisted Clinical Summary Generation
    // -------------------------------------------------------------------------
    const summary = await generateDeterministicSummary(caseDraft.id);

    expect(summary.disclaimer).toBe("AI-assisted summary — clinician review required.");
    expect(summary.chiefComplaint).toContain("Severe chest pain");
    expect(summary.summaryType).toBe("deterministic");

    // -------------------------------------------------------------------------
    // Step 7: Doctor Review & Red Flag Acknowledgment
    // -------------------------------------------------------------------------
    const acknowledgedCase = await updateCaseDraft(caseDraft.id, {
      redFlags: updatedDraft.red_flags?.map((rf) => ({
        ...rf,
        acknowledged_by: "Dr. Arvind Swamy, MD (Cardiology)",
        acknowledged_at: new Date().toISOString(),
      })),
      assessmentPlan: {
        summary: summary.hpiNarrative || summary.chiefComplaint,
        plan: "Urgent 12-lead ECG, Troponin-I test, start dual antiplatelet therapy under monitoring.",
      },
    });

    expect(acknowledgedCase.red_flags?.[0].acknowledged_by).toContain("Dr. Arvind Swamy");

    // -------------------------------------------------------------------------
    // Step 8: Clinician Finalization & Immutability Enforcement
    // -------------------------------------------------------------------------
    const finalized = await finalizeCase(caseDraft.id);
    expect(finalized.status).toBe("final");
    expect(finalized.finalized_at).toBeDefined();

    // Verify immutability: attempting to mutate throws CANNOT_MUTATE_FINAL
    await expect(
      updateCaseDraft(caseDraft.id, { chiefComplaint: "Attempted mutation after lock" })
    ).rejects.toThrow("CANNOT_MUTATE_FINAL");

    // -------------------------------------------------------------------------
    // Step 9: FHIR R4 Bundle Generation & ABDM Interoperability
    // -------------------------------------------------------------------------
    const fhirBundle = mapCaseToFhirBundle({
      clinicalCase: finalized,
      patient,
      documents: [
        {
          id: "doc-prior-01",
          patient_id: patient.id,
          case_id: finalized.id,
          storage_path: "/storage/prior_cardiac_prescription.pdf",
          original_filename: "prior_cardiac_prescription.pdf",
          mime_type: "application/pdf",
          file_size: 154200,
          document_type: "prescription",
          processing_status: "confirmed",
          created_at: new Date().toISOString(),
        },
      ],
    });

    expect(fhirBundle.resourceType).toBe("Bundle");
    expect(fhirBundle.type).toBe("document");
    expect(fhirBundle.meta.tag?.[0]?.display).toBe(
      "FHIR-compatible representation / ABDM integration-ready architecture"
    );

    // Verify key FHIR resources in bundle
    const patientResource = fhirBundle.entry.find((e) => e.resource.resourceType === "Patient");
    const encounterResource = fhirBundle.entry.find((e) => e.resource.resourceType === "Encounter");
    const conditionResource = fhirBundle.entry.find((e) => e.resource.resourceType === "Condition");
    const observations = fhirBundle.entry.filter((e) => e.resource.resourceType === "Observation");

    expect(patientResource).toBeDefined();
    expect(encounterResource).toBeDefined();
    expect(conditionResource).toBeDefined();
    expect(observations.length).toBeGreaterThanOrEqual(4);

    // -------------------------------------------------------------------------
    // Step 10: Verify Comprehensive Audit Trail
    // -------------------------------------------------------------------------
    await logAuditEvent({
      actorId: "dr-arvind-01",
      actorRole: "doctor",
      action: "FINALIZE_CASE",
      resourceType: "cases",
      resourceId: finalized.id,
      metadata: { case_status: "final", fhir_exported: true },
    });

    const auditTrail = await getAuditTrailForResource("cases", finalized.id);
    expect(auditTrail.length).toBeGreaterThanOrEqual(1);
    expect(auditTrail[0].action).toBe("FINALIZE_CASE");
  });
});
