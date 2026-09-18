import { describe, it, expect } from "vitest";
import { authenticateClinician } from "@/features/auth/auth-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { signSessionToken } from "@/lib/auth/jwt";
import { DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";
import { generateTotpCode } from "@/lib/auth/totp";

describe("SIH Demo Doctor Account: MFA_REQUIRED Parity With Production Clinicians", () => {
  it("Step 1: Fresh login for demo doctor returns an AAL1 session with mfaEnrolled=true", async () => {
    const loginResult = await authenticateClinician({
      email: DEMO_QUICK_ACCESS.doctor.email,
      password: DEMO_QUICK_ACCESS.doctor.password,
    });

    expect(loginResult).not.toBeNull();
    expect(loginResult!.user.email).toBe("doctor@medkit.ai");
    expect(loginResult!.user.role).toBe("doctor");
    expect(loginResult!.user.aal).toBe("aal1");
    expect(loginResult!.user.mfaEnrolled).toBe(true);
  });

  it("Step 2: Clinical endpoint access with fresh AAL1 demo session strictly returns 403 MFA_REQUIRED", async () => {
    const loginResult = await authenticateClinician({
      email: DEMO_QUICK_ACCESS.doctor.email,
      password: DEMO_QUICK_ACCESS.doctor.password,
    });

    const aal1Token = loginResult!.token;

    // Attempting to query clinical patients with password-only AAL1 session
    const req = new Request("https://medkit.ai/api/patients", {
      headers: {
        Authorization: `Bearer ${aal1Token}`,
      },
    });

    const guardResult = await requireApiAuth(req);

    expect("errorResponse" in guardResult).toBe(true);
    if ("errorResponse" in guardResult) {
      expect(guardResult.errorResponse.status).toBe(403);
      const data = await guardResult.errorResponse.json();
      expect(data.error).toBe("MFA_REQUIRED");
      expect(data.message).toContain("AAL2");
    }
  });

  it("Step 3: RFC 6238 TOTP generator produces a valid 6-digit code for the demo doctor secret", async () => {
    const code = await generateTotpCode(DEMO_QUICK_ACCESS.doctor.totpSecret);

    expect(code).toBeDefined();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("Step 4: Elevated AAL2 session for demo doctor is granted full clinical access", async () => {
    const loginResult = await authenticateClinician({
      email: DEMO_QUICK_ACCESS.doctor.email,
      password: DEMO_QUICK_ACCESS.doctor.password,
    });

    // Elevated session after completing TOTP challenge
    const elevatedUser = {
      ...loginResult!.user,
      aal: "aal2" as const,
    };

    const elevatedToken = signSessionToken(elevatedUser);

    const req = new Request("https://medkit.ai/api/patients", {
      headers: {
        Authorization: `Bearer ${elevatedToken}`,
      },
    });

    const guardResult = await requireApiAuth(req);

    expect("user" in guardResult).toBe(true);
    if ("user" in guardResult) {
      expect(guardResult.user.id).toBe(loginResult!.user.id);
      expect(guardResult.user.aal).toBe("aal2");
    }
  });
});
