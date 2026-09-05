import { describe, it, expect } from "vitest";
import { DICTIONARIES, t } from "../../src/features/i18n/dictionary";
import {
  normalizeIntakeSpeech,
  verifyBilingualEntry,
  TELUGU_CLINICAL_LEXICON,
} from "../../src/features/i18n/multilingual-service";
import { bilingualEntrySchema } from "../../src/features/i18n/types";

describe("Phase 12: Multilingual Grounding & Telugu Intake Tests", () => {
  it("verifies dictionary key completeness for English and Telugu", () => {
    const enKeys = Object.keys(DICTIONARIES.en) as (keyof typeof DICTIONARIES.en)[];
    const teKeys = Object.keys(DICTIONARIES.te) as (keyof typeof DICTIONARIES.te)[];

    expect(enKeys.length).toBeGreaterThan(15);
    expect(teKeys.length).toBe(enKeys.length);

    enKeys.forEach((key) => {
      expect(DICTIONARIES.te[key]).toBeDefined();
      expect(DICTIONARIES.te[key].length).toBeGreaterThan(0);
    });

    // Test helper function
    expect(t("chiefComplaint", "te")).toBe("ప్రధాన సమస్య");
    expect(t("chiefComplaint", "en")).toBe("Chief Complaint");
  });

  it("processes and preserves raw Telugu intake transcript verbatim without loss", () => {
    const rawTelugu = "ఛాతీలో తీవ్రమైన నొప్పి వస్తోంది, ఎడమ భుజం లాగుతోంది, చాలా చెమటలు పోస్తున్నాయి.";

    const bilingual = normalizeIntakeSpeech({
      rawText: rawTelugu,
      language: "te",
      confidence: 0.94,
      provenance: "patient",
    });

    const validated = bilingualEntrySchema.safeParse(bilingual);
    expect(validated.success).toBe(true);

    // CRITICAL: Original Telugu must remain untouched
    expect(bilingual.originalText).toBe(rawTelugu);
    expect(bilingual.originalLanguage).toBe("te");
    expect(bilingual.normalizedEnglish).toContain("Severe chest pain");
    expect(bilingual.clinicalEntities?.concepts).toContain("chest_pain");
    expect(bilingual.clinicalEntities?.concepts).toContain("radiation_left_arm");
    expect(bilingual.clinicalEntities?.concepts).toContain("diaphoresis");
    expect(bilingual.isVerified).toBe(false);
  });

  it("handles English intake without modifying original text", () => {
    const rawEnglish = "I have a dry cough and mild fever since yesterday.";
    const result = normalizeIntakeSpeech({
      rawText: rawEnglish,
      language: "en",
      confidence: 0.98,
    });

    expect(result.originalText).toBe(rawEnglish);
    expect(result.originalLanguage).toBe("en");
    expect(result.normalizedEnglish).toBe(rawEnglish);
  });

  it("allows clinician to review, modify, and verify bilingual translation", () => {
    const initial = normalizeIntakeSpeech({
      rawText: "నాకు ఛాతీలో విపరీతమైన నొప్పి ఉంది.",
      language: "te",
    });

    expect(initial.isVerified).toBe(false);

    const verified = verifyBilingualEntry(
      initial,
      "Dr. Ramesh Rao, MD",
      "Patient reports excruciating acute chest pain."
    );

    expect(verified.isVerified).toBe(true);
    expect(verified.verifiedBy).toBe("Dr. Ramesh Rao, MD");
    expect(verified.verifiedAt).toBeDefined();
    expect(verified.normalizedEnglish).toBe("Patient reports excruciating acute chest pain.");
    // Original Telugu remains intact
    expect(verified.originalText).toBe(initial.originalText);
  });

  it("includes clinical terms in Telugu lexicon", () => {
    expect(TELUGU_CLINICAL_LEXICON["ఛాతీలో నొప్పి"].concept).toBe("chest_pain");
    expect(TELUGU_CLINICAL_LEXICON["ఆయాసం"].concept).toBe("dyspnea");
    expect(TELUGU_CLINICAL_LEXICON["జ్వరం"].concept).toBe("fever");
  });
});
