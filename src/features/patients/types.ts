import { z } from "zod";
import { Patient } from "@/types/database";

export const patientRegistrationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  dateOfBirth: z.string().optional().nullable(),
  ageEstimate: z.number().int().min(0).max(130).optional().nullable(),
  gender: z.enum(["Male", "Female", "Other", "Unknown"]).default("Unknown"),
  phone: z.string().regex(/^(\+91[\-\s]?)?[6-9]\d{9}$|^$/, "Please enter a valid Indian phone number or leave blank").optional().nullable(),
  address: z.string().max(250).optional().nullable(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]).default("Unknown"),
  abhaId: z.string().optional().nullable(),
  facilityMrn: z.string().optional().nullable(),
  identityStatus: z.enum(["UNVERIFIED", "VERIFIED_LOCAL", "ABHA_LINKED", "MERGE_REVIEW_REQUIRED", "ARCHIVED"]).optional().nullable(),
  emergencyContact: z.object({
    name: z.string().min(1, "Contact name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(10, "Valid phone number is required"),
  }).optional().nullable(),
});

export type PatientRegistrationInput = z.input<typeof patientRegistrationSchema>;

export type DuplicateMatchConfidence = "NO_MATCH" | "POSSIBLE_MATCH" | "STRONG_MATCH" | "IDENTIFIER_CONFLICT" | "MANUAL_IDENTITY_REVIEW_REQUIRED";

export interface DuplicateCandidate {
  patientId: string;
  patientCode: string;
  fullName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  facilityId: string;
  matchType: string;
  matchConfidence: DuplicateMatchConfidence;
}

export interface DuplicatePatientWarning {
  isDuplicateSuspect: boolean;
  matchConfidence?: DuplicateMatchConfidence;
  matchedPatientId?: string;
  matchedPatientCode?: string;
  matchedName?: string;
  reason?: "matching_phone" | "matching_name_and_dob" | "exact_facility_mrn" | "exact_abha_id" | string;
  candidates?: DuplicateCandidate[];
}

export interface PatientPageResult {
  patients: Patient[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PatientPageQuery {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}
