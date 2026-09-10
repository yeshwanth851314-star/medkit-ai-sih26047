import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/config/env";
import { DocumentExtractionResult, documentExtractionResultSchema } from "./types";
import { SYNTHETIC_DOCUMENT_FIXTURES } from "./document-service";

export interface OCRExtractionOptions {
  documentId: string;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
  mockId?: string;
}

export interface OCRProviderMeta {
  provider: "gemini-vision" | "deterministic-demo";
  latencyMs: number;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

export interface OCRExtractionResponse extends DocumentExtractionResult {
  providerMeta: OCRProviderMeta;
}

export interface OCRProvider {
  readonly name: "gemini-vision" | "deterministic-demo";
  extract(options: OCRExtractionOptions): Promise<OCRExtractionResponse>;
}

/**
 * Live OCR Provider using Gemini 2.5 Flash Vision Multimodal Extraction
 */
export class LiveOCRProvider implements OCRProvider {
  readonly name = "gemini-vision" as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async extract(options: OCRExtractionOptions): Promise<OCRExtractionResponse> {
    const startTime = Date.now();

    if (!options.imageBase64) {
      throw new Error("Live document extraction requires imageBase64 data.");
    }

    const cleanBase64 = options.imageBase64.replace(/^data:[^;]+;base64,/, "");

    const prompt = `You are a medical document extraction system for MedKit AI.
Analyze this medical document and extract all clinical entities with high accuracy.
Output ONLY a JSON object conforming strictly to this format:
{
  "documentType": "prescription" or "lab" or "discharge" or "other",
  "confidence": 0.95,
  "extractedData": {
    "doctor_name": "Doctor name or null",
    "date": "YYYY-MM-DD or null",
    "medications": [
      {
        "name": "Medication name with strength",
        "dosage": "Dosage frequency or null",
        "duration": "Duration or null",
        "confidence": 0.95,
        "status": "candidate"
      }
    ],
    "instructions": "Doctor instructions or null"
  }
}`;

    const response = await this.client.models.generateContent({
      model: env.geminiModel || "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: options.mimeType || "image/jpeg",
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
      throw new Error("OCR model output could not be parsed as valid JSON.");
    }

    const liveOcrModelOutputSchema = documentExtractionResultSchema.pick({
      documentType: true,
      confidence: true,
      extractedData: true,
    }).extend({
      extractedData: z.record(z.any()).refine((data) => Object.keys(data).length > 0, {
        message: "extractedData cannot be empty",
      }),
    });

    const parseResult = liveOcrModelOutputSchema.safeParse(rawParsed);
    if (!parseResult.success) {
      throw new Error(
        `OCR extraction output failed validation: ${parseResult.error.issues.map((i) => i.message).join(", ")}. Document type, confidence, or non-empty extracted data was absent.`
      );
    }

    const parsed = parseResult.data;

    const result: OCRExtractionResponse = {
      documentId: options.documentId,
      documentType: parsed.documentType,
      confidence: parsed.confidence,
      extractedData: parsed.extractedData,
      disclaimer: "Extracted from uploaded document — verify before use.",
      status: "extracted",
      providerMeta: {
        provider: this.name,
        latencyMs,
        fallbackUsed: false,
      },
    };

    return documentExtractionResultSchema.parse(result) as OCRExtractionResponse;
  }
}

/**
 * Deterministic Demo OCR Provider (Offline Synthetic Fixtures)
 */
export class DeterministicDemoOCRProvider implements OCRProvider {
  readonly name = "deterministic-demo" as const;

  async extract(options: OCRExtractionOptions): Promise<OCRExtractionResponse> {
    const startTime = Date.now();
    const fixtureKey = options.mockId || options.documentId;
    const match = SYNTHETIC_DOCUMENT_FIXTURES[fixtureKey] || SYNTHETIC_DOCUMENT_FIXTURES["doc-0001"];

    const result: OCRExtractionResponse = {
      ...match,
      documentId: options.documentId,
      disclaimer: "Extracted from uploaded document — verify before use.",
      providerMeta: {
        provider: this.name,
        latencyMs: Date.now() - startTime,
        fallbackUsed: false,
      },
    };

    return documentExtractionResultSchema.parse(result) as OCRExtractionResponse;
  }
}

/**
 * Unavailable OCR Provider for production environments without configured API credentials
 */
export class UnavailableOCRProvider implements OCRProvider {
  readonly name = "gemini-vision" as const;

  async extract(_options: OCRExtractionOptions): Promise<OCRExtractionResponse> {
    throw new Error(
      "Document OCR service unavailable: live AI credentials are not configured in production mode."
    );
  }
}

/**
 * Resilient OCR Provider wrapper with 8s timeout and automatic fallback
 */
export class ResilientOCRProvider implements OCRProvider {
  readonly name: "gemini-vision" | "deterministic-demo";

  constructor(
    private primary: OCRProvider,
    private fallback: OCRProvider,
    private timeoutMs: number = 8000
  ) {
    this.name = primary.name;
  }

  async extract(options: OCRExtractionOptions): Promise<OCRExtractionResponse> {
    const hasRealImage = Boolean(options.imageBase64 && options.imageBase64.trim().length > 50);

    // Reject client-supplied mockId switches when operating in production mode
    if (options.mockId) {
      if (!env.isDemoMode) {
        throw new Error("Synthetic fixture selection (mockId) is strictly prohibited in production mode.");
      }
      if (!hasRealImage) {
        return this.fallback.extract(options);
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`OCR provider '${this.primary.name}' timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      )
    );

    try {
      return await Promise.race([this.primary.extract(options), timeoutPromise]);
    } catch (err: any) {
      // CRITICAL CLINICAL SAFETY:
      // If real patient document image was submitted or in production mode,
      // NEVER silently substitute fabricated synthetic medications or lab values.
      if (hasRealImage || !env.isDemoMode) {
        console.error(
          `[Clinical Safety Alert] OCR provider failed on live document: ${err.message}. Refusing synthetic fallback.`
        );
        throw new Error(
          `Document OCR extraction unavailable (${err.message}). For patient safety, live medical records cannot fall back to synthetic clinical fixtures. Please enter clinical details manually or retry.`
        );
      }

      console.warn(`OCR provider '${this.primary.name}' failed: ${err.message}. Falling back to demo provider.`);
      const fallbackResult = await this.fallback.extract(options);
      return {
        ...fallbackResult,
        providerMeta: {
          provider: this.fallback.name,
          latencyMs: fallbackResult.providerMeta.latencyMs,
          fallbackUsed: true,
          fallbackReason: err.message || "Primary OCR provider error",
        },
      };
    }
  }
}

/**
 * OCR Provider Factory
 */
export function getOCRProvider(): OCRProvider {
  const isKeyAvailable = Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 5 && env.geminiApiKey !== "your-gemini-api-key");
  const useLive = isKeyAvailable && (!env.isDemoMode || env.preferLiveProviders);

  if (useLive) {
    const primary = new LiveOCRProvider(env.geminiApiKey!);
    const fallback = new DeterministicDemoOCRProvider();
    return new ResilientOCRProvider(primary, fallback, 8000);
  }

  // In production mode, if live credentials are not available, fail closed
  if (!env.isDemoMode) {
    return new UnavailableOCRProvider();
  }

  return new DeterministicDemoOCRProvider();
}
