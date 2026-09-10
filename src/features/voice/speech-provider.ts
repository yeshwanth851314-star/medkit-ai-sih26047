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
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(text);
    } catch {
      throw new Error("Speech recognition model output could not be parsed as valid JSON.");
    }

    const liveSpeechModelOutputSchema = transcriptionResponseSchema.pick({
      rawTranscript: true,
      confidence: true,
    }).extend({
      rawTranscript: transcriptionResponseSchema.shape.rawTranscript.min(1, "rawTranscript cannot be empty"),
      language: transcriptionResponseSchema.shape.language.optional(),
      normalizedEntities: transcriptionResponseSchema.shape.normalizedEntities.optional(),
      englishTranslation: transcriptionResponseSchema.shape.englishTranslation.optional(),
    });

    const parseResult = liveSpeechModelOutputSchema.safeParse(rawParsed);
    if (!parseResult.success) {
      throw new Error(
        `Speech recognition output failed validation: ${parseResult.error.issues.map((i) => i.message).join(", ")}. Raw transcript or confidence was absent.`
      );
    }

    const parsed = parseResult.data;

    const result: SpeechTranscriptionResponse = {
      id: `tr-${crypto.randomUUID().slice(0, 8)}`,
      mode: "voice",
      language: parsed.language || options.language || "en",
      rawTranscript: parsed.rawTranscript,
      confidence: parsed.confidence,
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
 * Unavailable Speech Provider for production environments without configured API credentials
 */
export class UnavailableSpeechProvider implements SpeechProvider {
  readonly name = "gemini-audio" as const;

  async transcribe(_options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse> {
    throw new Error(
      "Speech recognition service unavailable: live AI credentials are not configured in production mode."
    );
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

    // Reject client-supplied mockId switches when operating in production mode
    if (options.mockId) {
      if (!env.isDemoMode) {
        throw new Error("Synthetic fixture selection (mockId) is strictly prohibited in production mode.");
      }
      if (!hasRealAudio) {
        return this.fallback.transcribe(options);
      }
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
      // If real patient audio was submitted or in production mode,
      // NEVER silently substitute fabricated synthetic text.
      if (hasRealAudio || !env.isDemoMode) {
        console.error(
          `[Clinical Safety Alert] Speech provider failed on live audio: ${err.message}. Refusing synthetic fallback.`
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

  // In production mode, if live credentials are not available, fail closed
  if (!env.isDemoMode) {
    return new UnavailableSpeechProvider();
  }

  return new DeterministicDemoSpeechProvider();
}
