import { GoogleGenAI } from "@google/genai";
import { env } from "@/config/env";
import { TranscriptionResult, transcriptionResponseSchema } from "./types";
import { SYNTHETIC_TRANSCRIPTS } from "./voice-service";

export interface SpeechTranscriptionOptions {
  audioBase64?: string;
  mimeType?: string;
  language?: "en" | "te" | "hi";
  mockId?: string;
}

export interface SpeechProviderMeta {
  provider: "gemini-audio" | "deterministic-demo";
  latencyMs: number;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

export interface SpeechTranscriptionResponse extends TranscriptionResult {
  providerMeta: SpeechProviderMeta;
}

export interface SpeechProvider {
  readonly name: "gemini-audio" | "deterministic-demo";
  transcribe(options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse>;
}

/**
 * Live Speech Provider using Gemini 2.5 Flash Multimodal Audio Input
 */
export class LiveSpeechProvider implements SpeechProvider {
  readonly name = "gemini-audio" as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async transcribe(options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse> {
    const startTime = Date.now();

    if (!options.audioBase64) {
      throw new Error("Live transcription requires audioBase64 data.");
    }

    const prompt = `You are a clinical speech transcription model for MedKit AI.
Transcribe the following patient audio recording accurately in its original language (${options.language || "en"}).
Output ONLY a JSON object with this exact structure:
{
  "rawTranscript": "exact words spoken",
  "confidence": 0.95,
  "language": "${options.language || "en"}",
  "normalizedEntities": {
    "complaint": "primary symptom",
    "duration": "duration if stated or null",
    "associated_symptoms": ["any additional symptoms mentioned"]
  },
  "englishTranslation": "English translation if spoken in regional Indian language (e.g. Telugu) or null"
}`;

    const cleanBase64 = options.audioBase64.replace(/^data:[^;]+;base64,/, "");

    const response = await this.client.models.generateContent({
      model: env.geminiModel || "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: options.mimeType || "audio/webm",
            data: cleanBase64,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const latencyMs = Date.now() - startTime;
    const text = response.text || "{}";
    const parsed = JSON.parse(text);

    const result: SpeechTranscriptionResponse = {
      id: `tr-${crypto.randomUUID().slice(0, 8)}`,
      mode: "voice",
      language: options.language || "en",
      rawTranscript: parsed.rawTranscript || "Clinical audio transcribed successfully",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95,
      status: parsed.confidence < 0.6 ? "needs_review" : "confirmed",
      requiresManualEdit: parsed.confidence < 0.6,
      englishTranslation: parsed.englishTranslation || undefined,
      normalizedEntities: parsed.normalizedEntities || null,
      providerMeta: {
        provider: this.name,
        latencyMs,
        fallbackUsed: false,
      },
    };

    return transcriptionResponseSchema.parse(result) as SpeechTranscriptionResponse;
  }
}

/**
 * Deterministic Demo Speech Provider (Offline Synthetic Fixtures)
 */
export class DeterministicDemoSpeechProvider implements SpeechProvider {
  readonly name = "deterministic-demo" as const;

  async transcribe(options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse> {
    const startTime = Date.now();

    if (options.mockId) {
      const match = SYNTHETIC_TRANSCRIPTS.find((t) => t.id === options.mockId);
      if (match) {
        return {
          ...transcriptionResponseSchema.parse(match),
          providerMeta: {
            provider: this.name,
            latencyMs: Date.now() - startTime,
            fallbackUsed: false,
          },
        };
      }
    }

    const template = options.language === "te" ? SYNTHETIC_TRANSCRIPTS[1] : SYNTHETIC_TRANSCRIPTS[0];
    const parsed = transcriptionResponseSchema.parse(template);

    return {
      ...parsed,
      id: `tr-${crypto.randomUUID().slice(0, 8)}`,
      providerMeta: {
        provider: this.name,
        latencyMs: Date.now() - startTime,
        fallbackUsed: false,
      },
    };
  }
}

/**
 * Resilient Speech Provider wrapper with 8s timeout and automatic fallback
 */
export class ResilientSpeechProvider implements SpeechProvider {
  readonly name: "gemini-audio" | "deterministic-demo";

  constructor(
    private primary: SpeechProvider,
    private fallback: SpeechProvider,
    private timeoutMs: number = 8000
  ) {
    this.name = primary.name;
  }

  async transcribe(options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse> {
    const hasRealAudio = Boolean(options.audioBase64 && options.audioBase64.trim().length > 50);

    // If client requested mockId explicitly without real audio, bypass live API directly (demo fixtures only)
    if (options.mockId && !hasRealAudio) {
      return this.fallback.transcribe(options);
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Speech provider '${this.primary.name}' timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      )
    );

    try {
      return await Promise.race([this.primary.transcribe(options), timeoutPromise]);
    } catch (err: any) {
      // CLINICAL SAFETY ENFORCEMENT:
      // If real patient audio was submitted, NEVER silently substitute fabricated synthetic text.
      // Doing so could mask critical medical emergencies (e.g. replacing acute chest pain with cough).
      if (hasRealAudio) {
        console.error(
          `[Clinical Safety Alert] Speech provider failed on real audio: ${err.message}. Refusing synthetic fallback.`
        );
        throw new Error(
          `Speech recognition service unavailable (${err.message}). For patient safety, live audio cannot fall back to synthetic text. Please retry or enter your symptoms manually.`
        );
      }

      console.warn(`Speech provider '${this.primary.name}' failed: ${err.message}. Falling back to demo provider.`);
      const fallbackResult = await this.fallback.transcribe(options);
      return {
        ...fallbackResult,
        providerMeta: {
          provider: this.fallback.name,
          latencyMs: fallbackResult.providerMeta.latencyMs,
          fallbackUsed: true,
          fallbackReason: err.message || "Primary speech provider error",
        },
      };
    }
  }
}

/**
 * Speech Provider Factory
 */
export function getSpeechProvider(): SpeechProvider {
  const isKeyAvailable = Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 5 && env.geminiApiKey !== "your-gemini-api-key");
  const useLive = isKeyAvailable && (!env.isDemoMode || env.preferLiveProviders);

  if (useLive) {
    const primary = new LiveSpeechProvider(env.geminiApiKey!);
    const fallback = new DeterministicDemoSpeechProvider();
    return new ResilientSpeechProvider(primary, fallback, 8000);
  }

  return new DeterministicDemoSpeechProvider();
}
