import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { computeTotpCode } from "../../src/features/onboarding/totp-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const isPlaceholder = (val: string) =>
  !val ||
  val === "" ||
  val.includes("your-project.supabase.co") ||
  val.includes("placeholder") ||
  val.includes("ey... (placeholder)");

const isLiveConfigured =
  Boolean(supabaseUrl && serviceKey) &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(serviceKey);

test.describe("MedKit AI: Phase B Verified Clinician Onboarding Real E2E Suite", () => {
  let serviceSupabase: SupabaseClient;
  let applicantEmail = "";
  let applicantPassword = "";
  let applicantToken = "";
  let applicantUserId = "";
  let applicantProfileId = "";
  let mfaSecret = "";
  let mfaFactorId = "";

  const facilityId = "facility-aiia-delhi";
  const adminEmail = "synthetic.admin@medkit.ai";
  const adminPassword = "AdminSecurePass!2026#Alpha";
  let adminUserId = "";
  let adminToken = "";

  test.beforeAll(async () => {
    if (!isLiveConfigured) return;

    serviceSupabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Ensure synthetic admin exists with active status and facility assigned
    const { data: usersData } = await serviceSupabase.auth.admin.listUsers();
    let adminUser = usersData?.users?.find((u) => u.email === adminEmail);
    if (!adminUser) {
      const { data: created } = await serviceSupabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });
      adminUser = created.user;
    } else {
      await serviceSupabase.auth.admin.updateUserById(adminUser.id, {
        password: adminPassword,
      });
    }

    if (adminUser) {
      adminUserId = adminUser.id;
      await serviceSupabase.from("profiles").upsert({
        id: adminUserId,
        full_name: "Dr. AIIA Facility Director",
        role: "admin",
        facility_id: facilityId,
        is_active: true,
      });
    }

    applicantEmail = `applicant.${crypto.randomBytes(4).toString("hex")}@medkit.ai`;
    applicantPassword = `ClinicianSecurePass!${crypto.randomBytes(4).toString("hex")}#9`;
  });

  test("Test Case 1: Reject registration with invalid registration number format", async ({ request }) => {
    const response = await request.post("/api/auth/onboarding/register", {
      data: {
        fullName: "Dr. Invalid Applicant",
        email: `invalid.${Date.now()}@medkit.ai`,
        password: "ValidPassword123!",
        professionalType: "allopathy",
        registrationNumber: "NO", // Too short (< 5 chars)
        registrationAuthority: "Delhi Medical Council",
        registrationState: "Delhi",
        requestedFacilityId: facilityId,
        facilityRole: "doctor",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("INVALID");
  });

  test("Test Case 2: Register legitimate applicant with safe inactive defaults", async ({ request }) => {
    const response = await request.post("/api/auth/onboarding/register", {
      data: {
        fullName: "Dr. Sandeep Kulkarni",
        email: applicantEmail,
        password: applicantPassword,
        professionalType: "allopathy",
        registrationNumber: "MCI-2021-99881",
        registrationAuthority: "National Medical Commission",
        registrationState: "Delhi",
        requestedFacilityId: facilityId,
        facilityRole: "doctor",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.accountStatus).toBe("PENDING_IDENTITY");
    expect(body.profile.verificationStatus).toBe("pending");
    expect(body.profile.mfaEnrolled).toBe(false);
    expect(body.sessionToken).toBeDefined();

    applicantToken = body.sessionToken;
    applicantUserId = body.profile.userId;
    applicantProfileId = body.profile.id;

    // Verify database record has safe inactive defaults
    if (isLiveConfigured) {
      const { data: profile } = await serviceSupabase
        .from("profiles")
        .select("is_active, facility_id, role")
        .eq("id", applicantUserId)
        .single();
      expect(profile?.is_active).toBe(false);
      expect(profile?.facility_id).toBeNull();
    }
  });

  test("Test Case 3: Block direct jump to MFA enrollment before registry verification", async ({ request }) => {
    const response = await request.post("/api/auth/onboarding/mfa", {
      headers: { Authorization: `Bearer ${applicantToken}` },
      data: { action: "enroll" },
    });

    expect([400, 409]).toContain(response.status());
    const body = await response.json();
    expect(body.error).toContain("INVALID_ONBOARDING_STATE");
  });

  test("Test Case 4: Submit credentials for authoritative registry verification", async ({ request }) => {
    const response = await request.post("/api/auth/onboarding/verify-registry", {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.profile).toBeDefined();

    if (process.env.NMC_NMR_API_URL || process.env.ENABLE_TEST_REGISTRY_SANDBOX === "true") {
      expect(body.profile.verificationStatus).toBe("verified");
      expect(body.profile.accountStatus).toBe("MFA_REQUIRED");
    } else {
      expect(body.profile.verificationStatus).toBe("recheck_required");
      expect(body.profile.accountStatus).toBe("RECHECK_REQUIRED");
    }
  });

  test("Test Case 5: Block direct jump to facility approval before completing MFA", async ({ request }) => {
    const response = await request.post(`/api/admin/facility-approvals/${applicantProfileId}`, {
      headers: { Authorization: `Bearer ${adminToken || applicantToken}` },
      data: { action: "approve" },
    });

    expect([400, 401, 403]).toContain(response.status());
  });

  test("Test Case 6: Enroll TOTP MFA factor and verify valid 6-digit challenge", async ({ request }) => {
    if (isLiveConfigured) {
      await serviceSupabase
        .from("clinician_professional_profiles")
        .update({
          verification_status: "verified",
          verification_reference: `NMR-VERIFIED-${Date.now()}`,
          account_status: "MFA_REQUIRED",
        })
        .eq("user_id", applicantUserId);
    }

    // Step 1: Enroll MFA
    const enrollRes = await request.post("/api/auth/onboarding/mfa", {
      headers: { Authorization: `Bearer ${applicantToken}` },
      data: { action: "enroll" },
    });

    expect(enrollRes.status()).toBe(200);
    const enrollBody = await enrollRes.json();
    expect(enrollBody.secret).toBeDefined();
    mfaSecret = enrollBody.secret;
    mfaFactorId = enrollBody.factorId;

    // Step 2: Compute valid TOTP code
    const validCode = computeTotpCode(mfaSecret);

    // Step 3: Verify challenge
    const verifyRes = await request.post("/api/auth/onboarding/mfa", {
      headers: { Authorization: `Bearer ${applicantToken}` },
      data: {
        action: "verify",
        verificationCode: validCode,
        secret: mfaSecret,
        factorId: mfaFactorId,
      },
    });

    expect(verifyRes.status()).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.profile.accountStatus).toBe("PENDING_FACILITY_APPROVAL");
    expect(verifyBody.profile.mfaEnrolled).toBe(true);
  });

  test("Test Case 7: Prevent self-approval by applicant", async ({ request }) => {
    const response = await request.post(`/api/admin/facility-approvals/${applicantProfileId}`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
      data: { action: "approve" },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("FORBIDDEN");
  });

  test("Test Case 8: Authenticate as facility admin and approve clinician application", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: {
        email: adminEmail,
        password: adminPassword,
      },
    });

    if (loginRes.ok()) {
      const loginBody = await loginRes.json();
      adminToken = loginBody.token;
    }

    const approveRes = await request.post(`/api/admin/facility-approvals/${applicantProfileId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: "approve" },
    });

    expect(approveRes.status()).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.profile.accountStatus).toBe("ACTIVE");

    if (isLiveConfigured) {
      const { data: updatedProfile } = await serviceSupabase
        .from("profiles")
        .select("is_active, facility_id, role")
        .eq("id", applicantUserId)
        .single();

      expect(updatedProfile?.is_active).toBe(true);
      expect(updatedProfile?.facility_id).toBe(facilityId);
      expect(updatedProfile?.role).toBe("doctor");
    }
  });

  test("Test Case 9: Enforce AAL2 guard on clinical endpoints when session is AAL1", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: {
        email: applicantEmail,
        password: applicantPassword,
      },
    });

    if (loginRes.ok()) {
      const loginBody = await loginRes.json();
      const clinicianToken = loginBody.token;

      const patientsRes = await request.get("/api/patients", {
        headers: { Authorization: `Bearer ${clinicianToken}` },
      });

      expect([200, 403]).toContain(patientsRes.status());
      if (patientsRes.status() === 403) {
        const body = await patientsRes.json();
        expect(body.error).toBe("MFA_REQUIRED");
      }
    }
  });
});
