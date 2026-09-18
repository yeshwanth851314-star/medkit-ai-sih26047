import { AuthUser } from "@/features/auth/types";

export interface DemoUser extends AuthUser {
  password?: string;
}

/**
 * Demo accounts used when NEXT_PUBLIC_DEMO_MODE="true".
 * These are used for live SIH presentations and local evaluation.
 * In production mode, authentication goes through Supabase GoTrue.
 */
export const DEMO_CLINICIAN_USERS: Record<string, DemoUser> = {
  "doctor@medkit.ai": {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
    password: "MedKit#Doctor!2026$SecP9",
    aal: "aal1",
    mfaEnrolled: true,
  },
  "ayush@medkit.ai": {
    id: "usr-doc-0002",
    email: "ayush@medkit.ai",
    fullName: "Vaidya Rajesh Sharma, BAMS",
    role: "doctor",
    facilityId: "fac-hyd-01",
    password: "MedKit#Ayush!2026$Vaidya7",
    aal: "aal2",
    mfaEnrolled: true,
  },
  "staff@medkit.ai": {
    id: "usr-stf-0001",
    email: "staff@medkit.ai",
    fullName: "Kiran Reddy (Triage Nurse)",
    role: "staff",
    facilityId: "fac-hyd-01",
    password: "MedKit#Staff!2026$Triage3",
    aal: "aal2",
    mfaEnrolled: true,
  },
  "diagnostics@medkit.ai": {
    id: "usr-diag-0001",
    email: "diagnostics@medkit.ai",
    fullName: "Vikram Das (Chief Lab Technologist)",
    role: "diagnostic_staff",
    facilityId: "fac-hyd-01",
    password: "MedKit#Lab!2026$Tech4",
    aal: "aal2",
    mfaEnrolled: true,
  },
  "pharmacy@medkit.ai": {
    id: "usr-pharm-0001",
    email: "pharmacy@medkit.ai",
    fullName: "Priya Nair, M.Pharm (Chief Pharmacist)",
    role: "pharmacist",
    facilityId: "fac-hyd-01",
    password: "MedKit#Pharm!2026$Dispense5",
    aal: "aal2",
    mfaEnrolled: true,
  },
  "reception@medkit.ai": {
    id: "usr-recep-0001",
    email: "reception@medkit.ai",
    fullName: "Sunita Rao (OPD Reception Desk)",
    role: "reception_staff",
    facilityId: "fac-hyd-01",
    password: "MedKit#Recep!2026$Desk1",
    aal: "aal2",
    mfaEnrolled: true,
  },
};

export const DEMO_PATIENT_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_KIOSK_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_KIOSK_SECRET = "kiosk-secret-hyd-01";

/**
 * Distinct demo credential profiles for live SIH presentations.
 */
export const DEMO_QUICK_ACCESS = {
  doctor: {
    label: "Doctor Demo",
    demoId: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    roleDescription: "Clinician Portal & AI Copilot",
    facility: "AIIA Main Hospital (fac-hyd-01)",
    email: "doctor@medkit.ai",
    password: "MedKit#Doctor!2026$SecP9",
    totpSecret: "MEDKITDOCTORDEMOTOTPSECRET234567",
    factorId: "11111111-2222-3333-4444-555555555555",
    href: "/doctor/patients",
  },
  patient: {
    label: "Patient Demo",
    demoId: "MED-2026-0001",
    patientId: DEMO_PATIENT_ID,
    abhaId: "91-2026-4047-1001",
    fullName: "Ramesh Kumar Varma",
    roleDescription: "Patient Voice Intake & Portal",
    facility: "Reception Terminal 01",
    email: null,
    password: null,
    href: "/patient/portal",
  },
  diagnostics: {
    label: "Diagnostics Lab Demo",
    demoId: "diagnostics@medkit.ai",
    fullName: "Vikram Das (Lab Technologist)",
    roleDescription: "Pathology & Specimen Analysis Portal",
    facility: "Central Diagnostic Lab (fac-hyd-01)",
    email: "diagnostics@medkit.ai",
    password: "MedKit#Lab!2026$Tech4",
    totpSecret: "MEDKITLABDEMOTOTPSECRET234567",
    factorId: "22222222-3333-4444-5555-666666666666",
    href: "/diagnostics/queue",
  },
  pharmacy: {
    label: "Hospital Pharmacy Demo",
    demoId: "pharmacy@medkit.ai",
    fullName: "Priya Nair (Pharmacist)",
    roleDescription: "Hospital Dispensary & Stock Verification",
    facility: "In-Hospital Pharmacy (fac-hyd-01)",
    email: "pharmacy@medkit.ai",
    password: "MedKit#Pharm!2026$Dispense5",
    totpSecret: "MEDKITPHARMDEMOTOTPSECRET234567",
    factorId: "33333333-4444-5555-6666-777777777777",
    href: "/pharmacy/queue",
  },
  opd: {
    label: "OPD & Reception Desk",
    demoId: "reception@medkit.ai",
    fullName: "Sunita Rao (Reception Desk)",
    roleDescription: "OPD Token Queue & Patient Check-In",
    facility: "Outpatient Registration Desk",
    email: "reception@medkit.ai",
    password: "MedKit#Recep!2026$Desk1",
    totpSecret: "MEDKITRECEPTOTPSECRET234567",
    factorId: "44444444-5555-6666-7777-888888888888",
    href: "/opd/queue",
  },
} as const;
