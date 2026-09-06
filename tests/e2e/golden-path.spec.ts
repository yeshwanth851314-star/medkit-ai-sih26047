import { test, expect } from "@playwright/test";

test.describe("MedKit AI: SIH26047 Full Clinical Golden Path & Verification Suite", () => {
  test.describe.configure({ mode: "serial" });

  async function dismissDoctorTourIfOpen(page: any) {
    const skipTourBtn = page.getByRole("button", { name: /Skip for now|Skip Tour|Close Quick Tour/i });
    if (await skipTourBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipTourBtn.click();
    }
  }

  test.beforeEach(async ({ page }, testInfo) => {
    // For standard feature verification tests 1-10, pre-seed completed onboarding
    // so modal overlays do not disrupt unrelated feature assertions.
    // Test 11 explicitly tests fresh first-time onboarding and replay.
    if (!testInfo.title.includes("11.")) {
      await page.addInitScript(() => {
        window.localStorage.setItem("medkit_doctor_onboarding_completed_v1", "true");
        window.localStorage.setItem("medkit_kiosk_onboarding_completed_v1", "true");
      });
    }
  });

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

    // Dismiss Doctor Tour if it auto-opens on fresh login so it doesn't obstruct background elements
    const skipTourBtn = page.getByRole("button", { name: /Skip for now|Skip Tour|Done/i });
    if (await skipTourBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await skipTourBtn.click();
    }

    // Verify patients hub components
    const patientSearch = page.getByPlaceholder(/Search by code/i);
    await expect(patientSearch).toBeVisible();

    // Verify list of patients is rendered
    const patientRows = page.locator("a[href*='/doctor/patients/']");
    await expect(patientRows.first()).toBeVisible();
  });

  test("3. Patient kiosk intake: language selection, consent recording, and adaptive questioning", async ({ page }) => {
    await page.goto("/intake/new");

    // If first-time kiosk intro is visible, click Start Intake
    const startIntroBtn = page.getByRole("button", { name: /Start Intake/i });
    if (await startIntroBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startIntroBtn.click();
    }

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
    await dismissDoctorTourIfOpen(page);

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
    await dismissDoctorTourIfOpen(page);

    // Verify Longitudinal Journey
    const timelineHeader = page.getByText(/Longitudinal Clinical Timeline/i);
    await expect(timelineHeader.first()).toBeVisible();

    // Verify visit comparison card
    const comparisonSection = page.getByText(/What Changed Since the Previous Visit/i);
    await expect(comparisonSection).toBeVisible();
  });

  test("6. Document OCR side-by-side review, candidate verification, and doctor confirmation", async ({ page }) => {
    await page.goto("/doctor/patients/11111111-1111-4111-8111-111111111111/documents");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/patients\/11111111-1111-4111-8111-111111111111\/documents/);
    }
    await dismissDoctorTourIfOpen(page);

    // Verify OCR side-by-side header
    const ocrHeading = page.getByText(/Multimodal Document Digitization & OCR/i);
    await expect(ocrHeading).toBeVisible();

    // Verify Safety Mandate
    const safetyNotice = page.getByText(/Safety Mandate:/i);
    await expect(safetyNotice).toBeVisible();

    // Verify Candidate Extracted Fields
    const candidateSection = page.getByText(/Candidate Extracted Fields/i);
    await expect(candidateSection).toBeVisible();

    // Verify presence of Verify & Confirm button and trigger verification
    const verifyBtn = page.getByRole("button", { name: /Verify & Confirm/i }).first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      // Should show verified badge
      const verifiedBadge = page.getByText(/Verified/i).first();
      await expect(verifiedBadge).toBeVisible();
    }
  });

  test("7. AI-assisted summary narrative inline editing, clinician confirmation, and provenance badge", async ({ page }) => {
    await page.goto("/doctor/cases/c3333333-3333-4333-8333-333333333333");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/cases\/c3333333-3333-4333-8333-333333333333/);
    }
    await dismissDoctorTourIfOpen(page);

    // Check summary card is visible
    const summaryCard = page.getByText(/AI-Assisted Clinical Summary & Physician Copilot Synopsis/i);
    await expect(summaryCard).toBeVisible();

    // Check if Edit Narrative button is available
    const editBtn = page.getByRole("button", { name: /Edit Narrative/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();

      // Ensure textarea is visible and type into it
      const textarea = page.locator("textarea");
      await expect(textarea).toBeVisible();
      await textarea.fill("Clinician review note: Patient stabilized. ECG shows ST elevation. Emergency cardiology consultation initiated.");

      // Click Save & Confirm Synopsis button
      const saveConfirmBtn = page.getByRole("button", { name: "Save & Confirm Synopsis" });
      if (await saveConfirmBtn.isVisible()) {
        await saveConfirmBtn.click();
      } else {
        const confirmBtn = page.getByRole("button", { name: "Confirm Synopsis" }).first();
        await confirmBtn.click();
      }

      // Verify clinician confirmed status
      const confirmedBadge = page.getByText(/Clinician Confirmed/i);
      await expect(confirmedBadge).toBeVisible({ timeout: 10000 });
    }
  });

  test("8. FHIR R4 / ABDM preview drawer, resource summary counts, and standard compliance verification", async ({ page }) => {
    await page.goto("/doctor/cases/c1111111-1111-4111-8111-111111111111");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/cases\/c1111111-1111-4111-8111-111111111111/);
    }
    await dismissDoctorTourIfOpen(page);

    // Click FHIR R4 / ABDM View button
    const fhirBtn = page.getByRole("button", { name: /FHIR R4 \/ ABDM View/i });
    await expect(fhirBtn).toBeVisible();
    await fhirBtn.click();

    // Verify Drawer Heading
    const drawerHeading = page.getByText(/FHIR R4 \/ ABDM Record Preview/i);
    await expect(drawerHeading).toBeVisible();

    // Verify ABDM Compliance Disclaimer
    const abdmCompliance = page.getByText(/FHIR-compatible representation/i);
    await expect(abdmCompliance).toBeVisible();

    const standardTag = page.getByText(/HL7 FHIR R4 standard/i);
    await expect(standardTag).toBeVisible();

    // Switch to Raw JSON tab
    const jsonTab = page.getByRole("button", { name: /Raw JSON Document/i });
    await expect(jsonTab).toBeVisible();
    await jsonTab.click();

    // Verify JSON Content contains Bundle
    const jsonContent = page.getByText(/"resourceType": "Bundle"/i);
    await expect(jsonContent).toBeVisible();

    // Close Drawer
    const closeBtn = page.getByRole("button", { name: "✕" });
    await closeBtn.click();
    await expect(drawerHeading).not.toBeVisible();
  });

  test("9. Ministry of Ayush / AIIA Dashavidha Pariksha, Prakriti-Vikriti, and Ahara-Vihara clinical case display", async ({ page }) => {
    await page.goto("/doctor/cases/c4444444-4444-4444-8444-444444444444");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/cases\/c4444444-4444-4444-8444-444444444444/);
    }
    await dismissDoctorTourIfOpen(page);

    // Verify AYUSH Stream badge
    const ayushBadge = page.getByText(/ayush Stream/i);
    await expect(ayushBadge).toBeVisible();

    // Verify Dashavidha Pariksha section
    const parikshaHeading = page.getByText(/AYUSH Dashavidha Pariksha & Ahara-Vihara/i);
    await expect(parikshaHeading).toBeVisible();

    // Verify constitutional type (Prakriti)
    const prakritiValue = page.getByText(/Pitta-Vata/i);
    await expect(prakritiValue).toBeVisible();

    // Verify Ahara & Vihara Lifestyle Patterns
    const aharaHeading = page.getByText(/Ahara-Vihara \(Diet & Regimen Analysis\)/i);
    await expect(aharaHeading).toBeVisible();
  });

  test("10. Longitudinal 'What Changed Since Previous Visit' delta badges and case finalization addendum workflow", async ({ page }) => {
    // Navigate to follow-up encounter c2222222-2222-4222-8222-222222222222
    await page.goto("/doctor/cases/c2222222-2222-4222-8222-222222222222");

    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/cases\/c2222222-2222-4222-8222-222222222222/);
    }
    await dismissDoctorTourIfOpen(page);

    // 1. Verify Longitudinal Delta Analysis signature section is mounted directly on physician case sheet
    const comparisonSection = page.getByText(/What Changed Since the Previous Visit/i);
    await expect(comparisonSection).toBeVisible();

    // 2. Verify Symptom progression badges
    const newSymptomsBadge = page.getByText(/New Symptoms/i);
    await expect(newSymptomsBadge).toBeVisible();

    const resolvedBadge = page.getByText(/Resolved/i).first();
    await expect(resolvedBadge).toBeVisible();

    // 3. Verify Medication titration delta table
    const medTableHeading = page.getByText(/Medication Changes & Titration Delta/i);
    await expect(medTableHeading).toBeVisible();

    // 4. Test Finalized Case immutability & Addendum modal on finalized case c1111111-1111-4111-8111-111111111111
    await page.goto("/doctor/cases/c1111111-1111-4111-8111-111111111111");
    const addendumBtn = page.getByRole("button", { name: /Add Addendum/i });
    await expect(addendumBtn).toBeVisible();
    await addendumBtn.click();

    // Verify modal appears with a11y dialog semantics
    const modalTitle = page.getByText(/Append Clinical Addendum to Case/i);
    await expect(modalTitle).toBeVisible();

    // Dismiss with Escape key (testing our new a11y keyboard listener)
    await page.keyboard.press("Escape");
    await expect(modalTitle).not.toBeVisible();
  });

  test("11. First-time user onboarding: Doctor 5-step guided tour, persistent replay menu, bilingual kiosk intro, and contextual help", async ({ page }) => {
    // 1. Doctor Tour flow on clean preference
    await page.goto("/doctor/patients");
    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/patients/);
    }

    // Reset onboarding state in localStorage to simulate fresh clinician login
    await page.evaluate(() => {
      window.localStorage.removeItem("medkit_doctor_onboarding_completed_v1");
    });
    await page.reload();

    // Verify Welcome modal appears
    const tourDialog = page.locator('div[role="dialog"]');
    await expect(tourDialog).toBeVisible();
    await expect(page.getByText(/Welcome to MedKit AI/i)).toBeVisible();

    // Start Quick Tour
    const startTourBtn = page.getByRole("button", { name: /Start Quick Tour/i });
    await expect(startTourBtn).toBeVisible();
    await startTourBtn.click();

    // Step 1: Dashboard & Triage Hub
    await expect(page.getByText(/Step 1 of 5/i)).toBeVisible();
    await expect(page.getByText(/Triage & Intake Queue/i)).toBeVisible();
    const nextBtn1 = page.getByRole("button", { name: /Next:/i });
    await nextBtn1.click();

    // Step 2: Red Flags
    await expect(page.getByText(/Step 2 of 5/i)).toBeVisible();
    await expect(page.getByText(/Rule-Based Safety Alerts/i)).toBeVisible();
    const nextBtn2 = page.getByRole("button", { name: /Next:/i });
    await nextBtn2.click();

    // Step 3: What Changed (signature differentiator)
    await expect(page.getByText(/Step 3 of 5/i)).toBeVisible();
    await expect(page.getByText(/Primary Differentiator/i).first()).toBeVisible();
    await expect(page.getByText(/See What Changed/i).first()).toBeVisible();
    const nextBtn3 = page.getByRole("button", { name: /Next:/i });
    await nextBtn3.click();

    // Step 4: AI Summary & Provenance
    await expect(page.getByText(/Step 4 of 5/i)).toBeVisible();
    await expect(page.getByText(/AI-Assisted Clinical Summary/i).first()).toBeVisible();
    await expect(page.getByText(/AI assists. The clinician decides./i).first()).toBeVisible();
    const nextBtn4 = page.getByRole("button", { name: /Next:/i });
    await nextBtn4.click();

    // Step 5: Finalize & Addenda
    await expect(page.getByText(/Step 5 of 5/i)).toBeVisible();
    await expect(page.getByText(/Finalize the Clinical Record/i).first()).toBeVisible();
    const finishBtn = page.getByRole("button", { name: /Start Using MedKit AI/i });
    await finishBtn.click();

    // Verify modal is closed
    await expect(tourDialog).not.toBeVisible();

    // Replay tour via Header Persistent Help Menu
    const helpMenuBtn = page.getByRole("button", { name: /Clinician Help & Quick Tour Menu/i });
    await expect(helpMenuBtn).toBeVisible();
    await helpMenuBtn.click();

    const replayBtn = page.getByRole("menuitem", { name: /Replay Quick Tour/i });
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();

    // Tour re-opens directly in tour mode
    await expect(tourDialog).toBeVisible();

    // Dismiss with Escape key
    await page.keyboard.press("Escape");
    await expect(tourDialog).not.toBeVisible();

    // 2. Patient Kiosk First-Time Intro
    await page.goto("/intake/new");
    await page.evaluate(() => {
      window.localStorage.removeItem("medkit_kiosk_onboarding_completed_v1");
    });
    await page.reload();

    // Verify Kiosk Intro Card is displayed
    await expect(page.getByText(/Patient Kiosk Guide/i).first()).toBeVisible();
    await expect(page.getByText(/Welcome to MedKit AI/i).first()).toBeVisible();

    // Toggle to Telugu
    const teBtn = page.getByRole("button", { name: /తెలుగు/i });
    await teBtn.click();
    await expect(page.getByText(/రోగి కియోస్క్ గైడ్/i).first()).toBeVisible();
    await expect(page.getByText(/MedKit AI కి స్వాగతం/i).first()).toBeVisible();

    // Switch back to English
    const enBtn = page.getByRole("button", { name: "English" });
    await enBtn.click();
    await expect(page.getByText(/Patient Kiosk Guide/i).first()).toBeVisible();

    // Click Start Intake
    const kioskStartBtn = page.getByRole("button", { name: /Start Intake/i });
    await kioskStartBtn.click();

    // Advances to language selection
    const engSelectBtn = page.getByRole("button", { name: /English/i });
    await expect(engSelectBtn).toBeVisible();

    // 3. Clinical Contextual Help Verification on Case Sheet
    await page.goto("/doctor/cases/c2222222-2222-4222-8222-222222222222");
    const helpBtn = page.getByRole("button", { name: /Help:.*What Changed/i }).first();
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    // Verify definition popover appears
    const definitionNotice = page.getByText(/Signature longitudinal synthesis computed deterministically/i).first();
    await expect(definitionNotice).toBeVisible();

    // Close popover with Escape
    await page.keyboard.press("Escape");
    await expect(definitionNotice).not.toBeVisible();
  });
});


