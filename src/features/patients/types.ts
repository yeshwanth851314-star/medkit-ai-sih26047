import { z } from "zod";

export const patientRegistrationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["Male", "Female", "Other", "Unknown"]).default("Unknown"),
  phone: z.string().regex(/^(\+91[\-\s]?)?[6-9]\d{9}$|^$/, "Please enter a valid Indian phone number or leave blank").optional().nullable(),
  address: z.string().max(250).optional().nullable(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]).default("Unknown"),
  emergencyContact: z.object({
    name: z.string().min(1, "Contact name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(10, "Valid phone number is required"),
  }).optional().nullable(),
});

export type PatientRegistrationInput = z.infer<typeof patientRegistrationSchema>;

export interface DuplicatePatientWarning {
  isDuplicateSuspect: boolean;
  matchedPatientId?: string;
  matchedPatientCode?: string;
  matchedName?: string;
  reason?: "matching_phone" | "matching_name_and_dob";
}
