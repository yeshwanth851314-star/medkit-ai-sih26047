import { z } from "zod";

export const clinicalSummarySchema = z.object({
  summaryType: z.enum(["deterministic", "ai_assisted"]),
  patientContext: z.object({
    name: z.string(),
    code: z.string(),
    gender: z.string(),
    ageOrDob: z.string().optional().nullable(),
  }),
  chiefComplaint: z.string(),
  hpiNarrative: z.string(),
  pertinentPositives: z.array(z.string()),
  pertinentNegatives: z.array(z.string()),
  activeMedications: z.array(z.string()),
  knownAllergies: z.array(z.string()),
  vitalsSummary: z.string(),
  redFlags: z.array(z.string()),
  missingInformation: z.array(z.string()),
  provenanceMap: z.record(z.string()),
  disclaimer: z.string(),
  status: z.enum(["draft", "reviewed", "confirmed"]).default("draft"),
  generatedAt: z.string(),
});

export type ClinicalSummary = z.infer<typeof clinicalSummarySchema>;
