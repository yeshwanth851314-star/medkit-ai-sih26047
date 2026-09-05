import { describe, it, expect } from "vitest";
import {
  validateDocumentFile,
  processDocumentExtraction,
  confirmExtractionMedication,
} from "../../src/features/documents/document-service";

describe("Phase 10: Document Intelligence & OCR Tests", () => {
  it("validates compliant document files within size limits", () => {
    const validPdf = validateDocumentFile({ mimeType: "application/pdf", sizeBytes: 2 * 1024 * 1024 });
    expect(validPdf.valid).toBe(true);

    const validJpg = validateDocumentFile({ mimeType: "image/jpeg", sizeBytes: 500 * 1024 });
    expect(validJpg.valid).toBe(true);
  });

  it("rejects unsupported file formats and oversize documents", () => {
    const invalidFormat = validateDocumentFile({ mimeType: "application/x-msdownload", sizeBytes: 1024 });
    expect(invalidFormat.valid).toBe(false);
    expect(invalidFormat.error).toContain("Unsupported file format");

    const oversize = validateDocumentFile({ mimeType: "application/pdf", sizeBytes: 15 * 1024 * 1024 });
    expect(oversize.valid).toBe(false);
    expect(oversize.error).toContain("exceeds 10MB limit");
  });

  it("extracts structured medications from clean printed prescription fixture", async () => {
    const result = await processDocumentExtraction("doc-0001");

    expect(result).toBeDefined();
    expect(result.documentType).toBe("prescription");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.disclaimer).toBe("Extracted from uploaded document — verify before use.");

    const meds = result.extractedData.medications;
    expect(meds.length).toBeGreaterThanOrEqual(2);
    expect(meds[0].name).toBe("Levocetirizine 5mg");
    expect(meds[0].pageRef).toBe(1);
    expect(meds[0].status).toBe("candidate");
  });

  it("extracts lab tests and flags out-of-range values", async () => {
    const result = await processDocumentExtraction("doc-0002");

    expect(result).toBeDefined();
    expect(result.documentType).toBe("lab");
    const tests = result.extractedData.tests;
    expect(tests.length).toBeGreaterThanOrEqual(3);

    const totalChol = tests.find((t: any) => t.name === "Total Cholesterol");
    expect(totalChol).toBeDefined();
    expect(totalChol.flag).toBe("high");
  });

  it("gracefully handles poor scan OCR failure and preserves original artifact", async () => {
    const result = await processDocumentExtraction("doc-0003");

    expect(result).toBeDefined();
    expect(result.status).toBe("failed");
    expect(result.confidence).toBeLessThan(0.3);
    expect(result.errorMessage).toContain("Document image resolution is too low");
  });

  it("confirms candidate medication field and updates verification status", async () => {
    const confirmed = await confirmExtractionMedication("doc-0001", "Levocetirizine 5mg");

    expect(confirmed).toBeDefined();
    const targetMed = confirmed.extractedData.medications.find((m: any) => m.name === "Levocetirizine 5mg");
    expect(targetMed?.status).toBe("verified");
    expect(confirmed.status).toBe("confirmed");
  });
});
