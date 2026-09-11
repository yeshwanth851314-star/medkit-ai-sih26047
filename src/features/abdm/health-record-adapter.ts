import { ClinicalCase, Patient, MedicalDocument } from "../../types/database";
import { ConsentRecord } from "../consent/types";
import { mapCaseToFhirBundle } from "../interoperability/fhir-mapper";
import { isHealthRecordExchangePermitted } from "./consent-adapter";
import { HealthRecordPushRequest, AbdmConsentArtifact } from "./types";
import { getAbdmConfig } from "./config";
import { normalizeAbdmPatientIdentity } from "./abha-service";

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
 * 3. ABDM consent artifact is strictly bound to the exported patient and HIU destination.
 * 4. Patient must possess a valid ABDM-linked identity (no patient_code fallback).
 * 5. Reuses Phase 3 validated NRCeS DocumentBundle.
 */

export interface PrepareHealthRecordParams {
  clinicalCase: ClinicalCase;
  patient: Patient;
  documents?: MedicalDocument[];
  consent: ConsentRecord;
  abdmConsentArtifact?: AbdmConsentArtifact;
  targetHipId?: string;
  targetHiuId?: string;
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
    targetHiuId,
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

  // Invariant 3: Clinical case must belong to the patient being exported
  if (clinicalCase.patient_id !== patient.id) {
    throw new Error(
      `ABDM_CONSENT_VIOLATION: Clinical case ${clinicalCase.id} patient '${clinicalCase.patient_id}' does not match requested patient '${patient.id}'.`
    );
  }

  // Invariant 4: Patient must have linked ABHA identifier for ABDM exchange (no patient_code fallback)
  const rawAbha = patient.abha_id?.trim();
  if (!rawAbha) {
    throw new Error(
      "ABDM_CONSENT_VIOLATION: Patient has no linked ABHA identifier. ABDM health-information exchange requires an ABDM-linked patient identity."
    );
  }

  const patientIdentity = normalizeAbdmPatientIdentity(rawAbha);
  if (!patientIdentity) {
    throw new Error(
      `ABDM_CONSENT_VIOLATION: Patient ABHA identifier '${patient.abha_id}' is invalid. ABDM health-information exchange requires a valid ABHA identity.`
    );
  }

  const consentCheck = isHealthRecordExchangePermitted(consent, abdmConsentArtifact, {
    clinicalCase,
    patient,
    targetHipId,
    targetHiuId,
    requestedHiType,
    requestedPurpose,
  });
  if (!consentCheck.permitted) {
    throw new Error(`ABDM_CONSENT_VIOLATION: ${consentCheck.reason}`);
  }

  // Invariant 5: Re-use Phase 3 NRCeS validated FHIR bundle
  const fhirBundle = mapCaseToFhirBundle({
    clinicalCase,
    patient,
    documents,
  });

  const config = getAbdmConfig();
  const patientReference = patientIdentity.value;
  const careContextReference = `visit-${clinicalCase.id}`;
  const consentId = abdmConsentArtifact.consentId;
  const matchedHipId = targetHipId || abdmConsentArtifact.hip?.id || config.hipId || "";
  const matchedHiuId = targetHiuId || abdmConsentArtifact.hiu?.id;

  return {
    careContextReference,
    patientReference,
    consentId,
    fhirBundle,
    matchedHipId,
    ...(matchedHiuId ? { matchedHiuId } : {}),
  };
}
