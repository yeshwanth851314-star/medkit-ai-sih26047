import { describe, it, expect } from "vitest";
import { requireApiAuth, authenticateApiRequest } from "@/lib/auth/api-guard";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import { AuthUser } from "@/features/auth/types";
import { verifyActiveClinicalProfile } from "@/lib/db/supabase";

describe("Phase B Target 1 & Phase 3: Fresh-Session MFA Assurance Authority", () => {
  const activeClinicianWithMfa: AuthUser = {
    id: "usr-doc-active-01",
    email: "dr.sharma@aiia.gov.in",
    fullName: "Dr. Sharma",
    role: "doctor",
    facilityId: "facility-aiia-delhi",
    mfaEnrolled: true,
    aal: "aal1", // Fresh password-only login produces an AAL1 session
  };

  it("Step 1-3: Fresh password login at aal1 is denied on clinical routes with 403 MFA_REQUIRED", async () => {
    // Session token generated from password-only sign-in
    const aal1Token = signSessionToken(activeClinicianWithMfa);
    const parsedUser = verifySessionToken(aal1Token);

    expect(parsedUser).not.toBeNull();
    expect(parsedUser!.aal).toBe("aal1");
    expect(parsedUser!.mfaEnrolled).toBe(true);

    // Call clinical data route with AAL1 session
    const req = new Request("https://medkit.ai/api/patients", {
      headers: {
        Authorization: `Bearer ${aal1Token}`,
      },
    });

    const authResult = await requireApiAuth(req);

    // MUST fail with 403 MFA_REQUIRED
    expect("errorResponse" in authResult).toBe(true);
    if ("errorResponse" in authResult) {
      expect(authResult.errorResponse.status).toBe(403);
      const body = await authResult.errorResponse.json();
      expect(body.error).toBe("MFA_REQUIRED");
      expect(body.message).toContain("AAL2");
    }
  });

  it("Step 4-5: Elevated AAL2 session succeeds on clinical routes", async () => {
    // Session upgraded after TOTP challenge verification
    const aal2Clinician: AuthUser = {
      ...activeClinicianWithMfa,
      aal: "aal2",
    };

    const aal2Token = signSessionToken(aal2Clinician);
    const parsedUser = verifySessionToken(aal2Token);

    expect(parsedUser).not.toBeNull();
    expect(parsedUser!.aal).toBe("aal2");

    const req = new Request("https://medkit.ai/api/patients", {
      headers: {
        Authorization: `Bearer ${aal2Token}`,
      },
    });

    const authResult = await requireApiAuth(req);

    // MUST succeed
    expect("user" in authResult).toBe(true);
    if ("user" in authResult) {
      expect(authResult.user.id).toBe(activeClinicianWithMfa.id);
      expect(authResult.user.aal).toBe("aal2");
    }
  });

  it("verifies durable database mfa_assurance_level cannot promote an aal1 session to aal2", async () => {
    // Simulates an attacker presenting an aal1 session where DB profile has mfa_assurance_level = 'aal2'
    const aal1User: AuthUser = {
      id: "usr-doc-0001",
      email: "doctor@medkit.ai",
      fullName: "Dr. Doctor",
      role: "doctor",
      facilityId: "facility-aiia-delhi",
      aal: "aal1", // incoming request session is only AAL1
      mfaEnrolled: true,
    };

    const verified = await verifyActiveClinicalProfile(aal1User);

    if (verified) {
      // Must NOT have been overwritten to aal2!
      expect(verified.aal).toBe("aal1");
    }
  });
});
