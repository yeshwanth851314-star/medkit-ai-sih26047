import { AuthUser } from "@/features/auth/types";

export interface DemoUser extends AuthUser {
  password?: string;
}

/**
 * Demo clinician accounts used when NEXT_PUBLIC_DEMO_MODE="true".
 * These are used exclusively for live SIH demos and local development.
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
};

/**
 * Distinct demo credential profiles for live SIH presentations.
 * - Doctor: Authenticated clinician portal & AI copilot
 * - Patient: Anonymous multimodal intake kiosk (pre-seeded identity: Ramesh Kumar Varma / MED-2026-0001)
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
    href: null, // Uses form login flow
  },
  patient: {
    label: "Patient Demo",
    demoId: "MED-2026-0001",
    abhaId: "91-2026-4047-1001",
    fullName: "Ramesh Kumar Varma",
    roleDescription: "Patient Voice Intake Kiosk",
    facility: "Reception Terminal 01",
    email: null,
    password: null,
    href: "/intake/new", // Direct kiosk entry, no password required
  },
} as const;
