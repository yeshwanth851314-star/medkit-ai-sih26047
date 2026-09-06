import { describe, it, expect } from "vitest";
import { processSpeechTranscription } from "../../src/features/voice/voice-service";
import { transcriptionResponseSchema } from "../../src/features/voice/types";

describe("Phase 7: Voice Modality & Speech-to-Text Tests", () => {
  it("transcribes English clinical complaint with high confidence", async () => {
    const result = await processSpeechTranscription({ mockId: "tr-0001" });

    expect(result).toBeDefined();
    expect(result.language).toBe("en");
    expect(result.rawTranscript).toContain("dry cough for about two weeks");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.status).toBe("confirmed");
    expect(result.requiresManualEdit).toBe(false);

    const validated = transcriptionResponseSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it("processes Telugu regional audio and provides English translation", async () => {
    const result = await processSpeechTranscription({ mockId: "tr-0002" });

    expect(result).toBeDefined();
    expect(result.language).toBe("te");
    expect(result.rawTranscript).toContain("ఛాతీలో తీవ్రమైన నొప్పి");
    expect(result.englishTranslation).toContain("Severe chest pain");
    expect(result.normalizedEntities?.complaint).toBe("chest pain");

    const validated = transcriptionResponseSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it("detects low-confidence / noisy speech and requires manual review", async () => {
    const result = await processSpeechTranscription({ mockId: "tr-0003" });

    expect(result).toBeDefined();
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.status).toBe("needs_review");
    expect(result.requiresManualEdit).toBe(true);
    expect(result.warning).toContain("confidence is low");

    const validated = transcriptionResponseSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it("CRITICAL CLINICAL SAFETY: fails closed when real patient audio encounters provider error, never fabricating synthetic text", async () => {
    const { ResilientSpeechProvider, DeterministicDemoSpeechProvider } = await import(
      "../../src/features/voice/speech-provider"
    );

    const failingPrimary = {
      name: "gemini-audio" as const,
      transcribe: async () => {
        throw new Error("Temporary network timeout");
      },
    };

    const fallback = new DeterministicDemoSpeechProvider();
    const resilient = new ResilientSpeechProvider(failingPrimary, fallback, 1000);

    // Simulated real patient audio (base64 string of recorded audio bytes)
    const realPatientAudio = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAA";

    // Expect system to fail closed and throw, NOT silently substitute cough/fever fixture
    await expect(
      resilient.transcribe({
        audioBase64: realPatientAudio,
        language: "te",
      })
    ).rejects.toThrow(/live audio cannot fall back to synthetic text/i);
  });

  it("allows deterministic fallback ONLY when no real patient audio was submitted (demo simulation mode)", async () => {
    const { ResilientSpeechProvider, DeterministicDemoSpeechProvider } = await import(
      "../../src/features/voice/speech-provider"
    );

    const failingPrimary = {
      name: "gemini-audio" as const,
      transcribe: async () => {
        throw new Error("Temporary network timeout");
      },
    };

    const fallback = new DeterministicDemoSpeechProvider();
    const resilient = new ResilientSpeechProvider(failingPrimary, fallback, 1000);

    // No audioBase64 submitted — simulated demo run
    const result = await resilient.transcribe({
      language: "en",
    });

    expect(result).toBeDefined();
    expect(result.providerMeta.fallbackUsed).toBe(true);
    expect(result.providerMeta.provider).toBe("deterministic-demo");
  });
});
