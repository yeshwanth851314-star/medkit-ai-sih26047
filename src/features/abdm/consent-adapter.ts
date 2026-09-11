import { ConsentRecord } from "../consent/types";
import { AbdmConsentArtifact } from "./types";
import { ClinicalCase } from "../../types/database";

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
  targetHipId?: string;
  requestedHiType?: string;
  requestedPurpose?: string;
}

export function isAbdmExchangeConsentValid(
  params: AbdmExchangeValidationParams
): { valid: boolean; reason?: string } {
  const {
    abdmConsentArtifact,
    clinicalCase,
    targetHipId,
    requestedHiType = "OPConsultation",
    requestedPurpose,
  } = params;

  // Step 2: ABDM artifact is mandatory for cross-enterprise exchange
  if (!abdmConsentArtifact) {
    return {
      valid: false,
      reason: "ABDM consent artifact is required for health-information exchange.",
    };
  }

  // Step 3: Status must be GRANTED
  if (abdmConsentArtifact.status !== "GRANTED") {
    return {
      valid: false,
      reason: `ABDM Consent Artifact status is '${abdmConsentArtifact.status}'. Only 'GRANTED' status permits health-information exchange.`,
    };
  }

  // Step 4: Validate expiry (dataEraseAt and permission validity)
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

  // Step 5: Validate Purpose
  if (requestedPurpose && abdmConsentArtifact.purpose?.code) {
    if (abdmConsentArtifact.purpose.code !== requestedPurpose) {
      return {
        valid: false,
        reason: `Requested purpose '${requestedPurpose}' is not permitted by ABDM consent artifact purpose '${abdmConsentArtifact.purpose.code}'.`,
      };
    }
  }

  // Step 6: Validate Date Range against Clinical Case
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

  // Step 7: Validate Health Information Type
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

  // Step 8: Validate HIP Binding
  if (targetHipId && abdmConsentArtifact.hip?.id) {
    if (targetHipId !== abdmConsentArtifact.hip.id) {
      return {
        valid: false,
        reason: `Target HIP ID '${targetHipId}' does not match ABDM consent artifact HIP binding '${abdmConsentArtifact.hip.id}'.`,
      };
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
    targetHipId?: string;
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

  const abdmCheck = isAbdmExchangeConsentValid({
    abdmConsentArtifact,
    clinicalCase: options?.clinicalCase,
    targetHipId: options?.targetHipId,
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
