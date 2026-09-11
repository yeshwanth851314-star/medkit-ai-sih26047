import { ClinicalCase, Patient, MedicalDocument } from "../../types/database";
import { ConsentRecord } from "../consent/types";
import { mapCaseToFhirBundle } from "../interoperability/fhir-mapper";
import { isHealthRecordExchangePermitted } from "./consent-adapter";
import { HealthRecordPushRequest, HealthRecordPushResponse, AbdmConsentArtifact } from "./types";
import { getAbdmConfig } from "./config";

/**
 * MedKit AI — ABDM Health Record Adapter (M3 Milestone Readiness)
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Bridges finalized MedKit clinical consultation records to ABDM HIP data exchange payloads.
 * Strictly enforces:
 * 1. Only finalized cases can be packaged for external exchange. Drafts are rejected.
 * 2. Active patient consent is mandatory prior to payload generation.
 * 3. Reuses Phase 3 validated NRCeS DocumentBundle.
 */

export interface PrepareHealthRecordParams {
  clinicalCase: ClinicalCase;
  patient: Patient;
  documents?: MedicalDocument[];
  consent: ConsentRecord;
  abdmConsentArtifact?: AbdmConsentArtifact;
  targetHipId?: string;
  requestedHiType?: string;
  requestedPurpose?: string;
}

export function prepareAbdmHealthRecordPayload(
  params: PrepareHealthRecordParams
): HealthRecordPushRequest {
  const {
    clinicalCase,
    patient,
    documents = [],
    consent,
    abdmConsentArtifact,
    targetHipId,
    requestedHiType,
    requestedPurpose,
  } = params;

  // Invariant 1: Only finalized records can be packaged for ABDM
  if (clinicalCase.status !== "final") {
    throw new Error(
      `CANNOT_EXCHANGE_DRAFT: Clinical case ${clinicalCase.id} is in status '${clinicalCase.status}'. Only finalized cases can be shared with ABDM.`
    );
  }

  // Invariant 2: ABDM exchange consent requires active local consent AND valid ABDM artifact
  if (!abdmConsentArtifact) {
    throw new Error(
      "ABDM_CONSENT_VIOLATION: ABDM consent artifact is required for health-information exchange."
    );
  }

  const consentCheck = isHealthRecordExchangePermitted(consent, abdmConsentArtifact, {
    clinicalCase,
    targetHipId,
    requestedHiType,
    requestedPurpose,
  });
  if (!consentCheck.permitted) {
    throw new Error(`ABDM_CONSENT_VIOLATION: ${consentCheck.reason}`);
  }

  // Invariant 3: Re-use Phase 3 NRCeS validated FHIR bundle
  const fhirBundle = mapCaseToFhirBundle({
    clinicalCase,
    patient,
    documents,
  });

  const config = getAbdmConfig();
  const patientReference = patient.abha_id || patient.patient_code;
  const careContextReference = `visit-${clinicalCase.id}`;
  const consentId = abdmConsentArtifact.consentId;
  const matchedHipId = targetHipId || abdmConsentArtifact.hip?.id || config.hipId || "";

  return {
    careContextReference,
    patientReference,
    consentId,
    fhirBundle,
    matchedHipId,
  };
}
