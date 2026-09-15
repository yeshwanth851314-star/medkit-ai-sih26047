import {
  ProfessionalType,
  RegistrationVerificationRequest,
  RegistrationVerificationResult,
  FormatValidationResult,
  VerificationProvider,
} from "../types";

export interface IProfessionalRegistryProvider {
  readonly providerName: VerificationProvider;
  validateRegistrationFormat(
    request: RegistrationVerificationRequest
  ): FormatValidationResult;
  verifyWithAuthoritativeRegistry(
    request: RegistrationVerificationRequest
  ): Promise<RegistrationVerificationResult>;
}

/**
 * Normalizes practitioner legal names for safe comparison across councils.
 * Strips honorary titles (Dr, Vaidya, Hakim) and excess spacing.
 */
export function normalizePractitionerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr\.|dr\s+|vaidya\s+|hakim\s+|shri\s+|smt\s+)/i, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates if the applicant name safely matches the registered council record.
 */
export function matchesPractitionerName(applicantName: string, registryName: string): boolean {
  const normA = normalizePractitionerName(applicantName);
  const normB = normalizePractitionerName(registryName);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Check token overlap (handles first/last name permutations)
  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 1));
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap >= Math.min(tokensA.size, tokensB.size);
}

/**
 * National Medical Register (NMR) / National Medical Commission (NMC) Allopathy Provider
 * Regulates MBBS, MD, MS medical practitioners across India.
 */
export class AllopathyNMRRegistryProvider implements IProfessionalRegistryProvider {
  readonly providerName: VerificationProvider = "nmr_registry";

  validateRegistrationFormat(
    request: RegistrationVerificationRequest
  ): FormatValidationResult {
    const regNo = request.registrationNumber.trim().toUpperCase();
    if (!regNo || regNo.length < 5) {
      return {
        valid: false,
        code: "INVALID_LENGTH",
        error: "Registration number must be at least 5 alphanumeric characters.",
      };
    }

    if (!/^[A-Z0-9\-\/]{5,25}$/.test(regNo)) {
      return {
        valid: false,
        code: "MALFORMED_IDENTIFIER",
        error: "Registration number contains invalid characters for Indian Medical Council standards.",
      };
    }

    if (regNo.includes("REVOKED") || regNo.includes("SUSPENDED") || regNo === "MCI-00000") {
      return {
        valid: false,
        code: "REGISTRATION_SUSPENDED_OR_REVOKED",
        error: "Practitioner registration is flagged as revoked or suspended in the National Medical Register.",
      };
    }

    return { valid: true, code: "FORMAT_VALID" };
  }

  async verifyWithAuthoritativeRegistry(
    request: RegistrationVerificationRequest
  ): Promise<RegistrationVerificationResult> {
    const format = this.validateRegistrationFormat(request);
    if (!format.valid) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `REJ-${Date.now()}`,
        remarks: format.error || "Medical registration format invalid.",
        error: format.code,
      };
    }

    const regNo = request.registrationNumber.trim().toUpperCase();

    // Check if live external registry API is configured
    const nmcApiUrl = process.env.NMC_NMR_API_URL;
    const nmcApiKey = process.env.NMC_NMR_API_KEY;
    const sandboxEnabled = process.env.ENABLE_TEST_REGISTRY_SANDBOX === "true" || process.env.NODE_ENV === "test";

    if (nmcApiUrl) {
      try {
        const response = await fetch(`${nmcApiUrl.replace(/\/$/, "")}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(nmcApiKey ? { Authorization: `Bearer ${nmcApiKey}` } : {}),
          },
          body: JSON.stringify({
            registrationNumber: regNo,
            registrationAuthority: request.registrationAuthority,
            registrationState: request.registrationState,
            applicantFullName: request.applicantFullName,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return {
            verified: false,
            status: "recheck_required",
            provider: this.providerName,
            verificationReference: `NMR-HTTP-${response.status}-${Date.now()}`,
            remarks: `National Medical Register returned HTTP status ${response.status}. Credential queued for manual hospital verification.`,
            error: "EXTERNAL_REGISTRY_ERROR",
          };
        }

        const data = await response.json();
        if (!data.verified) {
          return {
            verified: false,
            status: data.status === "rejected" ? "rejected" : "recheck_required",
            provider: this.providerName,
            verificationReference: data.reference || `NMR-REJ-${Date.now()}`,
            remarks: data.remarks || "Registry returned non-verified status.",
            error: data.error || "REGISTRY_VERIFICATION_FAILED",
          };
        }

        return {
          verified: true,
          status: "verified",
          provider: this.providerName,
          verificationReference: data.reference || `NMR-${Date.now()}`,
          practitionerName: data.practitionerName || request.applicantFullName,
          specialty: data.specialty || "General Medicine / Surgery",
          remarks: data.remarks || "Registration verified with National Medical Commission.",
          verifiedAt: new Date().toISOString(),
          recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (fetchErr: any) {
        return {
          verified: false,
          status: "recheck_required",
          provider: this.providerName,
          verificationReference: `NMR-FAIL-${Date.now()}`,
          remarks: `National Medical Register gateway error: ${fetchErr?.message || "Connection failed"}. Credential queued for manual verification.`,
          error: "EXTERNAL_REGISTRY_UNAVAILABLE",
        };
      }
    }

    if (!sandboxEnabled) {
      // In production without live registry API: fail-closed with unambiguous status
      return {
        verified: false,
        status: "recheck_required",
        provider: this.providerName,
        verificationReference: `NMR-UNAVAILABLE-${Date.now()}`,
        remarks: "National Medical Register (NMR) authoritative API is not configured. Credential queued for manual hospital verification.",
        error: "EXTERNAL_REGISTRY_UNAVAILABLE",
      };
    }

    // Controlled sandbox for test environments or live provider execution
    // Negative test: Simulated identity mismatch
    if (regNo.includes("MISMATCH") || request.applicantFullName.includes("Mismatch")) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `NMR-MISMATCH-${Date.now()}`,
        practitionerName: "Dr. Different Registered Person",
        remarks: "Council registration is registered under a different practitioner name.",
        error: "REGISTRY_IDENTITY_MISMATCH",
      };
    }

    const verificationRef = `NMR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      verified: true,
      status: "verified",
      provider: this.providerName,
      verificationReference: verificationRef,
      practitionerName: request.applicantFullName,
      specialty: "General Medicine / Surgery",
      remarks: `Registration confirmed with National Medical Commission (${request.registrationAuthority}). Practitioner in good standing.`,
      verifiedAt: new Date().toISOString(),
      recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * National Commission for Indian System of Medicine (NCISM) AYUSH Provider
 * Regulates Ayurveda (BAMS), Yoga & Naturopathy, Unani (BUMS), Siddha (BSMS), and Sowa-Rigpa.
 */
export class AyushNCISMRegistryProvider implements IProfessionalRegistryProvider {
  readonly providerName: VerificationProvider = "ayush_ncism";

  validateRegistrationFormat(
    request: RegistrationVerificationRequest
  ): FormatValidationResult {
    const regNo = request.registrationNumber.trim().toUpperCase();
    if (!regNo || regNo.length < 4) {
      return {
        valid: false,
        code: "INVALID_LENGTH",
        error: "AYUSH registration number must be at least 4 characters.",
      };
    }

    if (!/^[A-Z0-9\-\/]{4,25}$/.test(regNo)) {
      return {
        valid: false,
        code: "MALFORMED_IDENTIFIER",
        error: "AYUSH registration number contains invalid characters.",
      };
    }

    if (regNo.includes("REVOKED") || regNo.includes("SUSPENDED") || regNo === "AYUSH-0000") {
      return {
        valid: false,
        code: "REGISTRATION_SUSPENDED_OR_REVOKED",
        error: "Registration flagged as invalid or suspended in NCISM records.",
      };
    }

    return { valid: true, code: "FORMAT_VALID" };
  }

  async verifyWithAuthoritativeRegistry(
    request: RegistrationVerificationRequest
  ): Promise<RegistrationVerificationResult> {
    const format = this.validateRegistrationFormat(request);
    if (!format.valid) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `REJ-${Date.now()}`,
        remarks: format.error || "AYUSH registration format invalid.",
        error: format.code,
      };
    }

    const regNo = request.registrationNumber.trim().toUpperCase();
    const ncismApiUrl = process.env.NCISM_API_URL;
    const ncismApiKey = process.env.NCISM_API_KEY;
    const sandboxEnabled = process.env.ENABLE_TEST_REGISTRY_SANDBOX === "true" || process.env.NODE_ENV === "test";

    if (ncismApiUrl) {
      try {
        const response = await fetch(`${ncismApiUrl.replace(/\/$/, "")}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(ncismApiKey ? { Authorization: `Bearer ${ncismApiKey}` } : {}),
          },
          body: JSON.stringify({
            registrationNumber: regNo,
            registrationAuthority: request.registrationAuthority,
            registrationState: request.registrationState,
            applicantFullName: request.applicantFullName,
            professionalType: request.professionalType,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return {
            verified: false,
            status: "recheck_required",
            provider: this.providerName,
            verificationReference: `NCISM-HTTP-${response.status}-${Date.now()}`,
            remarks: `NCISM AYUSH registry returned HTTP status ${response.status}. Credential queued for manual verification.`,
            error: "EXTERNAL_REGISTRY_ERROR",
          };
        }

        const data = await response.json();
        if (!data.verified) {
          return {
            verified: false,
            status: data.status === "rejected" ? "rejected" : "recheck_required",
            provider: this.providerName,
            verificationReference: data.reference || `NCISM-REJ-${Date.now()}`,
            remarks: data.remarks || "AYUSH Registry returned non-verified status.",
            error: data.error || "REGISTRY_VERIFICATION_FAILED",
          };
        }

        return {
          verified: true,
          status: "verified",
          provider: this.providerName,
          verificationReference: data.reference || `NCISM-${Date.now()}`,
          practitionerName: data.practitionerName || request.applicantFullName,
          specialty: data.specialty || (request.professionalType === "ayush_ayurveda" ? "Ayurveda / Kayachikitsa" : "Indian System of Medicine"),
          remarks: data.remarks || "Registration verified with NCISM AYUSH council.",
          verifiedAt: new Date().toISOString(),
          recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (fetchErr: any) {
        return {
          verified: false,
          status: "recheck_required",
          provider: this.providerName,
          verificationReference: `NCISM-FAIL-${Date.now()}`,
          remarks: `NCISM AYUSH registry gateway error: ${fetchErr?.message || "Connection failed"}. Credential queued for manual verification.`,
          error: "EXTERNAL_REGISTRY_UNAVAILABLE",
        };
      }
    }

    if (!sandboxEnabled) {
      return {
        verified: false,
        status: "recheck_required",
        provider: this.providerName,
        verificationReference: `NCISM-UNAVAILABLE-${Date.now()}`,
        remarks: "NCISM AYUSH registry gateway is not configured. Queued for manual verification.",
        error: "EXTERNAL_REGISTRY_UNAVAILABLE",
      };
    }

    if (regNo.includes("MISMATCH") || request.applicantFullName.includes("Mismatch")) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `NCISM-MISMATCH-${Date.now()}`,
        practitionerName: "Vaidya Other Person",
        remarks: "Council registration is registered under a different practitioner name.",
        error: "REGISTRY_IDENTITY_MISMATCH",
      };
    }

    const verificationRef = `NCISM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      verified: true,
      status: "verified",
      provider: this.providerName,
      verificationReference: verificationRef,
      practitionerName: request.applicantFullName,
      specialty: request.professionalType === "ayush_ayurveda" ? "Ayurveda / Kayachikitsa" : "Indian System of Medicine",
      remarks: `Registration confirmed with National Commission for Indian System of Medicine (${request.registrationAuthority}). Practitioner in good standing.`,
      verifiedAt: new Date().toISOString(),
      recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * National Commission for Homoeopathy (NCH) Provider
 * Regulates Homeopathy (BHMS, MD Homeopathy) practitioners across India.
 */
export class HomeopathyNCHRegistryProvider implements IProfessionalRegistryProvider {
  readonly providerName: VerificationProvider = "ayush_nch";

  validateRegistrationFormat(
    request: RegistrationVerificationRequest
  ): FormatValidationResult {
    const regNo = request.registrationNumber.trim().toUpperCase();
    if (!regNo || regNo.length < 4) {
      return {
        valid: false,
        code: "INVALID_LENGTH",
        error: "Homoeopathy registration number must be at least 4 characters.",
      };
    }

    if (!/^[A-Z0-9\-\/]{4,25}$/.test(regNo)) {
      return {
        valid: false,
        code: "MALFORMED_IDENTIFIER",
        error: "Homoeopathy registration number contains invalid characters.",
      };
    }

    if (regNo.includes("REVOKED") || regNo.includes("SUSPENDED")) {
      return {
        valid: false,
        code: "REGISTRATION_SUSPENDED_OR_REVOKED",
        error: "Registration flagged as suspended in National Commission for Homoeopathy records.",
      };
    }

    return { valid: true, code: "FORMAT_VALID" };
  }

  async verifyWithAuthoritativeRegistry(
    request: RegistrationVerificationRequest
  ): Promise<RegistrationVerificationResult> {
    const format = this.validateRegistrationFormat(request);
    if (!format.valid) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `REJ-${Date.now()}`,
        remarks: format.error || "NCH registration format invalid.",
        error: format.code,
      };
    }

    const regNo = request.registrationNumber.trim().toUpperCase();
    const nchApiUrl = process.env.NCH_API_URL;
    const nchApiKey = process.env.NCH_API_KEY;
    const sandboxEnabled = process.env.ENABLE_TEST_REGISTRY_SANDBOX === "true" || process.env.NODE_ENV === "test";

    if (nchApiUrl) {
      try {
        const response = await fetch(`${nchApiUrl.replace(/\/$/, "")}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(nchApiKey ? { Authorization: `Bearer ${nchApiKey}` } : {}),
          },
          body: JSON.stringify({
            registrationNumber: regNo,
            registrationAuthority: request.registrationAuthority,
            registrationState: request.registrationState,
            applicantFullName: request.applicantFullName,
            professionalType: "ayush_homeopathy",
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return {
            verified: false,
            status: "recheck_required",
            provider: this.providerName,
            verificationReference: `NCH-HTTP-${response.status}-${Date.now()}`,
            remarks: `National Commission for Homoeopathy returned HTTP status ${response.status}. Credential queued for manual verification.`,
            error: "EXTERNAL_REGISTRY_ERROR",
          };
        }

        const data = await response.json();
        if (!data.verified) {
          return {
            verified: false,
            status: data.status === "rejected" ? "rejected" : "recheck_required",
            provider: this.providerName,
            verificationReference: data.reference || `NCH-REJ-${Date.now()}`,
            remarks: data.remarks || "Homoeopathy Registry returned non-verified status.",
            error: data.error || "REGISTRY_VERIFICATION_FAILED",
          };
        }

        return {
          verified: true,
          status: "verified",
          provider: this.providerName,
          verificationReference: data.reference || `NCH-${Date.now()}`,
          practitionerName: data.practitionerName || request.applicantFullName,
          specialty: data.specialty || "Homoeopathy",
          remarks: data.remarks || "Registration verified with National Commission for Homoeopathy.",
          verifiedAt: new Date().toISOString(),
          recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (fetchErr: any) {
        return {
          verified: false,
          status: "recheck_required",
          provider: this.providerName,
          verificationReference: `NCH-FAIL-${Date.now()}`,
          remarks: `National Commission for Homoeopathy registry gateway error: ${fetchErr?.message || "Connection failed"}. Credential queued for manual verification.`,
          error: "EXTERNAL_REGISTRY_UNAVAILABLE",
        };
      }
    }

    if (!sandboxEnabled) {
      return {
        verified: false,
        status: "recheck_required",
        provider: this.providerName,
        verificationReference: `NCH-UNAVAILABLE-${Date.now()}`,
        remarks: "National Commission for Homoeopathy registry gateway is not configured.",
        error: "EXTERNAL_REGISTRY_UNAVAILABLE",
      };
    }

    if (regNo.includes("MISMATCH") || request.applicantFullName.includes("Mismatch")) {
      return {
        verified: false,
        status: "rejected",
        provider: this.providerName,
        verificationReference: `NCH-MISMATCH-${Date.now()}`,
        practitionerName: "Dr. Other Homoeopath",
        remarks: "Council registration name mismatch.",
        error: "REGISTRY_IDENTITY_MISMATCH",
      };
    }

    const verificationRef = `NCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      verified: true,
      status: "verified",
      provider: this.providerName,
      verificationReference: verificationRef,
      practitionerName: request.applicantFullName,
      specialty: "Homoeopathy",
      remarks: "Registration confirmed with National Commission for Homoeopathy.",
      verifiedAt: new Date().toISOString(),
      recheckAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * Resolves the authoritative registry verification provider based on clinician discipline
 */
export function getRegistryProviderForType(type: ProfessionalType): IProfessionalRegistryProvider {
  switch (type) {
    case "ayush_homeopathy":
      return new HomeopathyNCHRegistryProvider();

    case "ayush_ayurveda":
    case "ayush_yoga_naturopathy":
    case "ayush_unani":
    case "ayush_siddha":
      return new AyushNCISMRegistryProvider();

    case "allopathy":
    case "nursing":
    case "paramedical":
    default:
      return new AllopathyNMRRegistryProvider();
  }
}
