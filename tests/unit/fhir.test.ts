import { describe, it, expect } from "vitest";
import {
  mapCaseToFhirBundle,
  ABDM_COMPLIANCE_DISCLAIMER,
} from "../../src/features/interoperability/fhir-mapper";
import {
  FhirPatientResource,
  FhirEncounterResource,
  FhirConditionResource,
  FhirObservationResource,
  FhirAllergyIntoleranceResource,
  FhirMedicationStatementResource,
} from "../../src/features/interoperability/types";
import { ClinicalCase, Patient, MedicalDocument } from "../../src/types/database";

describe("Phase 13: FHIR R4 & ABDM Interoperability Tests", () => {
  const mockPatient: Patient = {
    id: "11111111-1111-4111-8111-111111111111",
    patient_code: "MED-2026-0001",
    full_name: "Rajesh Varma",
    date_of_birth: "1978-05-12",
    gender: "male",
    phone: "+919876543210",
    abha_id: "14-2345-6789-0123",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  };

  const mockCase: ClinicalCase = {
    id: "c-001",
    patient_id: mockPatient.id,
    status: "final",
    case_type: "general",
    patient_language: "en",
    chief_complaint: "Acute severe chest pain radiating to left arm",
    examination: {
      vitals: {
        blood_pressure: "148/96",
        heart_rate: 112,
        temperature: 98.6,
        spo2: 95,
      },
    },
    allergy_history: [
      {
        substance: "Penicillin",
        reaction: "Urticaria and facial edema",
        severity: "Severe",
      },
    ],
    medication_history: [
      {
        name: "Amlodipine",
        dose: "5mg",
        frequency: "OD",
        duration: "ongoing",
      },
    ],
    created_at: "2026-09-01T10:15:00Z",
    finalized_at: "2026-09-01T11:00:00Z",
  };

  const mockDocs: MedicalDocument[] = [
    {
      id: "doc-01",
      patient_id: mockPatient.id,
      case_id: mockCase.id,
      storage_path: "/uploads/ecg_report.pdf",
      original_filename: "ecg_report.pdf",
      mime_type: "application/pdf",
      file_size: 204850,
      document_type: "lab",
      processing_status: "confirmed",
      created_at: "2026-09-01T10:20:00Z",
    },
  ];

  it("produces a valid FHIR R4 Bundle with ABDM profile metadata", () => {
    const bundle = mapCaseToFhirBundle({
      clinicalCase: mockCase,
      patient: mockPatient,
      documents: mockDocs,
    });

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("document");
    expect(bundle.meta.profile).toContain(
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifact"
    );
    expect(bundle.abdmComplianceNotice).toBe(ABDM_COMPLIANCE_DISCLAIMER);
    expect(bundle.entry.length).toBeGreaterThanOrEqual(6);
  });

  it("correctly maps Patient resource with ABHA identifier", () => {
    const bundle = mapCaseToFhirBundle({ clinicalCase: mockCase, patient: mockPatient });
    const patientEntry = bundle.entry.find((e) => e.resource.resourceType === "Patient");

    expect(patientEntry).toBeDefined();
    const patientRes = patientEntry?.resource as FhirPatientResource;
    expect(patientRes.id).toBe(mockPatient.id);
    expect(patientRes.identifier).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          system: "https://healthid.ndhm.gov.in",
          value: mockPatient.abha_id,
        }),
      ])
    );
  });

  it("maps Encounter and Condition resources with proper clinical status", () => {
    const bundle = mapCaseToFhirBundle({ clinicalCase: mockCase, patient: mockPatient });
    const encounter = bundle.entry.find((e) => e.resource.resourceType === "Encounter");
    const condition = bundle.entry.find((e) => e.resource.resourceType === "Condition");

    expect(encounter).toBeDefined();
    const encRes = encounter?.resource as FhirEncounterResource;
    expect(encRes.status).toBe("finished");

    expect(condition).toBeDefined();
    const condRes = condition?.resource as FhirConditionResource;
    expect(condRes.code.text).toBe(mockCase.chief_complaint);
    expect(condRes.verificationStatus.coding[0].code).toBe("confirmed");
  });

  it("encodes vital signs as LOINC observations", () => {
    const bundle = mapCaseToFhirBundle({ clinicalCase: mockCase, patient: mockPatient });
    const observations = bundle.entry.filter((e) => e.resource.resourceType === "Observation");

    expect(observations.length).toBe(4);

    const bpObs = observations.find((o) => o.resource.id.includes("obs-bp"))
      ?.resource as FhirObservationResource;
    expect(bpObs?.code.coding?.[0].code).toBe("85354-9");
    expect(bpObs?.valueString).toBe("148/96");

    const hrObs = observations.find((o) => o.resource.id.includes("obs-hr"))
      ?.resource as FhirObservationResource;
    expect(hrObs?.code.coding?.[0].code).toBe("8867-4");
    expect(hrObs?.valueQuantity?.value).toBe(112);
  });

  it("maps Allergies, Medications, and DocumentReferences", () => {
    const bundle = mapCaseToFhirBundle({
      clinicalCase: mockCase,
      patient: mockPatient,
      documents: mockDocs,
    });

    const allergy = bundle.entry.find((e) => e.resource.resourceType === "AllergyIntolerance");
    expect(allergy).toBeDefined();
    const allergyRes = allergy?.resource as FhirAllergyIntoleranceResource;
    expect(allergyRes.criticality).toBe("high");
    expect(allergyRes.code.text).toContain("Penicillin");

    const medication = bundle.entry.find((e) => e.resource.resourceType === "MedicationStatement");
    expect(medication).toBeDefined();
    const medRes = medication?.resource as FhirMedicationStatementResource;
    expect(medRes.medicationCodeableConcept.text).toContain("Amlodipine 5mg");

    const doc = bundle.entry.find((e) => e.resource.resourceType === "DocumentReference");
    expect(doc).toBeDefined();
    const docRes = doc?.resource as Record<string, any>;
    expect(docRes.content[0].attachment.title).toBe("ecg_report.pdf");
  });
});
