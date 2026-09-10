import { createHash } from "crypto";
import { ClinicalCase, Patient, MedicalDocument } from "../../types/database";
import {
  FhirR4Bundle,
  FhirCompositionResource,
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

export function toDeterministicUuid(seed: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(seed)) {
    return seed.toLowerCase();
  }
  const hash = createHash("sha256").update(seed).digest("hex");
  const p1 = hash.substring(0, 8);
  const p2 = hash.substring(8, 12);
  const p3 = "4" + hash.substring(13, 16);
  const p4 = ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.substring(18, 20);
  const p5 = hash.substring(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toLowerCase();
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function mapCaseToFhirBundle(params: {
  clinicalCase: ClinicalCase;
  patient: Patient;
  documents?: MedicalDocument[];
}): FhirR4Bundle {
  const { clinicalCase, patient, documents = [] } = params;
  const entries: FhirBundleEntry[] = [];
  const timestamp = clinicalCase.finalized_at || clinicalCase.created_at || new Date().toISOString();

  // Deterministic, standard RFC 4122 UUIDs for all FHIR URN identifiers
  const patientUuid = toDeterministicUuid(patient.id);
  const encounterUuid = toDeterministicUuid(`enc-${clinicalCase.id}`);
  const compositionUuid = toDeterministicUuid(`comp-${clinicalCase.id}`);
  const conditionUuid = toDeterministicUuid(`cond-${clinicalCase.id}`);
  const authorIdentifier = clinicalCase.created_by || "clinician-default";
  const practitionerUuid = toDeterministicUuid(`practitioner-${authorIdentifier}`);
  const authorDisplay = clinicalCase.finalized_by || "Attending Clinician";

  // 1. Composition Resource (MANDATORY entry[0] for FHIR R4 document bundles)
  const fhirComposition: FhirCompositionResource = {
    resourceType: "Composition",
    id: compositionUuid,
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"],
    },
    status: clinicalCase.status === "final" ? "final" : "preliminary",
    type: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "371530004",
          display: "Clinical consultation report",
        },
      ],
      text: clinicalCase.case_type === "ayush" ? "AYUSH Clinical Encounter Record" : "Clinical Consultation Record",
    },
    subject: {
      reference: `urn:uuid:${patientUuid}`,
      display: patient.full_name,
    },
    encounter: {
      reference: `urn:uuid:${encounterUuid}`,
    },
    date: timestamp,
    author: [
      {
        reference: `urn:uuid:${practitionerUuid}`,
        display: authorDisplay,
      },
    ],
    title: clinicalCase.case_type === "ayush"
      ? `AYUSH Clinical Case Record - ${patient.full_name}`
      : `Clinical Consultation Summary - ${patient.full_name}`,
    section: [
      {
        title: "Chief Complaint",
        entry: clinicalCase.chief_complaint ? [{ reference: `urn:uuid:${conditionUuid}` }] : undefined,
      },
      {
        title: "Assessment & Plan",
        text: {
          status: "generated",
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeXml(clinicalCase.assessment_plan?.summary || clinicalCase.chief_complaint)}</p></div>`,
        },
      },
    ],
  };

  entries.push({
    fullUrl: `urn:uuid:${compositionUuid}`,
    resource: fhirComposition,
  });

  // 2. Author Practitioner Resource (mandatory entry when case has an author)
  entries.push({
    fullUrl: `urn:uuid:${practitionerUuid}`,
    resource: {
      resourceType: "Practitioner",
      id: practitionerUuid,
      identifier: [
        {
          system: "https://medkit.ai/practitioners",
          value: authorIdentifier,
        },
      ],
      name: [
        {
          use: "official",
          text: authorDisplay,
        },
      ],
    },
  });

  // 3. Patient Resource
  const fhirPatient: FhirPatientResource = {
    resourceType: "Patient",
    id: patientUuid,
    identifier: [
      ...(patient.abha_id
        ? [
            {
              system: "https://healthid.ndhm.gov.in",
              value: patient.abha_id,
            },
          ]
        : []),
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
    fullUrl: `urn:uuid:${patientUuid}`,
    resource: fhirPatient,
  });

  // 4. Encounter Resource
  const fhirEncounter: FhirEncounterResource = {
    resourceType: "Encounter",
    id: encounterUuid,
    status: clinicalCase.status === "final" ? "finished" : "in-progress",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    subject: {
      reference: `urn:uuid:${patientUuid}`,
      display: patient.full_name,
    },
    period: {
      start: clinicalCase.created_at,
      end: clinicalCase.finalized_at || undefined,
    },
  };

  entries.push({
    fullUrl: `urn:uuid:${encounterUuid}`,
    resource: fhirEncounter,
  });

  // 5. Condition (Chief Complaint & Diagnosis)
  if (clinicalCase.chief_complaint) {
    const fhirCondition: FhirConditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
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
        reference: `urn:uuid:${patientUuid}`,
        display: patient.full_name,
      },
      encounter: {
        reference: `urn:uuid:${encounterUuid}`,
      },
      recordedDate: clinicalCase.created_at,
    };

    entries.push({
      fullUrl: `urn:uuid:${conditionUuid}`,
      resource: fhirCondition,
    });
  }

  // 6. Observations (Vitals)
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
    const bpUuid = toDeterministicUuid(`obs-bp-${clinicalCase.id}`);
    entries.push({
      fullUrl: `urn:uuid:${bpUuid}`,
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
        subject: { reference: `urn:uuid:${patientUuid}` },
        valueString: String(bp),
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const hrNum = parseNumericVital(hr);
  if (hrNum !== null) {
    const hrUuid = toDeterministicUuid(`obs-hr-${clinicalCase.id}`);
    entries.push({
      fullUrl: `urn:uuid:${hrUuid}`,
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
        subject: { reference: `urn:uuid:${patientUuid}` },
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
    const tempUuid = toDeterministicUuid(`obs-temp-${clinicalCase.id}`);
    const isCelsius = tempNum < 45;
    entries.push({
      fullUrl: `urn:uuid:${tempUuid}`,
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
        subject: { reference: `urn:uuid:${patientUuid}` },
        valueQuantity: {
          value: tempNum,
          unit: isCelsius ? "Celsius" : "Fahrenheit",
          system: "http://unitsofmeasure.org",
          code: isCelsius ? "Cel" : "[degF]",
        },
        effectiveDateTime: timestamp,
      } as FhirObservationResource,
    });
  }

  const spo2Num = parseNumericVital(spo2);
  if (spo2Num !== null) {
    const spo2Uuid = toDeterministicUuid(`obs-spo2-${clinicalCase.id}`);
    entries.push({
      fullUrl: `urn:uuid:${spo2Uuid}`,
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
        subject: { reference: `urn:uuid:${patientUuid}` },
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
    const rrUuid = toDeterministicUuid(`obs-rr-${clinicalCase.id}`);
    entries.push({
      fullUrl: `urn:uuid:${rrUuid}`,
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
        subject: { reference: `urn:uuid:${patientUuid}` },
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

  // 7. AllergyIntolerance
  if (Array.isArray(clinicalCase.allergy_history)) {
    clinicalCase.allergy_history.forEach((allergy, index) => {
      const allergyUuid = toDeterministicUuid(`allergy-${clinicalCase.id}-${index}`);
      entries.push({
        fullUrl: `urn:uuid:${allergyUuid}`,
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
            reference: `urn:uuid:${patientUuid}`,
          },
        } as FhirAllergyIntoleranceResource,
      });
    });
  }

  // 8. MedicationStatement
  if (Array.isArray(clinicalCase.medication_history)) {
    clinicalCase.medication_history.forEach((med, index) => {
      const medUuid = toDeterministicUuid(`med-${clinicalCase.id}-${index}`);
      const dosageText = [
        med.frequency ? med.frequency : null,
        med.duration ? `for ${med.duration}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      entries.push({
        fullUrl: `urn:uuid:${medUuid}`,
        resource: {
          resourceType: "MedicationStatement",
          id: `med-${clinicalCase.id}-${index}`,
          status: "active",
          medicationCodeableConcept: {
            text: `${med.name} ${med.dose || ""}`.trim(),
          },
          subject: {
            reference: `urn:uuid:${patientUuid}`,
          },
          dosage: dosageText ? [{ text: dosageText }] : undefined,
        } as FhirMedicationStatementResource,
      });
    });
  }

  // 9. DocumentReference (for uploaded prescriptions/labs)
  documents.forEach((doc) => {
    const docUuid = toDeterministicUuid(`doc-${doc.id}`);
    entries.push({
      fullUrl: `urn:uuid:${docUuid}`,
      resource: {
        resourceType: "DocumentReference",
        id: `doc-${doc.id}`,
        status: "current",
        type: {
          text: doc.document_type.toUpperCase(),
        },
        subject: {
          reference: `urn:uuid:${patientUuid}`,
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
    identifier: {
      system: "https://medkit.ai/bundle-id",
      value: `bundle-${clinicalCase.id}`,
    },
    meta: {
      profile: [
        "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifact",
        "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle",
      ],
      lastUpdated: timestamp,
      tag: [
        {
          system: "https://medkit.ai/compliance",
          code: "abdm-ready",
          display: ABDM_COMPLIANCE_DISCLAIMER,
        },
      ],
    },
    type: "document",
    timestamp,
    entry: entries,
  };
}
