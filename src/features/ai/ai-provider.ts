import { GoogleGenAI } from "@google/genai";
import { env } from "@/config/env";
import { ClinicalSummary } from "@/features/summaries/types";
import { generateDeterministicSummary } from "@/features/summaries/summary-service";
import { getCaseById, getPatientById } from "@/lib/db/supabase";
import type { AuthUser } from "@/features/auth/types";

export interface AIProviderMeta {
  provider: "gemini-2.5-flash" | "deterministic-demo";
  latencyMs: number;
  tokensUsed?: number;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

export interface AIClinicalSummaryResult extends ClinicalSummary {
  providerMeta: AIProviderMeta;
}

export interface AIProvider {
  readonly name: "gemini-2.5-flash" | "deterministic-demo";
  generateClinicalSummary(caseId: string, actorOrToken?: AuthUser | string | null): Promise<AIClinicalSummaryResult>;
}

const CLINICAL_SYSTEM_INSTRUCTION = `You are an AI Clinical Assistant for MedKit AI, an intelligent clinical case-taking and physician copilot platform (SIH26047).
CRITICAL CLINICAL BOUNDARY & SAFETY MANDATE:
1. NON-AUTONOMOUS COPILOT: Never state "AI diagnosed X" or prescribe medical treatment autonomously.
2. SYNTHESIS ONLY: Your task is to organize verified patient answers, documents, and HPI into a clear, structured clinical intake summary for attending physician review.
3. PROVENANCE: Every statement must reflect source provenance ('patient', 'clinician', 'ocr', or 'ai').
4. SAFETY: Identify potential clinical gaps (e.g. missing vitals, allergy status unconfirmed) under missingInformation.
5. MANDATORY DISCLAIMER: Always output the exact disclaimer: "AI-assisted summary — clinician review required."`;

/**
 * Live Gemini 2.5 Flash Provider using official @google/genai SDK
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini-2.5-flash" as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateClinicalSummary(caseId: string, actorOrToken?: AuthUser | string | null): Promise<AIClinicalSummaryResult> {
    const startTime = Date.now();
    const c = await getCaseById(caseId, actorOrToken);
    if (!c) throw new Error("Case not found");

    const patient = await getPatientById(c.patient_id, actorOrToken);
    if (!patient) throw new Error("Patient not found");

    const clinicalInput = {
      patient: {
        name: patient.full_name,
        code: patient.patient_code,
        dob: patient.date_of_birth,
        gender: patient.gender,
      },
      chiefComplaint: c.chief_complaint,
      hpi: c.hpi,
      medications: c.medication_history,
      allergies: c.allergy_history,
      vitals: c.examination,
      redFlags: c.red_flags,
      provenance: c.provenance,
    };

    const prompt = `Synthesize this patient clinical intake case into a structured JSON clinical intake summary:
${JSON.stringify(clinicalInput, null, 2)}

Return a JSON object conforming to:
{
  "hpiNarrative": string,
  "pertinentPositives": string[],
  "pertinentNegatives": string[],
  "activeMedications": string[],
  "knownAllergies": string[],
  "vitalsSummary": string,
  "missingInformation": string[]
}`;

    const response = await this.client.models.generateContent({
      model: env.geminiModel || "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const latencyMs = Date.now() - startTime;
    const responseText = response.text || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.warn("Gemini output was not valid JSON, using deterministic extraction");
    }

    const baseline = await generateDeterministicSummary(caseId);

    const summary: AIClinicalSummaryResult = {
      ...baseline,
      summaryType: "ai_assisted",
      hpiNarrative: parsed.hpiNarrative || baseline.hpiNarrative,
      pertinentPositives: parsed.pertinentPositives || baseline.pertinentPositives,
      pertinentNegatives: parsed.pertinentNegatives || baseline.pertinentNegatives,
      activeMedications: parsed.activeMedications || baseline.activeMedications,
      knownAllergies: parsed.knownAllergies || baseline.knownAllergies,
      vitalsSummary: parsed.vitalsSummary || baseline.vitalsSummary,
      missingInformation: parsed.missingInformation || baseline.missingInformation,
      disclaimer: "AI-assisted summary — clinician review required.",
      status: "reviewed",
      providerMeta: {
        provider: this.name,
        latencyMs,
        fallbackUsed: false,
      },
    };

    return summary;
  }
}

/**
 * Deterministic Demo AI Provider (Offline / Guaranteed Fallback)
 */
export class DeterministicDemoAIProvider implements AIProvider {
  readonly name = "deterministic-demo" as const;

  async generateClinicalSummary(caseId: string, actorOrToken?: AuthUser | string | null): Promise<AIClinicalSummaryResult> {
    const startTime = Date.now();
    const summary = await generateDeterministicSummary(caseId, actorOrToken);
    const latencyMs = Date.now() - startTime;

    return {
      ...summary,
      summaryType: "deterministic",
      providerMeta: {
        provider: this.name,
        latencyMs,
        fallbackUsed: false,
      },
    };
  }
}

/**
 * Resilient AI Provider wrapper with strict 8s timeout and automatic deterministic fallback
 */
export class ResilientAIProvider implements AIProvider {
  readonly name: "gemini-2.5-flash" | "deterministic-demo";

  constructor(
    private primary: AIProvider,
    private fallback: AIProvider,
    private timeoutMs: number = 8000
  ) {
    this.name = primary.name;
  }

  async generateClinicalSummary(caseId: string, actorOrToken?: AuthUser | string | null): Promise<AIClinicalSummaryResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`AI provider '${this.primary.name}' timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      )
    );

    try {
      return await Promise.race([
        this.primary.generateClinicalSummary(caseId, actorOrToken),
        timeoutPromise,
      ]);
    } catch (err: any) {
      console.warn(
        `Primary AI provider '${this.primary.name}' failed or timed out: ${err.message}. Falling back to '${this.fallback.name}'`
      );
      const fallbackResult = await this.fallback.generateClinicalSummary(caseId, actorOrToken);
      return {
        ...fallbackResult,
        providerMeta: {
          provider: this.fallback.name,
          latencyMs: fallbackResult.providerMeta.latencyMs,
          fallbackUsed: true,
          fallbackReason: err.message || "Primary provider error",
        },
      };
    }
  }
}

/**
 * AI Provider Factory with automatic capability detection
 */
export function getAIProvider(): AIProvider {
  const isKeyAvailable = Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 5 && env.geminiApiKey !== "your-gemini-api-key");
  const useLive = isKeyAvailable && (!env.isDemoMode || env.preferLiveProviders);

  if (useLive) {
    const primary = new GeminiProvider(env.geminiApiKey!);
    const fallback = new DeterministicDemoAIProvider();
    return new ResilientAIProvider(primary, fallback, 8000);
  }

  return new DeterministicDemoAIProvider();
}
