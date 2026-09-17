import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

const DOCTOR_EMAIL = "doctor@medkit.ai";
const DOCTOR_PASSWORD = process.env.CLINICIAN_PASSWORD || "MedKit#Doctor!2026$SecP9";

test.describe("MedKit AI: Phase C Patient Identity, Consent & Secure Entry Real E2E Suite", () => {
  test.describe.configure({ mode: "serial" });

  let serviceSupabase: SupabaseClient | null = null;
  let registeredPatientId = "";
  let registeredPatientName = "";
  let registeredPatientPhone = "";

  test.beforeAll(async () => {
    if (isLiveConfigured) {
      serviceSupabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("medkit_doctor_onboarding_completed", "true");
      window.localStorage.setItem("medkit_doctor_onboarding_completed:doctor-101", "true");
      window.localStorage.setItem("medkit_doctor_onboarding_completed:user-doctor-01", "true");
      window.localStorage.setItem("medkit_doctor_onboarding_completed:usr-doc-0001", "true");
      window.localStorage.setItem("medkit_doctor_onboarding_completed:usr-doc-0002", "true");
      window.localStorage.setItem("medkit_kiosk_onboarding_completed", "true");
      window.sessionStorage.setItem("medkit_kiosk_onboarding_completed", "true");
    });
  });

  async function dismissTour(page: any) {
    const skipBtn = page.getByRole("button", { name: /Skip for now|Skip Tour|Close Quick Tour/i });
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
  }

  async function loginAsDoctor(page: any) {
    await page.goto("/login");
    await page.fill('input[type="email"], input#email', DOCTOR_EMAIL);
    await page.fill('input[type="password"], input#password', DOCTOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/doctor/**", { timeout: 30000 });
  }

  test("1. Patient registration without ABHA succeeds (non-coercive identity baseline)", async ({ page }) => {
    // Authenticate as Clinician
    await loginAsDoctor(page);
    await page.goto("/doctor/patients", { waitUntil: "domcontentloaded" });
    await dismissTour(page);
    const skipTour = page.locator('button:has-text("Skip for now"), button:has-text("Close Quick Tour")');
    if (await skipTour.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipTour.click();
    }

    // Open Register New Patient modal with hydration resilience
    const regButton = page.locator('button:has-text("Register New Patient")').first();
    await expect(regButton).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(600);
    await regButton.click();
    if (!await page.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await regButton.click();
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Fill form without ABHA (ABHA field should not be required or can be omitted)
    const timestamp = Date.now().toString().slice(-4);
    registeredPatientName = `Test Identity Patient ${timestamp}`;
    registeredPatientPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;

    await page.fill("input#reg-fullname", registeredPatientName);
    await page.fill("input#reg-dob", "1992-04-15");
    await page.fill("input#reg-phone", registeredPatientPhone);
    await page.fill("input#reg-address", "Sector 62, Noida, UP");

    // Submit registration
    const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first();
    await submitBtn.click();

    // Dialog should close on successful registration
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 15000 });

    // Search for newly registered patient
    await page.fill("input#patient-search-input", registeredPatientName);
    await page.waitForTimeout(1500);

    const patientRow = page.locator(`tr:has-text("${registeredPatientName}")`).first();
    await expect(patientRow).toBeVisible({ timeout: 15000 });

    const viewProfileLink = patientRow.locator('a:has-text("View Profile")');
    const href = await viewProfileLink.getAttribute("href");
    expect(href).toBeTruthy();
    registeredPatientId = href!.split("/doctor/patients/")[1];
    expect(registeredPatientId).toBeTruthy();
  });

  test("2. Duplicate candidate warning UI display on potential duplicate entry", async ({ page }) => {
    await loginAsDoctor(page);
    await page.goto("/doctor/patients", { waitUntil: "domcontentloaded" });
    await dismissTour(page);

    // Open Register modal with hydration resilience
    const regButton = page.locator('button:has-text("Register New Patient")').first();
    await expect(regButton).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(600);
    await regButton.click();
    if (!await page.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await regButton.click();
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Enter matching phone number to trigger duplicate detection
    await page.fill("input#reg-fullname", `${registeredPatientName} DuplicateAttempt`);
    await page.fill("input#reg-dob", "1992-04-15");
    await page.fill("input#reg-phone", registeredPatientPhone);
    await page.fill("input#reg-address", "Sector 62, Noida, UP");

    const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first();
    await submitBtn.click();

    // Should display duplicate warning dialog banner
    const warning = page.locator('text=Possible Duplicate Record Detected');
    await expect(warning).toBeVisible({ timeout: 10000 });

    // Verify explicit manual action buttons are displayed and NO automatic merge happens
    const viewExistingBtn = page.locator('a:has-text("View Existing Patient")');
    await expect(viewExistingBtn).toBeVisible();

    const registerDistinctBtn = page.locator('button:has-text("Register as Distinct Patient")');
    await expect(registerDistinctBtn).toBeVisible();

    // Close the dialog without merging
    const closeBtn = page.locator('[role="dialog"] button[aria-label="Close dialog"]');
    await closeBtn.click();
  });

  test("3. Explicit patient binding in case creation prevents orphan cases", async ({ page }) => {
    await loginAsDoctor(page);
    // Navigate to new case page with no patient selected
    await page.goto("/doctor/cases/new", { waitUntil: "domcontentloaded" });

    // Assert patient selection requirement banner is visible
    const patientRequiredBanner = page.locator("text=Patient Selection Required");
    await expect(patientRequiredBanner).toBeVisible({ timeout: 10000 });

    // Advance to the final section to verify finalize button is disabled without patient
    const nextBtn = page.locator('button:has-text("Next:"), button:has-text("Next Section")');
    while (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }

    // Finalize button should be disabled when patientId is empty
    const finalizeBtn = page.locator('button:has-text("Finalize Consultation")');
    if (await finalizeBtn.isVisible().catch(() => false)) {
      await expect(finalizeBtn).toBeDisabled();
    }

    // Now navigate with explicit patientId bound
    await page.goto(`/doctor/cases/new?patientId=${registeredPatientId}`, { waitUntil: "domcontentloaded" });

    // Banner should confirm explicit patient binding
    const documentingBanner = page.locator("text=Documenting Case For:");
    await expect(documentingBanner).toBeVisible({ timeout: 10000 });
  });

  test("4. Remote intake invitation lifecycle and revocation prevents reuse", async ({ request }) => {
    // Create an intake invitation directly via API
    // First, login to obtain session cookies
    const loginRes = await request.post("/api/auth/login", {
      data: {
        email: DOCTOR_EMAIL,
        password: DOCTOR_PASSWORD,
      },
    });
    expect(loginRes.ok()).toBeTruthy();

    // Create an invitation
    const inviteRes = await request.post("/api/intake/invite", {
      data: {
        patientId: registeredPatientId,
        purpose: "Pre-consultation intake verification",
        expiresInHours: 24,
      },
    });
    expect(inviteRes.ok()).toBeTruthy();
    const inviteData = await inviteRes.json();
    expect(inviteData.success).toBe(true);
    const invitationToken = inviteData.rawToken || inviteData.token;
    const invitationId = inviteData.invitation?.id || inviteData.invitationId;
    expect(invitationToken).toBeTruthy();
    expect(invitationId).toBeTruthy();

    // Validate the invitation token via GET /api/intake/invite/[token]
    const checkRes = await request.get(`/api/intake/invite/${invitationToken}`);
    expect(checkRes.status()).toBe(200);
    const checkData = await checkRes.json();
    expect(checkData.valid).toBe(true);
    expect(checkData.invitation.id).toBe(invitationId);

    // Revoke the invitation via non-secret invitation ID: POST /api/intake/invitations/[invitationId]/revoke
    const revokeRes = await request.post(`/api/intake/invitations/${invitationId}/revoke`, {
      data: {
        reason: "Patient checked in physically at registration desk",
      },
    });
    expect(revokeRes.status()).toBe(200);
    const revokeData = await revokeRes.json();
    expect(revokeData.success).toBe(true);
    expect(revokeData.revoked).toBe(true);

    // Verify revoked token is now rejected on subsequent access
    const postRevokeRes = await request.get(`/api/intake/invite/${invitationToken}`);
    expect(postRevokeRes.status()).toBe(403);
    const postRevokeData = await postRevokeRes.json();
    expect(postRevokeData.error).toContain("revoked");

    // Attempting to consume revoked token also fails
    const consumeRes = await request.post(`/api/intake/invite/${invitationToken}`);
    expect(consumeRes.status()).toBe(403);
  });
});
