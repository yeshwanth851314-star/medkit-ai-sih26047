import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

  test("Axe audit: Landing page has 0 critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = scanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Axe audit: Login page has 0 critical accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = scanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Axe audit: Patient Kiosk intake has 0 critical accessibility violations", async ({ page }) => {
    await page.goto("/intake/new");
    await page.waitForLoadState("domcontentloaded");

    // If first-time kiosk intro is visible, click Start Intake
    const startIntroBtn = page.getByRole("button", { name: /Start Intake/i });
    if (await startIntroBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startIntroBtn.click();
    }

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = scanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Axe audit: Clinician Patients Hub has 0 critical accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "doctor@medkit.ai");
    await page.fill('input[type="password"]', "doctor123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/doctor\/patients/);

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = scanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Axe audit: New Clinical Case Form has 0 critical accessibility violations", async ({ page }) => {
    await page.goto("/doctor/cases/new?patientId=11111111-1111-4111-8111-111111111111");
    await page.waitForLoadState("domcontentloaded");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = scanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });
});
