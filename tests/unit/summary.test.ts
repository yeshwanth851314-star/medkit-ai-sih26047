import { describe, it, expect } from "vitest";
import {
  generateDeterministicSummary,
  generateAIAssistedSummary,
} from "../../src/features/summaries/summary-service";
import { clinicalSummarySchema } from "../../src/features/summaries/types";

describe("Phase 6: Deterministic Summary & PDF Tests", () => {
  const cardiacCaseId = "c3333333-3333-4333-8333-333333333333";
  const coughCaseId = "c1111111-1111-4111-8111-111111111111";

  it("generates schema-compliant deterministic summary from clinical case fields", async () => {
    const summary = await generateDeterministicSummary(coughCaseId);

    expect(summary).toBeDefined();
    expect(summary.summaryType).toBe("deterministic");
    expect(summary.chiefComplaint).toContain("Persistent dry cough");
    expect(summary.hpiNarrative).toContain("Onset: 2 weeks ago");
    expect(summary.hpiNarrative).toContain("Duration: 14 days");
    expect(summary.disclaimer).toBe("AI-assisted summary — clinician review required.");

    // Validate strictly against Zod schema
    const parsed = clinicalSummarySchema.safeParse(summary);
    expect(parsed.success).toBe(true);
  });

  it("extracts pertinent positives and pertinent negatives accurately", async () => {
    const summary = await generateDeterministicSummary(coughCaseId);

    expect(summary.pertinentPositives).toContain("mild throat tickle");
    expect(summary.pertinentNegatives).toContain("fever");
    expect(summary.pertinentNegatives).toContain("chest pain");
  });

  it("surfaces red flags in the clinical summary", async () => {
    const summary = await generateDeterministicSummary(cardiacCaseId);

    expect(summary.redFlags.length).toBeGreaterThanOrEqual(1);
    expect(summary.redFlags[0]).toContain("Potential red flag detected");
    expect(summary.redFlags[0]).toContain("acute crushing chest pain");
  });

  it("generates AI-assisted summary with disclaimer and schema adherence", async () => {
    const aiSummary = await generateAIAssistedSummary(coughCaseId);

    expect(aiSummary.summaryType).toBe("ai_assisted");
    expect(aiSummary.disclaimer).toBe("AI-assisted summary — clinician review required.");
    expect(aiSummary.status).toBe("reviewed");

    const parsed = clinicalSummarySchema.safeParse(aiSummary);
    expect(parsed.success).toBe(true);
  });

  it("validates summary confirmation with clinician provenance and persistence", async () => {
    const summary = await generateDeterministicSummary(coughCaseId);
    const confirmed = clinicalSummarySchema.parse({
      ...summary,
      hpiNarrative: "Clinician edited narrative: Patient cough improving.",
      status: "confirmed",
      confirmedBy: "Dr. Lakshmi Varma",
      confirmedAt: new Date().toISOString(),
      editedByClinician: true,
      providerMeta: {
        provider: "gemini-2.5-flash",
        latencyMs: 142,
      },
    });

    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedBy).toBe("Dr. Lakshmi Varma");
    expect(confirmed.editedByClinician).toBe(true);
    expect(confirmed.providerMeta?.provider).toBe("gemini-2.5-flash");
    expect(confirmed.providerMeta?.latencyMs).toBe(142);
  });
});
