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

export const candidateStatusSchema = z.enum(["candidate", "verified", "rejected"]);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

export const extractedMedicationSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  dosage: z.string(),
  duration: z.string().optional(),
  pageRef: z.number().default(1),
  confidence: z.number().min(0).max(1),
  status: candidateStatusSchema.default("candidate"),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
  rejected_by: z.string().optional(),
  rejected_at: z.string().optional(),
});

export const extractedLabTestSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  value: z.string(),
  reference: z.string().optional(),
  flag: z.enum(["normal", "high", "low", "borderline"]).default("normal"),
  confidence: z.number().min(0).max(1),
  status: candidateStatusSchema.default("candidate"),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
  rejected_by: z.string().optional(),
  rejected_at: z.string().optional(),
});

export interface CandidateReviewAction {
  candidateId?: string;
  candidateName?: string;
  candidateType?: "medication" | "test";
  action: "accept" | "reject" | "edit";
  updatedValue?: string;
  verifierId?: string;
}

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
