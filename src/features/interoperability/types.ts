export interface FhirIdentifier {
  system?: string;
  value: string;
}

export interface FhirCodeableConcept {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  text: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FhirPatientResource {
  resourceType: "Patient";
  id: string;
  identifier: FhirIdentifier[];
  name: Array<{
    use?: string;
    text: string;
    family?: string;
    given?: string[];
  }>;
  gender: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  telecom?: Array<{
    system: "phone" | "email";
    value: string;
  }>;
}

export interface FhirEncounterResource {
  resourceType: "Encounter";
  id: string;
  status: "planned" | "arrived" | "triaged" | "in-progress" | "onleave" | "finished" | "cancelled";
  class: {
    system: string;
    code: string;
    display: string;
  };
  subject: FhirReference;
  period: {
    start: string;
    end?: string;
  };
}

export interface FhirConditionResource {
  resourceType: "Condition";
  id: string;
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved";
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error";
    }>;
  };
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  recordedDate?: string;
}

export interface FhirObservationResource {
  resourceType: "Observation";
  id: string;
  status: "registered" | "preliminary" | "final" | "amended";
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  valueString?: string;
}

export interface FhirAllergyIntoleranceResource {
  resourceType: "AllergyIntolerance";
  id: string;
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: "active" | "inactive" | "resolved";
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: "unconfirmed" | "confirmed" | "refuted";
    }>;
  };
  criticality?: "low" | "high" | "unable-to-assess";
  code: FhirCodeableConcept;
  patient: FhirReference;
}

export interface FhirMedicationStatementResource {
  resourceType: "MedicationStatement";
  id: string;
  status: "active" | "completed" | "entered-in-error" | "intended" | "stopped" | "on-hold";
  medicationCodeableConcept: FhirCodeableConcept;
  subject: FhirReference;
  dosage?: Array<{
    text?: string;
  }>;
}

export interface FhirCompositionSection {
  title: string;
  code?: FhirCodeableConcept;
  text?: {
    status: "generated" | "extensions" | "additional" | "empty";
    div: string;
  };
  entry?: FhirReference[];
}

export interface FhirCompositionResource {
  resourceType: "Composition";
  id: string;
  status: "preliminary" | "final" | "amended" | "entered-in-error";
  type: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  date: string;
  author: FhirReference[];
  title: string;
  section?: FhirCompositionSection[];
}

export interface FhirBundleEntry {
  fullUrl: string;
  resource:
    | FhirCompositionResource
    | FhirPatientResource
    | FhirEncounterResource
    | FhirConditionResource
    | FhirObservationResource
    | FhirAllergyIntoleranceResource
    | FhirMedicationStatementResource
    | Record<string, any>;
}

export interface FhirR4Bundle {
  resourceType: "Bundle";
  id: string;
  meta: {
    profile: string[];
    lastUpdated: string;
  };
  identifier?: FhirIdentifier;
  type: "document" | "collection" | "transaction";
  timestamp: string;
  entry: FhirBundleEntry[];
  abdmComplianceNotice: string;
}
