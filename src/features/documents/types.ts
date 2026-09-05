import { z } from "zod";

export const documentTypeSchema = z.enum(["prescription", "lab", "discharge", "other"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const processingStatusSchema = z.enum([
  "uploaded",
  "processing",
  "extracted",
  "review",
  "confirmed",
  "failed",
]);
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;

export const extractedMedicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  duration: z.string().optional(),
  pageRef: z.number().default(1),
  confidence: z.number().min(0).max(1),
  status: z.enum(["candidate", "verified"]).default("candidate"),
});

export const extractedLabTestSchema = z.object({
  name: z.string(),
  value: z.string(),
  reference: z.string().optional(),
  flag: z.enum(["normal", "high", "low", "borderline"]).default("normal"),
  confidence: z.number().min(0).max(1),
});

export const documentExtractionResultSchema = z.object({
  documentId: z.string(),
  documentType: documentTypeSchema,
  confidence: z.number().min(0).max(1),
  extractedData: z.record(z.any()),
  disclaimer: z.string(),
  status: processingStatusSchema,
  errorMessage: z.string().optional().nullable(),
  providerMeta: z.record(z.any()).optional(),
});

export type DocumentExtractionResult = z.infer<typeof documentExtractionResultSchema>;
