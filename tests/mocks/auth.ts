import { AuthUser } from "@/features/auth/types";

export interface TestMockUser extends AuthUser {
  password?: string;
}

export const TEST_MOCK_USERS: Record<string, TestMockUser> = {
  "doctor@medkit.ai": {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
    password: "MedKit#Doctor!2026$SecP9",
    aal: "aal2",
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
