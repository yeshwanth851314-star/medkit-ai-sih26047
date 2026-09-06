import { z } from "zod";

export type AuditAction =
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "CREATE_PATIENT"
  | "READ_PATIENT"
  | "UPDATE_PATIENT"
  | "CREATE_CASE"
  | "READ_CASE"
  | "UPDATE_CASE"
  | "FINALIZE_CASE"
  | "ACKNOWLEDGE_RED_FLAG"
  | "UPLOAD_DOCUMENT"
  | "READ_DOCUMENT"
  | "CONFIRM_DOCUMENT_OCR"
  | "READ_TIMELINE"
  | "CONSENT_RECORDED"
  | "CONSENT_REVOKED"
  | "VERIFY_AYUSH"
  | "VERIFY_MULTILINGUAL"
  | "EXPORT_FHIR"
  | "SYNC_OFFLINE_OPERATION";


export interface ClinicalAuditLog {
  id: string;
  actor_id: string;
  actor_role?: string;
  action: AuditAction;
  resource_type: "patients" | "cases" | "documents" | "auth" | "fhir" | "consents" | "transcripts";
  resource_id: string;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export const clinicalAuditSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string(),
  actor_role: z.string().optional(),
  action: z.string(),
  resource_type: z.enum(["patients", "cases", "documents", "auth", "fhir", "consents", "transcripts"]),
  resource_id: z.string(),
  metadata: z.record(z.any()).optional().nullable(),
  created_at: z.string(),
});
