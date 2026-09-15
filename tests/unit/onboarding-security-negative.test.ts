import { describe, it, expect } from "vitest";
import { POST as verifyRegistryHandler } from "@/app/api/auth/onboarding/verify-registry/route";
import { POST as mfaHandler } from "@/app/api/auth/onboarding/mfa/route";
import { signSessionToken } from "@/lib/auth/jwt";
import { AuthUser } from "@/features/auth/types";

describe("SIH26047 Phase B: Onboarding Security Negative Tests", () => {
  const applicantA: AuthUser = {
    id: "usr-applicant-alpha",
    email: "alpha@aiia.gov.in",
    fullName: "Dr. Alpha Practitioner",
    role: "doctor",
    facilityId: null,
  };

  const applicantB: AuthUser = {
    id: "usr-applicant-beta",
    email: "beta@aiia.gov.in",
    fullName: "Dr. Beta Practitioner",
    role: "doctor",
    facilityId: null,
  };

  const tokenA = signSessionToken(applicantA);

  it("denies anonymous access to verify-registry with HTTP 401", async () => {
    const request = new Request("http://localhost:3000/api/auth/onboarding/verify-registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Dr. Anonymous" }),
    });

    const response = await verifyRegistryHandler(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("UNAUTHORIZED");
  });

  it("denies anonymous access to MFA endpoint with HTTP 401", async () => {
    const request = new Request("http://localhost:3000/api/auth/onboarding/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll" }),
    });

    const response = await mfaHandler(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("UNAUTHORIZED");
  });

  it("denies Applicant A attempting to verify Applicant B with HTTP 403", async () => {
    const request = new Request("http://localhost:3000/api/auth/onboarding/verify-registry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        userId: applicantB.id, // Attacking Applicant B
        fullName: applicantB.fullName,
      }),
    });

    const response = await verifyRegistryHandler(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("FORBIDDEN");
  });

  it("denies Applicant A attempting to enroll or verify MFA for Applicant B with HTTP 403", async () => {
    const request = new Request("http://localhost:3000/api/auth/onboarding/mfa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        userId: applicantB.id, // Attacking Applicant B
        action: "enroll",
      }),
    });

    const response = await mfaHandler(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("FORBIDDEN");
  });
});
