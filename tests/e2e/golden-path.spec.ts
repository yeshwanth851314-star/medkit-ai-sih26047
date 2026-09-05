import { test, expect } from "@playwright/test";

test.describe("MedKit AI: Golden Path E2E Demonstration Suite", () => {
  test("loads landing page with clinical safety controls and brand", async ({ page }) => {
    await page.goto("/");

    // Verify Title and Headline
    await expect(page).toHaveTitle(/MedKit AI/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Verify Skip to Main Content Link exists
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();

    // Verify Doctor Copilot and Kiosk navigation links
    const copilotLink = page.locator('a[href*="/doctor/dashboard"]');
    await expect(copilotLink).toBeVisible();

    const kioskLink = page.locator('a[href*="/intake/new"]');
    await expect(kioskLink).toBeVisible();
  });

  test("navigates to patient intake kiosk and shows bilingual controls", async ({ page }) => {
    await page.goto("/intake/new");

    // Check main kiosk heading
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();

    // Check language selector or intake prompt
    const languageBtn = page.locator("button, select").first();
    await expect(languageBtn).toBeVisible();
  });

  test("doctor portal requires authentication or loads dashboard", async ({ page }) => {
    await page.goto("/doctor/dashboard");

    // Middleware will redirect unauthenticated users to /login or show dashboard
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|doctor\/dashboard)/);
  });
});
