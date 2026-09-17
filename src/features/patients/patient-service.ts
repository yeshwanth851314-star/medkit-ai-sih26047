import {
  getPatients,
  getPatientsPage as dbGetPatientsPage,
  getPatientById,
  createPatient,
  getAuthorizedSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/db/supabase";
import { Patient } from "@/types/database";
import {
  PatientRegistrationInput,
  DuplicatePatientWarning,
  PatientPageResult,
  DuplicateCandidate,
  DuplicateMatchConfidence,
} from "./types";
import { genderToDb } from "@/lib/utils/gender";
import { env } from "@/config/env";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";
import crypto from "crypto";

export function generatePatientCode(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `MED-2026-${randomDigits}`;
}

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function computeKeyedIdentifierDigest(
  identifierType: string,
  rawValue: string,
  pepper?: string
): string {
  const isProduction = process.env.NODE_ENV === "production" || !env.isDemoMode;
  const secret = pepper || process.env.IDENTIFIER_INDEX_PEPPER;

  if (!secret) {
    if (isProduction) {
      throw new Error("CONFIGURATION_ERROR: IDENTIFIER_INDEX_PEPPER is required in production");
    }
    // Only permitted in non-production development/demo mode; SESSION_SECRET fallback is strictly removed
    return crypto
      .createHmac("sha256", "medkit-default-identifier-index-salt-v1")
      .update(`${identifierType}:${rawValue.trim().toLowerCase()}`)
      .digest("hex");
  }

  const normalized = rawValue.trim().toLowerCase();
  return crypto
    .createHmac("sha256", secret)
    .update(`${identifierType}:${normalized}`)
    .digest("hex");
}

export function maskExternalIdentifier(identifierType: string, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (identifierType === "ABHA_NUMBER" || identifierType === "ABHA_ID") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 4) {
      return `**-****-****-${digits.slice(-4)}`;
    }
  }
  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length);
  }
  return `${"*".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

/**
 * Deterministic duplicate patient candidate detection.
 * Invariant: Weak matches generate candidate warnings for clinical review;
 * WEAK MATCHES NEVER AUTO-MERGE. Auto-merge is strictly NO.
 */
export async function checkDuplicatePatient(
  input: PatientRegistrationInput,
  actorOrToken?: AuthUser | string | null,
  facilityId?: string | null
): Promise<DuplicatePatientWarning> {
  const resolvedFacilityId =
    facilityId ||
    (typeof actorOrToken === "object" && actorOrToken ? actorOrToken.facilityId : null) ||
    null;

  const cleanPhone = normalizePhoneNumber(input.phone);
  const candidates: DuplicateCandidate[] = [];

  if (!env.isDemoMode) {
    const userClient = getAuthorizedSupabaseClient(actorOrToken);
    const client = userClient || getServiceSupabaseClient();

    if (client && resolvedFacilityId) {
      const { data, error } = await client.rpc("rpc_find_duplicate_patient_candidates", {
        p_facility_id: resolvedFacilityId,
        p_phone: cleanPhone || null,
        p_full_name: input.fullName?.trim() || null,
        p_date_of_birth: input.dateOfBirth || null,
        p_abha_id: input.abhaId?.trim() || null,
        p_facility_mrn: input.facilityMrn?.trim() || null,
      });

      if (!error && Array.isArray(data)) {
        for (const r of data) {
          candidates.push({
            patientId: r.candidate_patient_id,
            patientCode: r.candidate_patient_code,
            fullName: r.candidate_full_name,
            dateOfBirth: r.candidate_date_of_birth,
            phone: r.candidate_phone,
            facilityId: r.candidate_facility_id,
            matchType: r.match_type,
            matchConfidence: r.match_confidence as DuplicateMatchConfidence,
          });
        }
      }
    }
  }

  // If no DB candidates found or in demo/test mode, perform local deterministic evaluation
  if (candidates.length === 0) {
    const existingPatients = await getPatients(undefined, actorOrToken);
    const facilityPatients = resolvedFacilityId
      ? existingPatients.filter((p) => p.facility_id === resolvedFacilityId)
      : existingPatients;

    // 1. Facility MRN collision
    if (input.facilityMrn && input.facilityMrn.trim()) {
      const mrnMatch = facilityPatients.find(
        (p) => p.patient_code.toLowerCase().trim() === input.facilityMrn!.toLowerCase().trim()
      );
      if (mrnMatch) {
        candidates.push({
          patientId: mrnMatch.id,
          patientCode: mrnMatch.patient_code,
          fullName: mrnMatch.full_name,
          dateOfBirth: mrnMatch.date_of_birth,
          phone: mrnMatch.phone,
          facilityId: mrnMatch.facility_id,
          matchType: "EXACT_FACILITY_MRN",
          matchConfidence: "IDENTIFIER_CONFLICT",
        });
      }
    }

    // 2. Verified ABHA collision
    if (input.abhaId && input.abhaId.trim()) {
      const abhaMatch = existingPatients.find(
        (p) => p.abha_id && p.abha_id.trim().toLowerCase() === input.abhaId!.trim().toLowerCase()
      );
      if (abhaMatch) {
        if (resolvedFacilityId && abhaMatch.facility_id !== resolvedFacilityId) {
          // Cross-facility match: OPAQUE return to prevent patient privacy oracle
          candidates.push({
            patientId: "",
            patientCode: "",
            fullName: "REDACTED_CROSS_FACILITY",
            dateOfBirth: null,
            phone: null,
            facilityId: "",
            matchType: "EXTERNAL_IDENTIFIER_EXISTS_OUTSIDE_CURRENT_FACILITY",
            matchConfidence: "MANUAL_IDENTITY_REVIEW_REQUIRED",
          });
        } else {
          candidates.push({
            patientId: abhaMatch.id,
            patientCode: abhaMatch.patient_code,
            fullName: abhaMatch.full_name,
            dateOfBirth: abhaMatch.date_of_birth,
            phone: abhaMatch.phone,
            facilityId: abhaMatch.facility_id,
            matchType: "EXACT_ABHA_ID",
            matchConfidence: "STRONG_MATCH",
          });
        }
      }
    }

    // 3. Phone match within facility
    if (cleanPhone) {
      const phoneMatch = facilityPatients.find((p) => {
        if (!p.phone) return false;
        const pClean = normalizePhoneNumber(p.phone);
        const pSuffix = pClean.slice(-10);
        const cSuffix = cleanPhone.slice(-10);
        return (
          pClean === cleanPhone ||
          (pSuffix.length === 10 && cSuffix.length === 10 && pSuffix === cSuffix)
        );
      });
      if (phoneMatch && !candidates.some((c) => c.patientId === phoneMatch.id)) {
        candidates.push({
          patientId: phoneMatch.id,
          patientCode: phoneMatch.patient_code,
          fullName: phoneMatch.full_name,
          dateOfBirth: phoneMatch.date_of_birth,
          phone: phoneMatch.phone,
          facilityId: phoneMatch.facility_id,
          matchType: "PHONE_MATCH",
          matchConfidence: "POSSIBLE_MATCH",
        });
      }
    }

    // 4. Exact name and DOB match within facility
    if (input.dateOfBirth && input.fullName) {
      const cleanName = input.fullName.toLowerCase().replace(/\s+/g, " ").trim();
      const nameDobMatch = facilityPatients.find(
        (p) =>
          p.full_name &&
          p.full_name.toLowerCase().replace(/\s+/g, " ").trim() === cleanName &&
          p.date_of_birth === input.dateOfBirth
      );
      if (nameDobMatch && !candidates.some((c) => c.patientId === nameDobMatch.id)) {
        candidates.push({
          patientId: nameDobMatch.id,
          patientCode: nameDobMatch.patient_code,
          fullName: nameDobMatch.full_name,
          dateOfBirth: nameDobMatch.date_of_birth,
          phone: nameDobMatch.phone,
          facilityId: nameDobMatch.facility_id,
          matchType: "NAME_AND_DOB_MATCH",
          matchConfidence: "POSSIBLE_MATCH",
        });
      }
    }
  }

  if (candidates.length > 0) {
    const primary = candidates[0];
    let legacyReason: string = primary.matchType.toLowerCase();
    if (primary.matchType === "PHONE_MATCH") legacyReason = "matching_phone";
    if (primary.matchType === "NAME_AND_DOB_MATCH") legacyReason = "matching_name_and_dob";
    if (primary.matchType === "EXACT_FACILITY_MRN") legacyReason = "matching_mrn";
    if (primary.matchType === "EXACT_ABHA_ID") legacyReason = "matching_abha";
    if (primary.matchType === "EXTERNAL_IDENTIFIER_EXISTS_OUTSIDE_CURRENT_FACILITY") {
      legacyReason = "external_identifier_exists_outside_current_facility";
      return {
        isDuplicateSuspect: true,
        matchConfidence: "MANUAL_IDENTITY_REVIEW_REQUIRED",
        matchedPatientId: undefined,
        matchedPatientCode: undefined,
        matchedName: "REDACTED_CROSS_FACILITY",
        reason: legacyReason,
        candidates,
      };
    }

    return {
      isDuplicateSuspect: true,
      matchConfidence: primary.matchConfidence,
      matchedPatientId: primary.patientId,
      matchedPatientCode: primary.patientCode,
      matchedName: primary.fullName,
      reason: legacyReason,
      candidates,
    };
  }

  return { isDuplicateSuspect: false, matchConfidence: "NO_MATCH" };
}

export async function searchPatients(
  query?: string,
  actorOrToken?: AuthUser | string | null
): Promise<Patient[]> {
  return getPatients(query, actorOrToken);
}

export async function getPatientsPage(
  params: {
    searchQuery?: string;
    page?: number;
    pageSize?: number;
  },
  actorOrToken?: AuthUser | string | null
): Promise<PatientPageResult> {
  return dbGetPatientsPage(params, actorOrToken);
}

export async function getPatientDetails(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<Patient | null> {
  return getPatientById(id, actorOrToken);
}

export async function registerPatient(
  input: PatientRegistrationInput,
  options?: {
    ignoreDuplicateWarning?: boolean;
    facilityId?: string | null;
    actor?: AuthUser | null;
  }
): Promise<{ patient: Patient; duplicateWarning?: DuplicatePatientWarning }> {
  // Enforce server-controlled facility boundary
  let resolvedFacilityId: string | null = null;
  if (options?.actor && options.actor.role !== "admin") {
    resolvedFacilityId = options.actor.facilityId || null;
  } else {
    resolvedFacilityId = options?.facilityId || options?.actor?.facilityId || null;
  }

  if (!resolvedFacilityId && !env.isDemoMode) {
    throw new Error("FACILITY_REQUIRED: Clinician must be assigned to an active facility to register a patient");
  }

  const facilityIdToUse = resolvedFacilityId || "fac-delhi-01";

  // Enforce V1 identifier type narrowing: Reject Passport and Driver's License
  if (
    (input.abhaId && (input.abhaId.toUpperCase().includes("PASSPORT") || input.abhaId.toUpperCase().includes("DRIVER"))) ||
    (input.facilityMrn && (input.facilityMrn.toUpperCase().includes("PASSPORT") || input.facilityMrn.toUpperCase().includes("DRIVER")))
  ) {
    throw new Error("UNSUPPORTED_IDENTIFIER_TYPE: Passport and Driver's License are not supported in MedKit V1");
  }

  // Check for duplicate suspicion
  const duplicateWarning = await checkDuplicatePatient(input, options?.actor, facilityIdToUse);

  // Hard conflict prevention: exact facility MRN collision can never be ignored
  if (duplicateWarning.matchConfidence === "IDENTIFIER_CONFLICT") {
    throw new Error(
      `IDENTIFIER_CONFLICT: A patient with code '${duplicateWarning.matchedPatientCode}' already exists in this facility. Cannot create duplicate record.`
    );
  }

  if (duplicateWarning.isDuplicateSuspect && !options?.ignoreDuplicateWarning) {
    // Return early with warning so caller can prompt or review candidates
    return {
      patient: null as any,
      duplicateWarning,
    };
  }

  const patientCode = input.facilityMrn?.trim() || generatePatientCode();
  const identityStatus = input.identityStatus || (input.abhaId ? "ABHA_LINKED" : "UNVERIFIED");

  const newPatient = await createPatient(
    {
      patient_code: patientCode,
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth || null,
      age_estimate: input.ageEstimate || null,
      gender: genderToDb(input.gender),
      phone: input.phone || null,
      address: input.address || null,
      blood_group: input.bloodGroup === "Unknown" ? null : input.bloodGroup,
      emergency_contact: input.emergencyContact || null,
      facility_id: facilityIdToUse,
      abha_id: input.abhaId || null,
      identity_status: identityStatus,
    },
    options?.actor
  );

  // If ABHA or external MRN is provided and in non-demo mode, register external identifier with keyed digest and masked display value
  if (!env.isDemoMode && input.abhaId && input.abhaId.trim()) {
    try {
      const userClient = getAuthorizedSupabaseClient(options?.actor);
      const client = userClient || getServiceSupabaseClient();
      if (client) {
        const abhaKeyedHash = computeKeyedIdentifierDigest("ABHA_NUMBER", input.abhaId);
        const maskedAbha = maskExternalIdentifier("ABHA_NUMBER", input.abhaId);
        await client.from("patient_external_identifiers").insert([
          {
            patient_id: newPatient.id,
            facility_id: facilityIdToUse,
            identifier_type: "ABHA_NUMBER",
            identifier_value_encrypted_or_protected: maskedAbha,
            identifier_hash: abhaKeyedHash,
            issuing_authority: "ABDM/NDHM",
            verification_status: "UNVERIFIED",
            metadata: { source: "registration" },
          },
        ]);
      }
    } catch (extErr) {
      console.warn("External identifier linking deferred:", extErr);
    }
  }

  // Audit trail
  try {
    await logAuditEvent({
      actorId: options?.actor?.id || "system",
      actorRole: options?.actor?.role || "clinician",
      action: "CREATE_PATIENT",
      resourceType: "patients",
      resourceId: newPatient.id,
      metadata: {
        patientCode: newPatient.patient_code,
        facilityId: facilityIdToUse,
        hasAbha: Boolean(input.abhaId),
        identityStatus,
      },
      actorOrToken: options?.actor,
    });
  } catch (auditErr) {
    console.warn("Audit logging for patient registration non-blocking warning:", auditErr);
  }

  return {
    patient: newPatient,
    duplicateWarning: duplicateWarning.isDuplicateSuspect ? duplicateWarning : undefined,
  };
}
