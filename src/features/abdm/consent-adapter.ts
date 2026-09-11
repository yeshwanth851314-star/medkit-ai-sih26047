import { ConsentRecord } from "../consent/types";
import { AbdmConsentArtifact, AbdmConsentStatus } from "./types";

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
 */

export function mapLocalConsentToAbdmStatus(localConsent: ConsentRecord): AbdmConsentStatus {
  if (localConsent.revoked || localConsent.revoked_at) {
    return "REVOKED";
  }

  if (localConsent.status === "granted") {
    return "GRANTED";
  }

  return "DENIED";
}

/**
 * Validates whether an outgoing ABDM health record exchange is permitted under current consent.
 */
export function isHealthRecordExchangePermitted(
  localConsent: ConsentRecord,
  abdmConsentArtifact?: AbdmConsentArtifact
): { permitted: boolean; reason?: string } {
  const localStatus = mapLocalConsentToAbdmStatus(localConsent);
  if (localStatus !== "GRANTED") {
    return {
      permitted: false,
      reason: `Local clinical consent is ${localStatus}. Health record sharing is strictly prohibited.`,
    };
  }

  if (abdmConsentArtifact) {
    if (abdmConsentArtifact.status !== "GRANTED") {
      return {
        permitted: false,
        reason: `ABDM Consent Artifact status is ${abdmConsentArtifact.status}. Sharing denied.`,
      };
    }

    const eraseAt = new Date(abdmConsentArtifact.permission.dataEraseAt).getTime();
    if (!isNaN(eraseAt) && eraseAt < Date.now()) {
      return {
        permitted: false,
        reason: "ABDM Consent Artifact dataEraseAt timestamp has lapsed. Sharing denied.",
      };
    }
  }

  return { permitted: true };
}
