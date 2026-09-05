import { z } from "zod";
import { CaseStatus, CaseType, ClinicalSource } from "@/types/database";

export const medicationEntrySchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  source: z.enum(["patient", "clinician", "ocr", "ai", "system/rule"]).default("patient"),
});

export const allergyEntrySchema = z.object({
  substance: z.string().min(1, "Allergen substance is required"),
  reaction: z.string().optional().nullable(),
  severity: z.enum(["Mild", "Moderate", "Severe"]).default("Mild"),
  source: z.enum(["patient", "clinician", "ocr", "ai", "system/rule"]).default("patient"),
});

export const hpiSchema = z.object({
  onset: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  character: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  radiation: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  aggravating_factors: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  relieving_factors: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  associated_symptoms: z.array(z.string()).optional().nullable(),
  denies: z.array(z.string()).optional().nullable(),
});

export const examinationSchema = z.object({
  blood_pressure: z.string().optional().nullable(),
  pulse: z.string().optional().nullable(),
  temperature: z.string().optional().nullable(),
  respiratory_rate: z.string().optional().nullable(),
  spo2: z.string().optional().nullable(),
  general: z.string().optional().nullable(),
  systemic: z.string().optional().nullable(),
  vitals: z.record(z.any()).optional().nullable(),
});

export const assessmentPlanSchema = z.object({
  summary: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
});

export const caseInputSchema = z.object({
  patientId: z.string().uuid("Valid patient UUID required"),
  caseType: z.enum(["general", "ayush"]).default("general"),
  patientLanguage: z.string().default("en"),
  chiefComplaint: z.string().min(3, "Chief complaint must be at least 3 characters"),
  rawPatientComplaint: z.string().optional().nullable(),
  hpi: hpiSchema.optional().nullable(),
  pastHistory: z.record(z.any()).optional().nullable(),
  familyHistory: z.record(z.any()).optional().nullable(),
  personalHistory: z.record(z.any()).optional().nullable(),
  medicationHistory: z.array(medicationEntrySchema).optional().nullable(),
  allergyHistory: z.array(allergyEntrySchema).optional().nullable(),
  examination: examinationSchema.optional().nullable(),
  assessmentPlan: assessmentPlanSchema.optional().nullable(),
  ayushAssessment: z.record(z.any()).optional().nullable(),
  redFlags: z.array(z.record(z.any())).optional().nullable(),
  red_flags: z.array(z.record(z.any())).optional().nullable(),
  status: z.enum(["draft", "final"]).default("draft"),
  provenance: z.record(z.enum(["patient", "clinician", "ocr", "ai", "system/rule"])).optional().nullable(),
});

export type CaseInput = z.infer<typeof caseInputSchema>;
