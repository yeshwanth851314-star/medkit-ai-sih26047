import { z } from "zod";

export type SupportedLanguage = "en" | "te" | "hi";

export const supportedLanguageSchema = z.enum(["en", "te", "hi"]);

export interface BilingualEntry {
  id: string;
  originalText: string;
  originalLanguage: SupportedLanguage;
  normalizedEnglish: string;
  confidence: number;
  provenance: "patient" | "clinician" | "ai";
  clinicalEntities?: Record<string, any> | null;
  isVerified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export const bilingualEntrySchema = z.object({
  id: z.string(),
  originalText: z.string().min(1, "Original text is required"),
  originalLanguage: supportedLanguageSchema,
  normalizedEnglish: z.string().min(1, "Normalized English translation is required"),
  confidence: z.number().min(0).max(1),
  provenance: z.enum(["patient", "clinician", "ai"]).default("patient"),
  clinicalEntities: z.record(z.any()).optional().nullable(),
  isVerified: z.boolean().default(false),
  verifiedBy: z.string().optional().nullable(),
  verifiedAt: z.string().optional().nullable(),
});
