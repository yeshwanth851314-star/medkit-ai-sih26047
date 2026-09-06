import { ClinicalCase, Patient, MedicalDocument } from "../../types/database";
import {
  FhirR4Bundle,
  FhirPatientResource,
  FhirEncounterResource,
  FhirConditionResource,
  FhirObservationResource,
  FhirAllergyIntoleranceResource,
  FhirMedicationStatementResource,
  FhirBundleEntry,
} from "./types";

export const ABDM_COMPLIANCE_DISCLAIMER =
  "FHIR-compatible representation / ABDM integration-ready architecture";

export function mapCaseToFhirBundle(params: {
  clinicalCase: ClinicalCase;
  patient: Patient;
  documents?: MedicalDocument[];
}): FhirR4Bundle {
  const { clinicalCase, patient, documents = [] } = params;
  const entries: FhirBundleEntry[] = [];
  const timestamp = clinicalCase.finalized_at || clinicalCase.created_at || new Date().toISOString();

  // 1. Patient Resource
  const fhirPatient: FhirPatientResource = {
    resourceType: "Patient",
    id: patient.id,
    identifier: [
      {
        system: "https://healthid.ndhm.gov.in",
        value: patient.abha_id || patient.patient_code,
      },
      {
        system: "https://medkit.ai/mrn",
        value: patient.patient_code,
      },
    ],
    name: [
      {
        use: "official",
        text: patient.full_name,
      },
    ],
    gender:
      patient.gender?.trim().toLowerCase() === "male"
        ? "male"
        : patient.gender?.trim().toLowerCase() === "female"
        ? "female"
        : patient.gender?.trim().toLowerCase() === "other"
        ? "other"
        : "unknown",
    birthDate: patient.date_of_birth || undefined,
    telecom: patient.phone
      ? [
          {
            system: "phone",
            value: patient.phone,
          },
        ]
      : undefined,
  };

  entries.push({
    fullUrl: `urn:uuid:${patient.id}`,
    resource: fhirPatient,
  });

  // 2. Encounter Resource
  const encounterId = `enc-${clinicalCase.id}`;
  const fhirEncounter: FhirEncounterResource = {
    resourceType: "Encounter",
    id: encounterId,
    status: clinicalCase.status === "final" ? "finished" : "in-progress",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    subject: {
      reference: `urn:uuid:${patient.id}`,
      display: patient.full_name,
    },
    period: {
      start: clinicalCase.created_at,
      end: clinicalCase.finalized_at || undefined,
    },
  };

  entries.push({
    fullUrl: `urn:uuid:${encounterId}`,
    resource: fhirEncounter,
  });

  // 3. Condition (Chief Complaint & Diagnosis)
  if (clinicalCase.chief_complaint) {
    const conditionId = `cond-${clinicalCase.id}`;
    const fhirCondition: FhirConditionResource = {
      resourceType: "Condition",
      id: conditionId,
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: clinicalCase.status === "final" ? "confirmed" : "provisional",
          },
        ],
      },
      code: {
        text: clinicalCase.chief_complaint,
      },
      subject: {
        reference: `urn:uuid:${patient.id}`,
        display: patient.full_name,
      },
      encounter: {
        reference: `urn:uuid:${encounterId}`,
      },
      recordedDate: clinicalCase.created_at,
    };

    entries.push({
      fullUrl: `urn:uuid:${conditionId}`,
      resource: fhirCondition,
    });
  }

  // 4. Observations (Vitals)
  const examination = clinicalCase.examination || {};
  const vitalsNested =
    examination.vitals && typeof examination.vitals === "object" ? examination.vitals : {};

  const parseNumericVital = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number" && !isNaN(val)) return val;
    const cleaned = String(val).replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const bp = vitalsNested.blood_pressure || examination.blood_pressure;
  const hr =
    vitalsNested.heart_rate || vitalsNested.pulse || examination.pulse || examination.heart_rate;
  const temp = vitalsNested.temperature || examination.temperature;
  const spo2 = vitalsNested.spo2 || examination.spo2;
  const rr = vitalsNested.respiratory_rate || examination.respiratory_rate;

  if (bp) {
    entries.push({
      fullUrl: `urn:uuid:obs-bp-${clinicalCase.id}`,
      resource: {
        resourceType: "Observation",
        id: `obs-bp-${clinicalCase.id}`,
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "85354-9",
              display: "Blood pressure panel with all children optional",
            },
          ],
          text: "Blood Pressure",
        },
        subject: { reference: `urn:uuid:${patient.id}` },
        valueString: String(bp),
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const hrNum = parseNumericVital(hr);
  if (hrNum !== null) {
    entries.push({
      fullUrl: `urn:uuid:obs-hr-${clinicalCase.id}`,
      resource: {
        resourceType: "Observation",
        id: `obs-hr-${clinicalCase.id}`,
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8867-4",
              display: "Heart rate",
            },
          ],
          text: "Heart Rate",
        },
        subject: { reference: `urn:uuid:${patient.id}` },
        valueQuantity: {
          value: hrNum,
          unit: "beats/minute",
          system: "http://unitsofmeasure.org",
          code: "/min",
        },
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const tempNum = parseNumericVital(temp);
  if (tempNum !== null) {
    entries.push({
      fullUrl: `urn:uuid:obs-temp-${clinicalCase.id}`,
      resource: {
        resourceType: "Observation",
        id: `obs-temp-${clinicalCase.id}`,
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8310-5",
              display: "Body temperature",
            },
          ],
          text: "Body Temperature",
        },
        subject: { reference: `urn:uuid:${patient.id}` },
        valueQuantity: {
          value: tempNum,
          unit: "Fahrenheit",
          system: "http://unitsofmeasure.org",
          code: "[degF]",
        },
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const spo2Num = parseNumericVital(spo2);
  if (spo2Num !== null) {
    entries.push({
      fullUrl: `urn:uuid:obs-spo2-${clinicalCase.id}`,
      resource: {
        resourceType: "Observation",
        id: `obs-spo2-${clinicalCase.id}`,
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "2708-6",
              display: "Oxygen saturation in Arterial blood",
            },
          ],
          text: "Oxygen Saturation (SpO2)",
        },
        subject: { reference: `urn:uuid:${patient.id}` },
        valueQuantity: {
          value: spo2Num,
          unit: "%",
          system: "http://unitsofmeasure.org",
          code: "%",
        },
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const rrNum = parseNumericVital(rr);
  if (rrNum !== null) {
    entries.push({
      fullUrl: `urn:uuid:obs-rr-${clinicalCase.id}`,
      resource: {
        resourceType: "Observation",
        id: `obs-rr-${clinicalCase.id}`,
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "9279-1",
              display: "Respiratory rate",
            },
          ],
          text: "Respiratory Rate",
        },
        subject: { reference: `urn:uuid:${patient.id}` },
        valueQuantity: {
          value: rrNum,
          unit: "breaths/minute",
          system: "http://unitsofmeasure.org",
          code: "/min",
        },
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  // 5. AllergyIntolerance
  if (Array.isArray(clinicalCase.allergy_history)) {
    clinicalCase.allergy_history.forEach((allergy, index) => {
      entries.push({
        fullUrl: `urn:uuid:allergy-${clinicalCase.id}-${index}`,
        resource: {
          resourceType: "AllergyIntolerance",
          id: `allergy-${clinicalCase.id}-${index}`,
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                code: "active",
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                code: "confirmed",
              },
            ],
          },
          criticality:
            allergy.severity === "Severe"
              ? "high"
              : allergy.severity === "Mild"
              ? "low"
              : "unable-to-assess",
          code: {
            text: `${allergy.substance} (${allergy.reaction || "allergy"})`,
          },
          patient: {
            reference: `urn:uuid:${patient.id}`,
          },
        } as FhirAllergyIntoleranceResource,
      });
    });
  }

  // 6. MedicationStatement
  if (Array.isArray(clinicalCase.medication_history)) {
    clinicalCase.medication_history.forEach((med, index) => {
      entries.push({
        fullUrl: `urn:uuid:med-${clinicalCase.id}-${index}`,
        resource: {
          resourceType: "MedicationStatement",
          id: `med-${clinicalCase.id}-${index}`,
          status: "active",
          medicationCodeableConcept: {
            text: `${med.name} ${med.dose || ""}`.trim(),
          },
          subject: {
            reference: `urn:uuid:${patient.id}`,
          },
          dosage: [
            {
              text: `${med.frequency || "daily"}${med.duration ? ` for ${med.duration}` : ""}`,
            },
          ],
        } as FhirMedicationStatementResource,
      });
    });
  }

  // 7. DocumentReference (for uploaded prescriptions/labs)
  documents.forEach((doc) => {
    entries.push({
      fullUrl: `urn:uuid:doc-${doc.id}`,
      resource: {
        resourceType: "DocumentReference",
        id: `doc-${doc.id}`,
        status: "current",
        type: {
          text: doc.document_type.toUpperCase(),
        },
        subject: {
          reference: `urn:uuid:${patient.id}`,
        },
        date: doc.created_at,
        content: [
          {
            attachment: {
              contentType: doc.mime_type,
              url: doc.storage_path,
              title: doc.original_filename,
              size: doc.file_size,
            },
          },
        ],
      },
    });
  });

  return {
    resourceType: "Bundle",
    id: `bundle-case-${clinicalCase.id}`,
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifact"],
      lastUpdated: timestamp,
    },
    type: "document",
    timestamp,
    entry: entries,
    abdmComplianceNotice: ABDM_COMPLIANCE_DISCLAIMER,
  };
}
