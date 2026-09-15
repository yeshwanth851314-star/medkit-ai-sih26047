import { env } from "@/config/env";
import { getServiceSupabaseClient, getSupabaseClient } from "@/lib/db/supabase";
import { logAuditEvent } from "@/features/security/audit-service";
import { AuthUser } from "@/features/auth/types";
import { signSessionToken } from "@/lib/auth/jwt";
import {
  ClinicianRegistrationPayload,
  ClinicianProfessionalProfile,
  RegistrationVerificationResult,
  MfaEnrollmentResponse,
} from "./types";
import { getRegistryProviderForType } from "./registry/registry-adapter";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
} from "./totp-service";

// In-memory mock storage for offline / unit test execution
const mockProfessionalProfiles = new Map<string, ClinicianProfessionalProfile>();
const mockMfaSecrets = new Map<string, string>();

/**
 * Initiates healthcare professional registration and onboarding.
 * Enforces zero-self-promotion invariant: Account starts as PENDING_IDENTITY with is_active = false.
 * Uses privileged server client to create auth user and profile with compensation on failure.
 */
export async function registerClinicianApplicant(
  payload: ClinicianRegistrationPayload
): Promise<{ profile: ClinicianProfessionalProfile; sessionToken: string; message: string }> {
  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();
  const regNo = payload.registrationNumber.trim().toUpperCase();
  const authority = payload.registrationAuthority.trim();
  const state = payload.registrationState.trim();
  const facilityId = payload.requestedFacilityId.trim();

  if (!email || !payload.password || payload.password.length < 8) {
    throw new Error("INVALID_REQUEST: Valid email and strong password (min 8 chars) required.");
  }
  if (!fullName || fullName.length < 3) {
    throw new Error("INVALID_REQUEST: Full practitioner name required.");
  }
  if (!regNo || !authority || !state || !facilityId) {
    throw new Error("INVALID_REQUEST: Complete medical registration and facility selection required.");
  }

  const role = payload.facilityRole === "staff" ? "staff" : "doctor";
  let userId = `usr-app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      // 1. Create auth user with service-role privileged client
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError || !authData.user) {
        throw new Error(`AUTH_CREATION_FAILED: ${authError?.message || "Failed to create clinician account"}`);
      }

      userId = authData.user.id;

      try {
        // 2. Insert profile with safe defaults: inactive and unassigned facility
        const { error: profileError } = await serviceClient.from("profiles").upsert({
          id: userId,
          full_name: fullName,
          role,
          facility_id: null,
          is_active: false,
        });

        if (profileError) {
          throw profileError;
        }

        // 3. Insert onboarding professional profile
        const { data: profData, error: profError } = await serviceClient
          .from("clinician_professional_profiles")
          .insert({
            user_id: userId,
            professional_type: payload.professionalType,
            registration_number: regNo,
            registration_authority: authority,
            registration_state: state,
            verification_provider: payload.professionalType.startsWith("ayush") ? "ayush_ncism" : "nmr_registry",
            verification_status: "pending",
            requested_facility_id: facilityId,
            facility_role: role,
            account_status: "PENDING_IDENTITY",
            mfa_enrolled: false,
          })
          .select()
          .single();

        if (profError) {
          throw profError;
        }
      } catch (persistenceError: any) {
        // Compensation: Cleanup created auth user if downstream profile inserts fail
        console.error("Downstream profile creation failed, rolling back auth user:", persistenceError);
        await serviceClient.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`REGISTRATION_PERSISTENCE_FAILED: Failed to store applicant profile (${persistenceError?.message || "DB Error"})`);
      }
    }
  }

  const newProfile: ClinicianProfessionalProfile = {
    id: `prof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId,
    professionalType: payload.professionalType,
    registrationNumber: regNo,
    registrationAuthority: authority,
    registrationState: state,
    verificationProvider: payload.professionalType.startsWith("ayush") ? "ayush_ncism" : "nmr_registry",
    verificationStatus: "pending",
    requestedFacilityId: facilityId,
    facilityRole: role,
    accountStatus: "PENDING_IDENTITY",
    mfaEnrolled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockProfessionalProfiles.set(userId, newProfile);

  // Generate an onboarding applicant session token
  const applicantAuthUser: AuthUser = {
    id: userId,
    email,
    fullName,
    role,
    facilityId: null,
  };
  const sessionToken = signSessionToken(applicantAuthUser);

  await logAuditEvent({
    action: "CLINICIAN_ONBOARDING_INITIATED",
    resourceType: "clinician_onboarding",
    resourceId: userId,
    actorId: userId,
    metadata: {
      facilityId,
      professionalType: payload.professionalType,
      registrationAuthority: authority,
      state,
    },
  });

  return {
    profile: newProfile,
    sessionToken,
    message: "Clinician applicant registered. Next step: Submit credentials for registry verification.",
  };
}

/**
 * Executes professional medical council verification against authoritative adapter.
 * Strict ownership: identity is derived from authenticated applicant user.
 */
export async function verifyClinicianCredentials(
  actorUser: AuthUser,
  fullName?: string
): Promise<{ profile: ClinicianProfessionalProfile; verification: RegistrationVerificationResult }> {
  const userId = actorUser.id;
  let profile = mockProfessionalProfiles.get(userId);

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      const { data, error } = await serviceClient
        .from("clinician_professional_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        profile = {
          id: data.id,
          userId: data.user_id,
          professionalType: data.professional_type,
          registrationNumber: data.registration_number,
          registrationAuthority: data.registration_authority,
          registrationState: data.registration_state,
          verificationProvider: data.verification_provider,
          verificationStatus: data.verification_status,
          verificationReference: data.verification_reference,
          verifiedAt: data.verified_at,
          recheckAt: data.recheck_at,
          requestedFacilityId: data.requested_facility_id,
          facilityRole: data.facility_role,
          accountStatus: data.account_status,
          mfaEnrolled: data.mfa_enrolled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    }
  }

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND: Clinician onboarding application not found.");
  }

  // State assertion: cannot re-verify if already completed or active
  if (profile.accountStatus === "ACTIVE") {
    throw new Error("INVALID_ONBOARDING_STATE: Clinician profile is already ACTIVE.");
  }

  const adapter = getRegistryProviderForType(profile.professionalType);
  const result = await adapter.verifyWithAuthoritativeRegistry({
    professionalType: profile.professionalType,
    registrationNumber: profile.registrationNumber,
    registrationAuthority: profile.registrationAuthority,
    registrationState: profile.registrationState,
    applicantFullName: fullName || actorUser.fullName || "Dr. Applicant",
  });

  profile.verificationStatus = result.status;
  profile.verificationReference = result.verificationReference;
  profile.verifiedAt = result.verifiedAt || null;
  profile.recheckAt = result.recheckAt || null;

  if (result.verified) {
    profile.accountStatus = "MFA_REQUIRED";
  } else if (result.status === "rejected") {
    profile.accountStatus = "REJECTED";
    profile.rejectionReason = result.remarks;
  } else if (result.status === "recheck_required") {
    profile.accountStatus = "RECHECK_REQUIRED";
    profile.rejectionReason = result.remarks;
  }
  profile.updatedAt = new Date().toISOString();

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      await serviceClient
        .from("clinician_professional_profiles")
        .update({
          verification_status: profile.verificationStatus,
          verification_reference: profile.verificationReference,
          verified_at: profile.verifiedAt,
          recheck_at: profile.recheckAt,
          account_status: profile.accountStatus,
          rejection_reason: profile.rejectionReason,
          updated_at: profile.updatedAt,
        })
        .eq("user_id", userId);
    }
  }

  mockProfessionalProfiles.set(userId, profile);

  await logAuditEvent({
    action: result.verified ? "PROFESSIONAL_REGISTRY_VERIFIED" : "PROFESSIONAL_REGISTRY_REJECTED",
    resourceType: "clinician_onboarding",
    resourceId: userId,
    actorId: userId,
    metadata: {
      facilityId: profile.requestedFacilityId,
      provider: result.provider,
      reference: result.verificationReference,
      status: result.status,
    },
  });

  return { profile, verification: result };
}

/**
 * Initiates real cryptographic TOTP MFA enrollment.
 * PREREQUISITE: verification_status === 'verified' AND account_status === 'MFA_REQUIRED'.
 */
export async function initiateClinicianMfaEnrollment(
  actorUser: AuthUser
): Promise<MfaEnrollmentResponse> {
  const userId = actorUser.id;
  let profile = mockProfessionalProfiles.get(userId);

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      const { data } = await serviceClient
        .from("clinician_professional_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        profile = {
          id: data.id,
          userId: data.user_id,
          professionalType: data.professional_type,
          registrationNumber: data.registration_number,
          registrationAuthority: data.registration_authority,
          registrationState: data.registration_state,
          verificationProvider: data.verification_provider,
          verificationStatus: data.verification_status,
          requestedFacilityId: data.requested_facility_id,
          facilityRole: data.facility_role,
          accountStatus: data.account_status,
          mfaEnrolled: data.mfa_enrolled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    }
  }

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND: Clinician onboarding application not found.");
  }

  // Strict state machine check
  if (profile.verificationStatus !== "verified" || profile.accountStatus !== "MFA_REQUIRED") {
    throw new Error("INVALID_ONBOARDING_STATE: MFA enrollment is only permitted after professional verification is confirmed.");
  }

  // Generate real cryptographic TOTP secret
  const secret = generateTotpSecret(20);
  const factorId = `totp_${Date.now()}`;
  const qrCodeUri = generateTotpUri(secret, actorUser.email || "practitioner@medkit.ai");

  mockMfaSecrets.set(userId, secret);

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      await serviceClient
        .from("clinician_professional_profiles")
        .update({
          mfa_secret: secret,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  return {
    factorId,
    factorType: "totp",
    secret,
    qrCodeUri,
  };
}

/**
 * Cryptographically verifies user's TOTP challenge code against the issued secret.
 * Transitions account to PENDING_FACILITY_APPROVAL upon success.
 */
export async function verifyClinicianMfaChallenge(
  actorUser: AuthUser,
  verificationCode: string,
  providedSecret?: string
): Promise<{ profile: ClinicianProfessionalProfile; success: boolean }> {
  const userId = actorUser.id;
  let profile = mockProfessionalProfiles.get(userId);
  let storedSecret = mockMfaSecrets.get(userId) || providedSecret;

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      const { data } = await serviceClient
        .from("clinician_professional_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        profile = {
          id: data.id,
          userId: data.user_id,
          professionalType: data.professional_type,
          registrationNumber: data.registration_number,
          registrationAuthority: data.registration_authority,
          registrationState: data.registration_state,
          verificationProvider: data.verification_provider,
          verificationStatus: data.verification_status,
          requestedFacilityId: data.requested_facility_id,
          facilityRole: data.facility_role,
          accountStatus: data.account_status,
          mfaEnrolled: data.mfa_enrolled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        if (data.mfa_secret) storedSecret = data.mfa_secret;
      }
    }
  }

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND: Clinician onboarding application not found.");
  }

  if (profile.verificationStatus !== "verified" || profile.accountStatus !== "MFA_REQUIRED") {
    throw new Error("INVALID_ONBOARDING_STATE: MFA verification requires verified professional status and MFA_REQUIRED state.");
  }

  if (!storedSecret) {
    throw new Error("MFA_ENROLLMENT_REQUIRED: Must initiate MFA enrollment to generate authenticator challenge before verifying.");
  }

  // Real cryptographic TOTP verification (RFC 6238)
  const isValid = verifyTotpCode(storedSecret, verificationCode);
  if (!isValid) {
    throw new Error("INVALID_MFA_CODE: 6-digit TOTP code failed cryptographic challenge verification.");
  }

  profile.mfaEnrolled = true;
  profile.mfaVerifiedAt = new Date().toISOString();
  profile.accountStatus = "PENDING_FACILITY_APPROVAL";
  profile.updatedAt = new Date().toISOString();

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      await serviceClient
        .from("clinician_professional_profiles")
        .update({
          mfa_enrolled: true,
          mfa_verified_at: profile.mfaVerifiedAt,
          account_status: "PENDING_FACILITY_APPROVAL",
          updated_at: profile.updatedAt,
        })
        .eq("user_id", userId);
    }
  }

  mockProfessionalProfiles.set(userId, profile);

  await logAuditEvent({
    action: "CLINICIAN_MFA_ENROLLED",
    resourceType: "clinician_onboarding",
    resourceId: userId,
    actorId: userId,
    metadata: {
      facilityId: profile.requestedFacilityId,
      mfaEnrolled: true,
      nextStep: "PENDING_FACILITY_APPROVAL",
    },
  });

  return { profile, success: true };
}

/**
 * Backward-compatible helper for MFA verification in test pipelines
 */
export async function enrollClinicianMfa(
  actorUserOrId: AuthUser | string,
  verificationCode: string,
  secret?: string
): Promise<{ profile: ClinicianProfessionalProfile; success: boolean }> {
  const actorUser: AuthUser = typeof actorUserOrId === "string"
    ? { id: actorUserOrId, email: "applicant@medkit.ai", fullName: "Dr. Applicant", role: "doctor", facilityId: null }
    : actorUserOrId;

  return verifyClinicianMfaChallenge(actorUser, verificationCode, secret);
}

/**
 * Lists pending applications for a given facility.
 * Enforces facility isolation: only administrators of the requested facility can view.
 */
export async function listPendingFacilityApplications(
  facilityId: string,
  adminUser: AuthUser
): Promise<ClinicianProfessionalProfile[]> {
  if (adminUser.role !== "admin" && adminUser.role !== "staff") {
    throw new Error("FORBIDDEN: Administrative authorization required to view facility applications.");
  }
  if (adminUser.facilityId && adminUser.facilityId !== facilityId) {
    throw new Error("FORBIDDEN: Cannot view applications for another healthcare facility.");
  }

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      const { data, error } = await serviceClient
        .from("clinician_professional_profiles")
        .select("*")
        .eq("requested_facility_id", facilityId)
        .eq("account_status", "PENDING_FACILITY_APPROVAL");

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          professionalType: d.professional_type,
          registrationNumber: d.registration_number,
          registrationAuthority: d.registration_authority,
          registrationState: d.registration_state,
          verificationProvider: d.verification_provider,
          verificationStatus: d.verification_status,
          verificationReference: d.verification_reference,
          verifiedAt: d.verified_at,
          recheckAt: d.recheck_at,
          requestedFacilityId: d.requested_facility_id,
          facilityRole: d.facility_role,
          accountStatus: d.account_status,
          mfaEnrolled: d.mfa_enrolled,
          mfaVerifiedAt: d.mfa_verified_at,
          facilityApprovedBy: d.facility_approved_by,
          facilityApprovedAt: d.facility_approved_at,
          rejectionReason: d.rejection_reason,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    }
  }

  return Array.from(mockProfessionalProfiles.values()).filter(
    (p) => p.requestedFacilityId === facilityId && p.accountStatus === "PENDING_FACILITY_APPROVAL"
  );
}

/**
 * Approves a clinician's application for a facility using the atomic database RPC.
 * Enforces all prerequisite gates (verified, MFA, state, facility match).
 */
export async function approveFacilityApplication(
  profileId: string,
  adminUser: AuthUser
): Promise<{ profile: ClinicianProfessionalProfile; success: boolean }> {
  if (adminUser.role !== "admin" && adminUser.role !== "staff") {
    throw new Error("FORBIDDEN: Only hospital administrators or staff may approve clinician applications.");
  }

  let profile: ClinicianProfessionalProfile | undefined = Array.from(
    mockProfessionalProfiles.values()
  ).find((p) => p.id === profileId || p.userId === profileId);

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      // Execute the atomic PostgreSQL RPC
      const { data, error } = await serviceClient.rpc("approve_clinician_application", {
        p_profile_id: profileId,
        p_admin_id: adminUser.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Fetch fresh profile state
      const { data: updatedData } = await serviceClient
        .from("clinician_professional_profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (updatedData) {
        profile = {
          id: updatedData.id,
          userId: updatedData.user_id,
          professionalType: updatedData.professional_type,
          registrationNumber: updatedData.registration_number,
          registrationAuthority: updatedData.registration_authority,
          registrationState: updatedData.registration_state,
          verificationProvider: updatedData.verification_provider,
          verificationStatus: updatedData.verification_status,
          requestedFacilityId: updatedData.requested_facility_id,
          facilityRole: updatedData.facility_role,
          accountStatus: updatedData.account_status,
          mfaEnrolled: updatedData.mfa_enrolled,
          facilityApprovedBy: updatedData.facility_approved_by,
          facilityApprovedAt: updatedData.facility_approved_at,
          createdAt: updatedData.created_at,
          updatedAt: updatedData.updated_at,
        };
      }
    }
  }

  // Atomic fallback for offline / mock test execution
  if (!profile) {
    throw new Error("APPLICATION_NOT_FOUND: Clinician onboarding record not found.");
  }

  if (adminUser.facilityId && adminUser.facilityId !== profile.requestedFacilityId) {
    throw new Error("FORBIDDEN: Facility administrator cannot approve applicant for a different facility");
  }

  if (profile.accountStatus !== "PENDING_FACILITY_APPROVAL") {
    throw new Error(`APPLICATION_NOT_ELIGIBLE: Application must be in PENDING_FACILITY_APPROVAL state (current: ${profile.accountStatus})`);
  }

  if (profile.verificationStatus !== "verified") {
    throw new Error(`APPLICATION_NOT_ELIGIBLE: Professional credentials must be verified before approval (current: ${profile.verificationStatus})`);
  }

  if (!profile.mfaEnrolled) {
    throw new Error("APPLICATION_NOT_ELIGIBLE: Multi-factor authentication must be enrolled before approval");
  }

  profile.accountStatus = "ACTIVE";
  profile.facilityApprovedBy = adminUser.id;
  profile.facilityApprovedAt = new Date().toISOString();
  profile.updatedAt = new Date().toISOString();
  mockProfessionalProfiles.set(profile.userId, profile);

  await logAuditEvent({
    action: "CLINICIAN_FACILITY_APPROVED",
    resourceType: "clinician_onboarding",
    resourceId: profile.userId,
    actorId: adminUser.id,
    metadata: {
      facilityId: profile.requestedFacilityId,
      approvedBy: adminUser.id,
      role: profile.facilityRole,
      status: "ACTIVE",
    },
  });

  return { profile, success: true };
}

/**
 * Rejects a clinician's application for a facility using the atomic database RPC.
 */
export async function rejectFacilityApplication(
  profileId: string,
  reason: string,
  adminUser: AuthUser
): Promise<{ profile: ClinicianProfessionalProfile; success: boolean }> {
  if (adminUser.role !== "admin" && adminUser.role !== "staff") {
    throw new Error("FORBIDDEN: Only hospital administrators or staff may reject clinician applications.");
  }

  let profile: ClinicianProfessionalProfile | undefined = Array.from(
    mockProfessionalProfiles.values()
  ).find((p) => p.id === profileId || p.userId === profileId);

  if (!env.isDemoMode) {
    const serviceClient = getServiceSupabaseClient();
    if (serviceClient) {
      const { error } = await serviceClient.rpc("reject_clinician_application", {
        p_profile_id: profileId,
        p_reason: reason,
        p_admin_id: adminUser.id,
      });

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  if (!profile) {
    throw new Error("APPLICATION_NOT_FOUND: Clinician onboarding record not found.");
  }

  if (adminUser.facilityId && adminUser.facilityId !== profile.requestedFacilityId) {
    throw new Error("FORBIDDEN: Facility administrator cannot reject applicant for a different facility");
  }

  profile.accountStatus = "REJECTED";
  profile.rejectionReason = reason;
  profile.updatedAt = new Date().toISOString();
  mockProfessionalProfiles.set(profile.userId, profile);

  await logAuditEvent({
    action: "CLINICIAN_FACILITY_REJECTED",
    resourceType: "clinician_onboarding",
    resourceId: profile.userId,
    actorId: adminUser.id,
    metadata: {
      facilityId: profile.requestedFacilityId,
      reason,
    },
  });

  return { profile, success: true };
}

// Clear mock storage helper for isolated unit tests
export function resetMockOnboardingProfiles(): void {
  mockProfessionalProfiles.clear();
  mockMfaSecrets.clear();
}
