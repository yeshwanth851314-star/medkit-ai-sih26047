import { getPatients, getPatientById, createPatient } from "@/lib/db/supabase";
import { Patient } from "@/types/database";
import { PatientRegistrationInput, DuplicatePatientWarning } from "./types";

export function generatePatientCode(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `MED-2026-${randomDigits}`;
}

export async function checkDuplicatePatient(input: PatientRegistrationInput): Promise<DuplicatePatientWarning> {
  const existingPatients = await getPatients();

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

export async function searchPatients(query?: string): Promise<Patient[]> {
  return getPatients(query);
}

export async function getPatientDetails(id: string): Promise<Patient | null> {
  return getPatientById(id);
}

export async function registerPatient(
  input: PatientRegistrationInput,
  options?: { ignoreDuplicateWarning?: boolean }
): Promise<{ patient: Patient; duplicateWarning?: DuplicatePatientWarning }> {
  // Check for duplicate suspicion
  const duplicateWarning = await checkDuplicatePatient(input);
  if (duplicateWarning.isDuplicateSuspect && !options?.ignoreDuplicateWarning) {
    // Return early with warning so UI can display confirmation modal
    return {
      patient: null as any,
      duplicateWarning,
    };
  }

  const patientCode = generatePatientCode();

  const newPatient = await createPatient({
    patient_code: patientCode,
    full_name: input.fullName.trim(),
    date_of_birth: input.dateOfBirth || null,
    gender: input.gender || "Unknown",
    phone: input.phone || null,
    address: input.address || null,
    blood_group: input.bloodGroup === "Unknown" ? null : input.bloodGroup,
    emergency_contact: input.emergencyContact || null,
  });

  return {
    patient: newPatient,
    duplicateWarning: duplicateWarning.isDuplicateSuspect ? duplicateWarning : undefined,
  };
}
