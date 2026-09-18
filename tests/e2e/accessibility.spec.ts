import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Reusable AxeBuilder factory configured for WCAG 2.2 AA-oriented evaluation.
 * Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa
 * Rules: target-size explicitly enabled (SC 2.5.8)
 */
function createAxeBuilder(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .options({
      rules: {
        "target-size": { enabled: true },
      },
    });
}

/**
 * Reusable helper to authenticate as doctor using existing safe test credentials
 */
async function loginAsDoctor(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "doctor@medkit.ai");
  await page.fill('input[type="password"]', process.env.CLINICIAN_PASSWORD || "MedKit#Doctor!2026$SecP9");
  await page.click('button[type="submit"]');

  const mfaHeading = page.getByText(/Multi-Factor Authentication Required/i);
  const outcome = await Promise.race([
    page.waitForURL(/\/doctor\/patients/, { timeout: 15000 }).then(() => "navigated").catch(() => null),
    mfaHeading.waitFor({ state: "visible", timeout: 15000 }).then(() => "mfa").catch(() => null),
  ]);

  if (outcome === "mfa") {
    const totpInput = page.locator('input#totpCode, input[name="verificationCode"]');
    await totpInput.fill("123456");
    const verifyBtn = page.getByRole("button", { name: /Verify & Access Portal/i });
    await expect(verifyBtn).toBeEnabled({ timeout: 5000 });
    await verifyBtn.click();
  }

  await page.waitForURL(/\/doctor\/patients/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/doctor\/patients/);
}

/**
 * Helper to assert zero critical and serious accessibility violations,
 * while logging any moderate findings for review.
 */
function assertNoBlockingViolations(results: any, pageLabel: string) {
  const blockingViolations = results.violations.filter(
    (v: any) => v.impact === "critical" || v.impact === "serious"
  );

  const moderateViolations = results.violations.filter(
    (v: any) => v.impact === "moderate"
  );
  if (moderateViolations.length > 0) {
    console.log(
      `[A11y Review] ${pageLabel}: ${moderateViolations.length} moderate finding(s) recorded:`,
      moderateViolations.map((v: any) => ({ id: v.id, help: v.help, nodes: v.nodes.length }))
    );
  }

  if (blockingViolations.length > 0) {
    console.error(
      `[A11y ERROR] ${pageLabel}: ${blockingViolations.length} blocking violation(s) found:`,
      JSON.stringify(blockingViolations, null, 2)
    );
  }

  expect(blockingViolations).toEqual([]);
}

test.describe("MedKit AI: Phase 6B WCAG 2.2 AA Accessibility Automated Scans", () => {
  test.describe.configure({ mode: "serial" });

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

  test("Axe audit: Public Login page (/login) has 0 critical and 0 serious violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /Clinician Portal Login/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "Login Page (/login)");
  });

  test("Axe audit: Public Patient Kiosk intake (/intake/new) has 0 critical and 0 serious violations", async ({ page }) => {
    await page.goto("/intake/new");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/\/intake\/new/);
    await expect(
      page.getByRole("heading", { name: /Welcome to MedKit AI Clinical Intake/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "Kiosk Intake (/intake/new)");
  });

  test("Axe audit: Protected Doctor Dashboard (/doctor/dashboard) redirects cleanly with 0 blocking violations", async ({ page }) => {
    await loginAsDoctor(page);

    await page.goto("/doctor/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // /doctor/dashboard resolves to /doctor/patients
    await expect(page).toHaveURL(/\/doctor\/patients/);
    await expect(
      page.getByRole("heading", { name: /Patient Records & Directory/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "Doctor Dashboard (/doctor/dashboard -> /doctor/patients)");
  });

  test("Axe audit: Protected Clinician Patients Hub (/doctor/patients) has 0 critical and 0 serious violations", async ({ page }) => {
    await loginAsDoctor(page);

    await page.goto("/doctor/patients");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/\/doctor\/patients/);
    await expect(
      page.getByRole("heading", { name: /Patient Records & Directory/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "Patients Directory (/doctor/patients)");
  });

  test("Axe audit: Protected New Clinical Case Form (/doctor/cases/new) has 0 critical and 0 serious violations", async ({ page }) => {
    await loginAsDoctor(page);

    await page.goto("/doctor/cases/new?patientId=11111111-1111-4111-8111-111111111111");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/\/doctor\/cases\/new/);
    await expect(
      page.getByRole("heading", { name: /Clinical Consultation & Case-Taking/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "New Case Form (/doctor/cases/new)");
  });

  test("Axe audit: Protected Case Detail Record (/doctor/cases/[id]) has 0 critical and 0 serious violations", async ({ page }) => {
    await loginAsDoctor(page);

    await page.goto("/doctor/cases/c1111111-1111-4111-8111-111111111111");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/\/doctor\/cases\/c1111111-1111-4111-8111-111111111111/);
    await expect(
      page.getByRole("heading", { name: /Persistent dry cough/i })
    ).toBeVisible();

    const results = await createAxeBuilder(page).analyze();
    assertNoBlockingViolations(results, "Case Detail Record (/doctor/cases/c1111111-1111-4111-8111-111111111111)");
  });
});
