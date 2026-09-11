import { AbhaValidationResult, AbhaProfile } from "./types";
import { Patient } from "../../types/database";

/**
 * MedKit AI — ABHA Identity Service (M1 Milestone Readiness)
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Principles:
 * 1. ABHA is strictly OPTIONAL. MedKit never denies clinical care if a patient has no ABHA.
 * 2. Never fabricate ABHA IDs or verification statuses.
 */

// Format: XX-XXXX-XXXX-XXXX (14 digits)
const ABHA_NUMBER_HYPHEN_REGEX = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
const ABHA_NUMBER_PLAIN_REGEX = /^\d{14}$/;

// Format: username@abdm or username@sbx (alphanumeric, dot, underscore; 3-32 chars)
const ABHA_ADDRESS_REGEX = /^[a-zA-Z0-9._]{3,32}@(abdm|sbx)$/;

export function validateAbhaIdentifier(input: string): AbhaValidationResult {
  if (!input || typeof input !== "string") {
    return { valid: false, type: "invalid", error: "ABHA identifier must be a non-empty string" };
  }

  const trimmed = input.trim();

  // Check 14-digit hyphenated format
  if (ABHA_NUMBER_HYPHEN_REGEX.test(trimmed)) {
    return {
      valid: true,
      type: "abha_number",
      normalizedValue: trimmed,
    };
  }

  // Check 14-digit plain numeric format -> normalize to hyphenated
  if (ABHA_NUMBER_PLAIN_REGEX.test(trimmed)) {
    const formatted = `${trimmed.slice(0, 2)}-${trimmed.slice(2, 6)}-${trimmed.slice(6, 10)}-${trimmed.slice(10, 14)}`;
    return {
      valid: true,
      type: "abha_number",
      normalizedValue: formatted,
    };
  }

  // Check ABHA address format
  if (ABHA_ADDRESS_REGEX.test(trimmed.toLowerCase())) {
    return {
      valid: true,
      type: "abha_address",
      normalizedValue: trimmed.toLowerCase(),
    };
  }

  return {
    valid: false,
    type: "invalid",
    error: "Invalid ABHA format. Expected 14-digit number (XX-XXXX-XXXX-XXXX) or address (name@abdm).",
  };
}

/**
 * Checks if a MedKit patient record contains a valid ABHA identifier
 */
export function hasLinkedAbha(patient: Patient): boolean {
  if (!patient.abha_id) return false;
  return validateAbhaIdentifier(patient.abha_id).valid;
}

/**
 * Extracts normalized ABHA identifier for FHIR Patient resource representation
 */
export function getPatientAbhaIdentifier(patient: Patient): { system: string; value: string } | null {
  if (!patient.abha_id) return null;
  const validation = validateAbhaIdentifier(patient.abha_id);
  if (!validation.valid || !validation.normalizedValue) return null;

  return {
    system:
      validation.type === "abha_number"
        ? "https://healthid.ndhm.gov.in"
        : "https://phr.ndhm.gov.in",
    value: validation.normalizedValue,
  };
}
