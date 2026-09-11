import { ConsentRecord } from "../consent/types";
import { AbdmConsentArtifact } from "./types";
import { ClinicalCase, Patient } from "../../types/database";
import { normalizeAbdmPatientIdentity } from "./abha-service";

/**
 * MedKit AI — ABDM Consent Adapter (M2 Milestone Readiness)
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Architectural Boundary:
 * - Local MedKit Consent: Authorizes clinician case-taking and local medical documentation.
 * - ABDM Consent Artifact: Authorizes cross-enterprise longitudinal record sharing across ABDM ecosystem.
 * - Under no circumstances does ABDM consent override or bypass local clinic clinical consent.
 * - Under no circumstances does local clinical consent substitute for a mandatory ABDM Consent Artifact.
 * - ABDM Consent Artifact is strictly bound to the specific patient identity, HIP, and HIU destination.
 */

export function isLocalClinicalConsentActive(localConsent: ConsentRecord): boolean {
  if (!localConsent || typeof localConsent !== "object") {
    return false;
  }
  if (localConsent.revoked || localConsent.revoked_at) {
    return false;
  }
  return localConsent.status === "granted";
}

export interface AbdmExchangeValidationParams {
  abdmConsentArtifact?: AbdmConsentArtifact;
  clinicalCase?: ClinicalCase;
  patient?: Patient;
  targetHipId?: string;
  targetHiuId?: string;
  requestedHiType?: string;
  requestedPurpose?: string;
}

export function isAbdmExchangeConsentValid(
  params: AbdmExchangeValidationParams
): { valid: boolean; reason?: string } {
  const {
    abdmConsentArtifact,
    clinicalCase,
    patient,
    targetHipId,
    targetHiuId,
    requestedHiType = "OPConsultation",
    requestedPurpose,
  } = params;

  // Step 1: ABDM artifact is mandatory for cross-enterprise exchange
  if (!abdmConsentArtifact) {
    return {
      valid: false,
      reason: "ABDM consent artifact is required for health-information exchange.",
    };
  }

  // Step 2: Status must be GRANTED
  if (abdmConsentArtifact.status !== "GRANTED") {
    return {
      valid: false,
      reason: `ABDM Consent Artifact status is '${abdmConsentArtifact.status}'. Only 'GRANTED' status permits health-information exchange.`,
    };
  }

  // Step 3: Validate expiry (dataEraseAt and permission validity)
  const now = Date.now();
  if (abdmConsentArtifact.permission?.dataEraseAt) {
    const eraseAt = new Date(abdmConsentArtifact.permission.dataEraseAt).getTime();
    if (!isNaN(eraseAt) && eraseAt <= now) {
      return {
        valid: false,
        reason: "ABDM Consent Artifact has expired (dataEraseAt has lapsed). Exchange denied.",
      };
    }
  }

  // Step 4: Validate Case ↔ Patient Binding
  if (clinicalCase && patient && clinicalCase.patient_id !== patient.id) {
    return {
      valid: false,
      reason: `Clinical case patient '${clinicalCase.patient_id}' does not match requested patient '${patient.id}'.`,
    };
  }

  // Step 5: Validate Patient ABDM Identity and Consent Artifact Patient Binding
  if (patient) {
    const rawAbha = patient.abha_id?.trim();
    if (!rawAbha) {
      return {
        valid: false,
        reason: "Patient has no linked ABHA identifier. ABDM health-information exchange requires an ABDM-linked patient identity.",
      };
    }

    const patientIdentity = normalizeAbdmPatientIdentity(rawAbha);
    if (!patientIdentity) {
      return {
        valid: false,
        reason: `Patient ABHA identifier '${patient.abha_id}' is invalid. ABDM health-information exchange requires a valid ABHA identity.`,
      };
    }

    const artifactPatientId = abdmConsentArtifact.patient?.id?.trim();
    if (!artifactPatientId) {
      return {
        valid: false,
        reason: "ABDM consent artifact is missing patient identifier.",
      };
    }

    const artifactIdentity = normalizeAbdmPatientIdentity(artifactPatientId);
    if (!artifactIdentity) {
      return {
        valid: false,
        reason: `ABDM consent artifact contains invalid patient identifier '${artifactPatientId}'.`,
      };
    }

    if (
      patientIdentity.type !== artifactIdentity.type ||
      patientIdentity.value !== artifactIdentity.value
    ) {
      return {
        valid: false,
        reason: `ABDM consent artifact patient (${artifactIdentity.value}) does not match requested patient (${patientIdentity.value}).`,
      };
    }
  }

  // Step 6: Validate Purpose
  if (requestedPurpose && abdmConsentArtifact.purpose?.code) {
    if (abdmConsentArtifact.purpose.code !== requestedPurpose) {
      return {
        valid: false,
        reason: `Requested purpose '${requestedPurpose}' is not permitted by ABDM consent artifact purpose '${abdmConsentArtifact.purpose.code}'.`,
      };
    }
  }

  // Step 7: Validate Date Range against Clinical Case
  if (clinicalCase && abdmConsentArtifact.permission?.dateRange) {
    const { from, to } = abdmConsentArtifact.permission.dateRange;
    const caseDateStr = clinicalCase.finalized_at || clinicalCase.created_at;
    const caseTimestamp = new Date(caseDateStr).getTime();

    if (!isNaN(caseTimestamp)) {
      if (from) {
        const fromTimestamp = new Date(from).getTime();
        if (!isNaN(fromTimestamp) && caseTimestamp < fromTimestamp) {
          return {
            valid: false,
            reason: `Clinical case timestamp (${caseDateStr}) falls before permitted ABDM consent dateRange.from (${from}).`,
          };
        }
      }
      if (to) {
        const toTimestamp = new Date(to).getTime();
        if (!isNaN(toTimestamp) && caseTimestamp > toTimestamp) {
          return {
            valid: false,
            reason: `Clinical case timestamp (${caseDateStr}) falls after permitted ABDM consent dateRange.to (${to}).`,
          };
        }
      }
    }
  }

  // Step 8: Validate Health Information Type
  const permittedHiTypes =
    abdmConsentArtifact.permission?.hiTypes || abdmConsentArtifact.hiTypes;
  if (Array.isArray(permittedHiTypes) && permittedHiTypes.length > 0) {
    if (!permittedHiTypes.includes(requestedHiType)) {
      return {
        valid: false,
        reason: `Requested HI type '${requestedHiType}' is not permitted by ABDM consent artifact (permitted: ${permittedHiTypes.join(", ")}).`,
      };
    }
  }

  // Step 9: Validate HIP Binding
  if (targetHipId && abdmConsentArtifact.hip?.id) {
    if (targetHipId.trim() !== abdmConsentArtifact.hip.id.trim()) {
      return {
        valid: false,
        reason: `Target HIP ID '${targetHipId.trim()}' does not match ABDM consent artifact HIP binding '${abdmConsentArtifact.hip.id.trim()}'.`,
      };
    }
  }

  // Step 10: Validate HIU Destination Binding
  if (abdmConsentArtifact.hiu?.id) {
    const artifactHiuId = abdmConsentArtifact.hiu.id.trim();
    if (artifactHiuId) {
      if (!targetHiuId || !targetHiuId.trim()) {
        return {
          valid: false,
          reason: `Target HIU ID is required when ABDM consent artifact specifies an HIU binding ('${artifactHiuId}').`,
        };
      }
      if (targetHiuId.trim() !== artifactHiuId) {
        return {
          valid: false,
          reason: `Target HIU ID '${targetHiuId.trim()}' does not match ABDM consent artifact HIU binding '${artifactHiuId}'.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates whether an outgoing ABDM health record exchange is permitted under both
 * local clinical consent AND valid ABDM Consent Artifact authorization.
 */
export function isHealthRecordExchangePermitted(
  localConsent: ConsentRecord,
  abdmConsentArtifact?: AbdmConsentArtifact,
  options?: {
    clinicalCase?: ClinicalCase;
    patient?: Patient;
    targetHipId?: string;
    targetHiuId?: string;
    requestedHiType?: string;
    requestedPurpose?: string;
  }
): { permitted: boolean; reason?: string } {
  if (!isLocalClinicalConsentActive(localConsent)) {
    return {
      permitted: false,
      reason: "Local clinical consent is inactive or revoked. Health record sharing is strictly prohibited.",
    };
  }

  if (options?.patient && localConsent.patient_id && localConsent.patient_id !== options.patient.id) {
    return {
      permitted: false,
      reason: `Local clinical consent belongs to patient '${localConsent.patient_id}', which does not match requested patient '${options.patient.id}'.`,
    };
  }

  const abdmCheck = isAbdmExchangeConsentValid({
    abdmConsentArtifact,
    clinicalCase: options?.clinicalCase,
    patient: options?.patient,
    targetHipId: options?.targetHipId,
    targetHiuId: options?.targetHiuId,
    requestedHiType: options?.requestedHiType,
    requestedPurpose: options?.requestedPurpose,
  });

  if (!abdmCheck.valid) {
    return {
      permitted: false,
      reason: abdmCheck.reason,
    };
  }

  return { permitted: true };
}
