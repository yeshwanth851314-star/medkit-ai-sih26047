/**
 * MedKit AI — ABDM / ABHA Interoperability & Integration Types
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 * Standards Reference: Ayushman Bharat Digital Mission (ABDM) Gateway APIs v0.5 / M1-M2-M3
 */

import { FhirR4Bundle } from "../interoperability/types";

/**
 * ABHA (Ayushman Bharat Health Account) Identity Types
 */
export interface AbhaProfile {
  abhaNumber?: string; // 14-digit formatted "XX-XXXX-XXXX-XXXX"
  abhaAddress?: string; // e.g. "username@abdm" or "username@sbx"
  fullName?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  mobile?: string;
  isVerified: boolean;
}

export interface AbhaValidationResult {
  valid: boolean;
  type: "abha_number" | "abha_address" | "invalid";
  normalizedValue?: string;
  error?: string;
}

/**
 * ABDM Consent Flow Types (Consent Manager / Gateway M2 Milestone)
 */
export type AbdmConsentStatus = "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED";

export interface AbdmConsentPurpose {
  code: string; // e.g., "CAREMGT" (Care Management), "BTG" (Break the Glass)
  text: string;
}

export interface AbdmConsentPermission {
  accessMode: "VIEW" | "STORE" | "QUERY" | "STREAM";
  dateRange: {
    from: string;
    to: string;
  };
  dataEraseAt: string;
  frequency: {
    unit: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
    value: number;
    repeats: number;
  };
}

export interface AbdmConsentArtifact {
  consentId: string;
  status: AbdmConsentStatus;
  createdAt: string;
  purpose: AbdmConsentPurpose;
  patient: {
    id: string; // ABHA address
  };
  hip?: {
    id: string; // Health Information Provider facility ID
    name: string;
  };
  hiu?: {
    id: string; // Health Information User facility ID
    name: string;
  };
  permission: AbdmConsentPermission;
}

/**
 * ABDM Health Record Transfer Types (M3 Milestone)
 */
export interface HealthRecordPushRequest {
  careContextReference: string;
  patientReference: string;
  consentId: string;
  fhirBundle: FhirR4Bundle;
  matchedHipId: string;
}

export interface HealthRecordPushResponse {
  transactionId: string;
  status: "QUEUED" | "DELIVERED" | "FAILED";
  deliveredAt?: string;
  error?: string;
}

/**
 * Gateway Session & Authentication Models
 */
export interface AbdmSessionToken {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AbdmGatewayError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export const ABDM_DISCLAIMER =
  "ABDM integration-ready architecture. Production or live sandbox exchange requires authorized NHA credentials.";
