import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// WCAG 2.1 relative luminance and contrast calculation helper
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

describe("Phase 15: Accessibility (WCAG 2.1 AA) & Clinical Ergonomics Tests", () => {
  it("verifies WCAG 2.1 AA contrast ratio (>= 4.5:1) for text colors on white background", () => {
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

  it("verifies accessible focus indicators in globals.css", () => {
    const cssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    expect(cssContent).toContain(":focus-visible");
    expect(cssContent).toContain("outline:");
  });

  it("verifies screen reader live regions in RedFlagBanner", () => {
    const bannerPath = path.resolve(
      __dirname,
      "../../src/components/red-flags/red-flag-banner.tsx"
    );
    const bannerContent = fs.readFileSync(bannerPath, "utf-8");

    expect(bannerContent).toContain('role="alert"');
    expect(bannerContent).toContain('aria-live="assertive"');
    expect(bannerContent).toContain("min-h-[44px]"); // Touch target requirement
  });
});
