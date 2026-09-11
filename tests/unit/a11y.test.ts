import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// WCAG 2.2 AA relative luminance and contrast calculation helper
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Phase 6B: Accessibility (WCAG 2.2 AA) & Clinical Ergonomics Tests", () => {
  it("verifies WCAG 2.2 AA contrast ratio (>= 4.5:1) for text colors on white background", () => {
    const white = "#ffffff";

    // Clinical Blue primary (#0369a1)
    const clinicalBlueContrast = getContrastRatio("#0369a1", white);
    expect(clinicalBlueContrast).toBeGreaterThanOrEqual(4.5);

    // Clinical Dark (#075985)
    const clinicalDarkContrast = getContrastRatio("#075985", white);
    expect(clinicalDarkContrast).toBeGreaterThanOrEqual(7.0);

    // Red flag alert text (#b91c1c)
    const redFlagContrast = getContrastRatio("#b91c1c", white);
    expect(redFlagContrast).toBeGreaterThanOrEqual(4.5);

    // Red flag critical dark text (#7f1d1d)
    const redFlagDarkContrast = getContrastRatio("#7f1d1d", white);
    expect(redFlagDarkContrast).toBeGreaterThanOrEqual(7.0);

    // AYUSH Green text (#15803d)
    const ayushContrast = getContrastRatio("#15803d", white);
    expect(ayushContrast).toBeGreaterThanOrEqual(4.5);

    // Slate 900 body copy (#0f172a)
    const bodyCopyContrast = getContrastRatio("#0f172a", white);
    expect(bodyCopyContrast).toBeGreaterThanOrEqual(15.0);
  });

  it("verifies skip-to-main-content landmark exists in RootLayout", () => {
    const layoutPath = path.resolve(__dirname, "../../src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    expect(layoutContent).toContain('href="#main-content"');
    expect(layoutContent).toContain("Skip to main content");
    expect(layoutContent).toContain('id="main-content"');
  });

  it("verifies accessible focus indicators & sticky clearance (WCAG 2.2 SC 2.4.11 / 2.4.12) in globals.css", () => {
    const cssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    expect(cssContent).toContain(":focus-visible");
    expect(cssContent).toContain("outline:");
    expect(cssContent).toContain("scroll-margin-top: 5rem");
    expect(cssContent).toContain("prefers-reduced-motion");
  });

  it("verifies screen reader live regions and touch target minimums in RedFlagBanner", () => {
    const bannerPath = path.resolve(
      __dirname,
      "../../src/components/red-flags/red-flag-banner.tsx"
    );
    const bannerContent = fs.readFileSync(bannerPath, "utf-8");

    expect(bannerContent).toContain('role="alert"');
    expect(bannerContent).toContain('aria-live="assertive"');
    expect(bannerContent).toContain("min-h-[44px]"); // Touch target requirement (WCAG 2.2 SC 2.5.8)
  });

  it("verifies responsive mobile navigation disclosure with ARIA attributes and focus return in Header", () => {
    const headerPath = path.resolve(__dirname, "../../src/components/shared/header.tsx");
    const headerContent = fs.readFileSync(headerPath, "utf-8");

    expect(headerContent).toContain('aria-expanded');
    expect(headerContent).toContain('aria-controls="mobile-navigation"');
    expect(headerContent).toContain('aria-label="Mobile navigation"');
    expect(headerContent).toContain('firstNavLinkRef');
    expect(headerContent).toContain('menuButtonRef');
    expect(headerContent).toContain("min-h-[44px]");
    // Ensure mobile disclosure is NOT claiming modal semantics without being a modal
    expect(headerContent).not.toContain('aria-controls="mobile-navigation-drawer"');
    expect(headerContent).not.toContain('role="dialog"');
  });

  it("verifies accessible dialog attributes, keyboard focus trap, and return focus in patient directory", () => {
    const patientsPath = path.resolve(__dirname, "../../src/app/doctor/patients/page.tsx");
    const content = fs.readFileSync(patientsPath, "utf-8");

    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('aria-labelledby="register-patient-title"');
    expect(content).toContain('htmlFor="patient-search-input"');
    expect(content).toContain('id="patient-search-input"');
    expect(content).toContain("min-h-[44px]");
    // Keyboard focus containment & focus stealing prevention
    expect(content).toContain("wasDialogOpenRef");
    expect(content).toContain("dialogRef");
    expect(content).toContain("registerButtonRef");
    expect(content).toContain("e.shiftKey");
  });

  it("verifies tablist roles and programmatic labeling in new case form sections", () => {
    const casePagePath = path.resolve(__dirname, "../../src/app/doctor/cases/new/page.tsx");
    const content = fs.readFileSync(casePagePath, "utf-8");

    expect(content).toContain('role="tablist"');
    expect(content).toContain('role="tab"');
    expect(content).toContain('role="tabpanel"');
    expect(content).toContain('role="alert"');
  });
});
