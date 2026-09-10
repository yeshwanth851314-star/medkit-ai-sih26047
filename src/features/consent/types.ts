import { z } from "zod";

export const consentScopeEnum = z.enum([
  "voice_recording",
  "document_extraction",
  "ai_summary",
  "clinical_care",
]);

export const consentMethodEnum = z.enum([
  "digital_signature",
  "touch_acknowledgement",
  "verbal_recorded",
]);

export const consentRecordSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  case_id: z.string().uuid().optional().nullable(),
  purpose: z.string().default("clinical_care_and_case_taking"),
  scope: z.array(z.string()).default(["voice_recording", "document_extraction", "ai_summary"]),
  language: z.enum(["en", "te"]).default("en"),
  consent_method: consentMethodEnum.default("touch_acknowledgement"),
  consent_version: z.string().default("v1.0"),
  consent_timestamp: z.string(),
  status: z.enum(["granted", "revoked"]).default("granted"),
  granted_at: z.string().optional().nullable(),
  actor_id: z.string().optional().nullable(),
  revocation_reason: z.string().optional().nullable(),
  revoked: z.boolean().default(false),
  revoked_at: z.string().optional().nullable(),
  created_at: z.string(),
});

export type ConsentRecord = z.infer<typeof consentRecordSchema>;

export interface RecordConsentInput {
  patientId: string;
  caseId?: string | null;
  purpose?: string;
  scope?: string[];
  language?: "en" | "te";
  consentMethod?: "digital_signature" | "touch_acknowledgement" | "verbal_recorded";
  consentVersion?: string;
  actorId?: string;
  actorRole?: string;
  actorOrToken?: any;
}
