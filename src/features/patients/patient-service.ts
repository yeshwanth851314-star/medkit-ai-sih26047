import { getPatients, getPatientsPage as dbGetPatientsPage, getPatientById, createPatient } from "@/lib/db/supabase";
import { Patient } from "@/types/database";
import { PatientRegistrationInput, DuplicatePatientWarning, PatientPageResult } from "./types";
import { genderToDb } from "@/lib/utils/gender";

export function generatePatientCode(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `MED-2026-${randomDigits}`;
}

export async function checkDuplicatePatient(
  input: PatientRegistrationInput,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<DuplicatePatientWarning> {
  const existingPatients = await getPatients(undefined, actorOrToken);

  // Rule 1: Check phone match if phone provided
  if (input.phone && input.phone.trim()) {
    const cleanPhone = input.phone.replace(/[\s\-\+]/g, "");
    const match = existingPatients.find((p) => {
      if (!p.phone) return false;
      const pClean = p.phone.replace(/[\s\-\+]/g, "");
      return pClean.includes(cleanPhone) || cleanPhone.includes(pClean);
    });

    if (match) {
      return {
        isDuplicateSuspect: true,
        matchedPatientId: match.id,
        matchedPatientCode: match.patient_code,
        matchedName: match.full_name,
        reason: "matching_phone",
      };
    }
  }

  // Rule 2: Check matching name and DOB
  if (input.dateOfBirth) {
    const match = existingPatients.find(
      (p) =>
        p.full_name.toLowerCase().trim() === input.fullName.toLowerCase().trim() &&
        p.date_of_birth === input.dateOfBirth
    );

    if (match) {
      return {
        isDuplicateSuspect: true,
        matchedPatientId: match.id,
        matchedPatientCode: match.patient_code,
        matchedName: match.full_name,
        reason: "matching_name_and_dob",
      };
    }
  }

  return { isDuplicateSuspect: false };
}

export async function searchPatients(
  query?: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<Patient[]> {
  return getPatients(query, actorOrToken);
}

export async function getPatientsPage(
  params: {
    searchQuery?: string;
    page?: number;
    pageSize?: number;
  },
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<PatientPageResult> {
  return dbGetPatientsPage(params, actorOrToken);
}

export async function getPatientDetails(
  id: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<Patient | null> {
  return getPatientById(id, actorOrToken);
}

export async function registerPatient(
  input: PatientRegistrationInput,
  options?: {
    ignoreDuplicateWarning?: boolean;
    facilityId?: string | null;
    actor?: import("@/features/auth/types").AuthUser | null;
  }
): Promise<{ patient: Patient; duplicateWarning?: DuplicatePatientWarning }> {
  // Check for duplicate suspicion
  const duplicateWarning = await checkDuplicatePatient(input, options?.actor);
  if (duplicateWarning.isDuplicateSuspect && !options?.ignoreDuplicateWarning) {
    // Return early with warning so UI can display confirmation modal
    return {
      patient: null as any,
      duplicateWarning,
    };
  }

  const patientCode = generatePatientCode();

  const newPatient = await createPatient(
    {
      patient_code: patientCode,
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth || null,
      gender: genderToDb(input.gender),
      phone: input.phone || null,
      address: input.address || null,
      blood_group: input.bloodGroup === "Unknown" ? null : input.bloodGroup,
      emergency_contact: input.emergencyContact || null,
      facility_id: options?.facilityId || (input as any).facilityId || (input as any).facility_id || null,
    },
    options?.actor
  );

  return {
    patient: newPatient,
    duplicateWarning: duplicateWarning.isDuplicateSuspect ? duplicateWarning : undefined,
  };
}
