import { describe, it, expect } from "vitest";
import {
  getAIProvider,
  DeterministicDemoAIProvider,
  ResilientAIProvider,
  AIProvider,
  AIClinicalSummaryResult,
} from "../../src/features/ai/ai-provider";
import {
  getSpeechProvider,
  DeterministicDemoSpeechProvider,
  ResilientSpeechProvider,
  SpeechProvider,
  SpeechTranscriptionResponse,
} from "../../src/features/voice/speech-provider";
import {
  getOCRProvider,
  DeterministicDemoOCRProvider,
  ResilientOCRProvider,
  OCRProvider,
  OCRExtractionResponse,
} from "../../src/features/documents/ocr-provider";

describe("Phase 4: Decoupled Intelligence Providers & Resilient Fallback", () => {
  const testCaseId = "c1111111-1111-4111-8111-111111111111";

  describe("AI Provider Architecture", () => {
    it("returns a deterministic demo provider by default in demo mode", () => {
      const provider = getAIProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBe("deterministic-demo");
    });

    it("generates clinical summary with mandatory disclaimer and provider metadata", async () => {
      const provider = new DeterministicDemoAIProvider();
      const result = await provider.generateClinicalSummary(testCaseId);

      expect(result).toBeDefined();
      expect(result.chiefComplaint).toBeDefined();
      expect(result.disclaimer).toBe("AI-assisted summary — clinician review required.");
      expect(result.providerMeta.provider).toBe("deterministic-demo");
      expect(result.providerMeta.fallbackUsed).toBe(false);
      expect(result.providerMeta.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("resilient wrapper returns primary result when primary succeeds", async () => {
      const mockPrimary: AIProvider = {
        name: "gemini-2.5-flash",
        generateClinicalSummary: async () => ({
          summaryType: "ai_assisted",
          patientContext: { name: "Test", code: "T1", gender: "Male" },
          chiefComplaint: "Primary output",
          hpiNarrative: "Primary narrative",
          pertinentPositives: [],
          pertinentNegatives: [],
          activeMedications: [],
          knownAllergies: [],
          vitalsSummary: "",
          redFlags: [],
          missingInformation: [],
          provenanceMap: {},
          disclaimer: "AI-assisted summary — clinician review required.",
          status: "reviewed",
          generatedAt: new Date().toISOString(),
          providerMeta: { provider: "gemini-2.5-flash", latencyMs: 250, fallbackUsed: false },
        }),
      };

      const fallback = new DeterministicDemoAIProvider();
      const resilient = new ResilientAIProvider(mockPrimary, fallback, 1000);

      const result = await resilient.generateClinicalSummary(testCaseId);
      expect(result.chiefComplaint).toBe("Primary output");
      expect(result.providerMeta.fallbackUsed).toBe(false);
    });

    it("resilient wrapper falls back to deterministic provider when primary throws error", async () => {
      const failingPrimary: AIProvider = {
        name: "gemini-2.5-flash",
        generateClinicalSummary: async () => {
          throw new Error("429 Resource Exhausted / Rate limit exceeded");
        },
      };

      const fallback = new DeterministicDemoAIProvider();
      const resilient = new ResilientAIProvider(failingPrimary, fallback, 1000);

      const result = await resilient.generateClinicalSummary(testCaseId);
      expect(result).toBeDefined();
      expect(result.providerMeta.provider).toBe("deterministic-demo");
      expect(result.providerMeta.fallbackUsed).toBe(true);
      expect(result.providerMeta.fallbackReason).toContain("Resource Exhausted");
      expect(result.disclaimer).toBe("AI-assisted summary — clinician review required.");
    });

    it("resilient wrapper aborts and falls back when primary times out", async () => {
      const slowPrimary: AIProvider = {
        name: "gemini-2.5-flash",
        generateClinicalSummary: async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          throw new Error("Should have timed out");
        },
      };

      const fallback = new DeterministicDemoAIProvider();
      // Fast timeout for test speed (50ms)
      const resilient = new ResilientAIProvider(slowPrimary, fallback, 50);

      const result = await resilient.generateClinicalSummary(testCaseId);
      expect(result).toBeDefined();
      expect(result.providerMeta.fallbackUsed).toBe(true);
      expect(result.providerMeta.fallbackReason).toContain("timed out");
    });
  });

  describe("Speech / ASR Provider Architecture", () => {
    it("transcribes English and Telugu speech with confidence and providerMeta", async () => {
      const provider = new DeterministicDemoSpeechProvider();
      const enResult = await provider.transcribe({ language: "en" });

      expect(enResult.rawTranscript).toBeDefined();
      expect(enResult.confidence).toBeGreaterThan(0.9);
      expect(enResult.providerMeta.provider).toBe("deterministic-demo");

      const teResult = await provider.transcribe({ language: "te" });
      expect(teResult.language).toBe("te");
      expect(teResult.englishTranslation).toBeDefined();
    });

    it("resilient speech provider falls back when live speech throws", async () => {
      const failingSpeech: SpeechProvider = {
        name: "gemini-audio",
        transcribe: async () => {
          throw new Error("Audio socket error");
        },
      };

      const fallback = new DeterministicDemoSpeechProvider();
      const resilient = new ResilientSpeechProvider(failingSpeech, fallback, 1000);

      const result = await resilient.transcribe({ language: "en" });
      expect(result).toBeDefined();
      expect(result.providerMeta.fallbackUsed).toBe(true);
      expect(result.providerMeta.fallbackReason).toContain("Audio socket error");
    });
  });

  describe("OCR Provider Architecture", () => {
    it("extracts prescription medications with candidate status and disclaimer", async () => {
      const provider = new DeterministicDemoOCRProvider();
      const result = await provider.extract({ documentId: "doc-0001" });

      expect(result.documentType).toBe("prescription");
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.disclaimer).toBe("Extracted from uploaded document — verify before use.");
      expect(result.extractedData?.medications?.length).toBeGreaterThan(0);
      expect(result.providerMeta.provider).toBe("deterministic-demo");
    });

    it("resilient OCR provider falls back when live OCR throws", async () => {
      const failingOCR: OCRProvider = {
        name: "gemini-vision",
        extract: async () => {
          throw new Error("Vision API quota exceeded");
        },
      };

      const fallback = new DeterministicDemoOCRProvider();
      const resilient = new ResilientOCRProvider(failingOCR, fallback, 1000);

      const result = await resilient.extract({ documentId: "doc-0001" });
      expect(result).toBeDefined();
      expect(result.providerMeta.fallbackUsed).toBe(true);
      expect(result.providerMeta.fallbackReason).toContain("Vision API quota exceeded");
      expect(result.disclaimer).toBe("Extracted from uploaded document — verify before use.");
    });
  });
});
