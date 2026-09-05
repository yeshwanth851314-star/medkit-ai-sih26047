import { test, expect } from "@playwright/test";

test.describe("MedKit AI: SIH26047 Full Clinical Golden Path & Verification Suite", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Landing page loads with clinical safety controls, a11y landmarks, and navigation", async ({ page }) => {
    await page.goto("/");

    // Verify Title and Clinical Headline
    await expect(page).toHaveTitle(/MedKit AI/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Verify Skip to Main Content Link exists
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();

    // Verify Doctor Copilot and Kiosk navigation links
    const copilotLink = page.locator('a[href*="/doctor/patients"], a[href*="/doctor/dashboard"], a[href*="/login"]');
    await expect(copilotLink.first()).toBeVisible();

    const kioskLink = page.locator('a[href*="/intake/new"]');
    await expect(kioskLink.first()).toBeVisible();
  });

  test("2. Clinician authentication and dashboard triage queue", async ({ page }) => {
    await page.goto("/login");

    // Fill credentials
    await page.fill('input[type="email"]', "doctor@medkit.ai");
    await page.fill('input[type="password"]', "doctor123");
    await page.click('button[type="submit"]');

    // Should redirect to doctor patients hub
    await page.waitForURL(/\/doctor\/patients/);
    await expect(page).toHaveURL(/\/doctor\/patients/);

    // Verify patients hub components
    const patientSearch = page.getByPlaceholder(/Search by code/i);
    await expect(patientSearch).toBeVisible();

    // Verify list of patients is rendered
    const patientRows = page.locator("a[href*='/doctor/patients/']");
    await expect(patientRows.first()).toBeVisible();
  });

  test("3. Patient kiosk intake: language selection, consent recording, and adaptive questioning", async ({ page }) => {
    await page.goto("/intake/new");

    // Stage 1: Select Language
    const englishBtn = page.getByRole("button", { name: /English/i });
    await expect(englishBtn).toBeVisible();
    await englishBtn.click();

    // Stage 2: Explicit Patient Clinical Consent
    const consentHeading = page.getByText(/Patient Intake Consent & Privacy/i);
    await expect(consentHeading).toBeVisible();

    const consentNotice = page.getByText(/structured clinical summary/i);
    await expect(consentNotice).toBeVisible();

    // Acknowledge consent checkbox
    const consentCheckbox = page.locator('input[type="checkbox"]');
    await consentCheckbox.check();

    // Click Start Clinical Case-Taking
    const startBtn = page.getByRole("button", { name: /Begin Intake/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Stage 3: Adaptive Clinical Question Graph
    // Question 1: Chief Concern
    await page.waitForSelector("text=What is your main health concern", { timeout: 10000 });
    const chestPainChoice = page.getByRole("button", { name: /Chest pain or pressure/i });
    await expect(chestPainChoice).toBeVisible();
    await chestPainChoice.click();

    // Question 2: Onset
    await page.waitForSelector("text=When and how did this chest discomfort start", { timeout: 10000 });
    const onsetChoice = page.getByRole("button", { name: /Sudden onset during activity/i });
    await onsetChoice.click();

    // Question 3: Radiation
    await page.waitForSelector("text=Does the pain spread or radiate", { timeout: 10000 });
    const radiationChoice = page.getByRole("button", { name: /Radiates to left shoulder or jaw/i });
    await radiationChoice.click();

    // Question 4: Associated symptoms
    await page.waitForSelector("text=Are you experiencing any of these accompanying symptoms", { timeout: 10000 });
    const associatedChoice = page.getByRole("button", { name: /Heavy cold sweating and breathlessness/i });
    await associatedChoice.click();

    // Question 5: Past conditions (terminal node)
    await page.waitForSelector("text=Do you have any ongoing health conditions", { timeout: 10000 });
    const conditionsChoice = page.getByRole("button", { name: /Hypertension \(High BP\)/i });
    await conditionsChoice.click();

    // Stage 4: Completion and Queue confirmation
    await page.waitForSelector("text=Clinical Intake Submitted Successfully", { timeout: 15000 });
    const completeHeading = page.getByText(/Clinical Intake Submitted Successfully/i);
    await expect(completeHeading).toBeVisible();

    const queueNotice = page.getByText(/Doctor Copilot queue/i);
    await expect(queueNotice).toBeVisible();
  });

  test("4. Physician consultation copilot: red flags, AI summary disclaimer, and provenance", async ({ page }) => {
    // Navigate directly to cardiac emergency case c3333333-3333-4333-8333-333333333333
    await page.goto("/doctor/cases/c3333333-3333-4333-8333-333333333333");

    // If redirected to login, log in first
    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/cases\/c3333333-3333-4333-8333-333333333333/);
    }

    // Verify Red Flag Warning is displayed prominently
    const redFlagBanner = page.getByText(/CRITICAL CLINICAL RED FLAG/i);
    await expect(redFlagBanner).toBeVisible();

    const redFlagCopy = page.getByText(/Potential red flag detected — immediate clinical assessment recommended/i);
    await expect(redFlagCopy).toBeVisible();

    // Verify AI-Assisted Clinical Summary section and mandatory disclaimer
    const summaryHeading = page.getByText(/AI-Assisted Clinical Summary/i);
    await expect(summaryHeading).toBeVisible();

    const aiDisclaimer = page.getByText(/AI-assisted summary — clinician review required/i);
    await expect(aiDisclaimer.first()).toBeVisible();

    // Verify Candidate Medications / Documents
    const medHistory = page.getByText(/Home & Extracted Medications/i);
    await expect(medHistory).toBeVisible();

    // Verify Source Provenance tags
    const provenanceBadge = page.getByText(/Source: Patient/i);
    await expect(provenanceBadge.first()).toBeVisible();
  });

  test("5. Longitudinal patient timeline and visit comparison", async ({ page }) => {
    // Navigate to timeline for patient 11111111-1111-4111-8111-111111111111
    await page.goto("/doctor/patients/11111111-1111-4111-8111-111111111111/timeline");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/patients\/11111111-1111-4111-8111-111111111111\/timeline/);
    }

    // Verify Longitudinal Journey
    const timelineHeader = page.getByText(/Longitudinal Clinical Timeline/i);
    await expect(timelineHeader.first()).toBeVisible();

    // Verify visit comparison card
    const comparisonSection = page.getByText(/What Changed Since the Previous Visit/i);
    await expect(comparisonSection).toBeVisible();
  });
});
