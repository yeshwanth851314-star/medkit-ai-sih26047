export type ProfessionalType =
  | "allopathy"
  | "ayush_ayurveda"
  | "ayush_yoga_naturopathy"
  | "ayush_unani"
  | "ayush_siddha"
  | "ayush_homeopathy"
  | "nursing"
  | "paramedical";

export type AccountStatus =
  | "PENDING_IDENTITY"
  | "IDENTITY_VERIFIED"
  | "PROFESSIONAL_VERIFICATION_PENDING"
  | "PROFESSIONAL_VERIFIED"
  | "MFA_REQUIRED"
  | "PENDING_FACILITY_APPROVAL"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "REVOKED"
  | "RECHECK_REQUIRED";

export type VerificationStatus =
  | "pending"
  | "pending_external_verification"
  | "verified"
  | "rejected"
  | "recheck_required";

export type VerificationProvider =
  | "nmr_registry"
  | "hpr_registry"
  | "ayush_ncism"
  | "ayush_nch"
  | "state_council"
  | "manual_review";

export interface FormatValidationResult {
  valid: boolean;
  code?: string;
  error?: string;
  remarks?: string;
}

export interface RegistrationVerificationRequest {
  professionalType: ProfessionalType;
  registrationNumber: string;
  registrationAuthority: string;
  registrationState: string;
  applicantFullName: string;
  yearOfRegistration?: number;
}

export interface RegistrationVerificationResult {
  verified: boolean;
  status: VerificationStatus;
  provider: VerificationProvider;
  verificationReference: string;
  practitionerName?: string;
  specialty?: string;
  remarks: string;
  error?: string;
  verifiedAt?: string | null;
  recheckAt?: string | null;
}

export interface MfaEnrollmentResponse {
  factorId: string;
  factorType: "totp";
  secret: string;
  qrCodeUri: string;
}

export interface MfaVerificationResult {
  success: boolean;
  mfaEnrolled: boolean;
  mfaVerifiedAt: string;
}

export interface ClinicianProfessionalProfile {
  id: string;
  userId: string;
  professionalType: ProfessionalType;
  registrationNumber: string;
  registrationAuthority: string;
  registrationState: string;
  verificationProvider: VerificationProvider;
  verificationStatus: VerificationStatus;
  verificationReference?: string | null;
  verifiedAt?: string | null;
  recheckAt?: string | null;
  requestedFacilityId: string;
  facilityRole: "doctor" | "staff";
  accountStatus: AccountStatus;
  mfaEnrolled: boolean;
  mfaVerifiedAt?: string | null;
  facilityApprovedBy?: string | null;
  facilityApprovedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicianRegistrationPayload {
  email: string;
  password: string;
  fullName: string;
  professionalType: ProfessionalType;
  registrationNumber: string;
  registrationAuthority: string;
  registrationState: string;
  requestedFacilityId: string;
  facilityRole?: "doctor" | "staff";
}
