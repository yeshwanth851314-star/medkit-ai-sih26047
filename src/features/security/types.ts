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
  | "AMEND_CASE"
  | "ACKNOWLEDGE_RED_FLAG"
  | "UPLOAD_DOCUMENT"
  | "READ_DOCUMENT"
  | "CONFIRM_DOCUMENT_OCR"
  | "CONFIRM_SUMMARY"
  | "READ_TIMELINE"
  | "CONSENT_RECORDED"
  | "CONSENT_REVOKED"
  | "VERIFY_AYUSH"
  | "VERIFY_MULTILINGUAL"
  | "EXPORT_FHIR"
  | "SYNC_OFFLINE_OPERATION"
  | "KIOSK_PROVISIONED"
  | "KIOSK_SESSION_REVOKED"
  | "CLINICIAN_ONBOARDING_INITIATED"
  | "PROFESSIONAL_REGISTRY_VERIFIED"
  | "PROFESSIONAL_REGISTRY_REJECTED"
  | "CLINICIAN_MFA_ENROLLED"
  | "CLINICIAN_FACILITY_APPROVED"
  | "CLINICIAN_FACILITY_REJECTED"
  | "REMOTE_INVITE_CREATED"
  | "REMOTE_INVITE_REVOKED"
  | "APPOINTMENT_BOOKED"
  | "PATIENT_CHECKED_IN"
  | "QUEUE_ENTRY_CREATED"
  | "QUEUE_CALLED"
  | "CONSULTATION_STARTED"
  | "CONSULTATION_COMPLETED"
  | "QUEUE_STATUS_UPDATED"
  | "DIAGNOSTIC_ORDER_CREATED"
  | "DIAGNOSTIC_ORDER_ACCEPTED"
  | "DIAGNOSTIC_SAMPLE_COLLECTED"
  | "DIAGNOSTIC_RESULT_UPLOADED"
  | "DIAGNOSTIC_RESULT_VERIFIED"
  | "DIAGNOSTIC_RESULT_REVIEWED"
  | "DIAGNOSTIC_STATUS_UPDATED"
  | "PRESCRIPTION_CREATED"
  | "PRESCRIPTION_FINALIZED"
  | "MEDICINE_PARTIALLY_DISPENSED"
  | "MEDICINE_DISPENSED"
  | "DISPENSE_CONFIRMED"
  | "PHARMACY_CLARIFICATION_RAISED"
  | "PHARMACY_CLARIFICATION_RESOLVED";

export interface ClinicalAuditLog {
  id: string;
  actor_id: string;
  actor_role?: string;
  action: AuditAction;
  resource_type:
    | "patients"
    | "cases"
    | "documents"
    | "auth"
    | "fhir"
    | "consents"
    | "transcripts"
    | "kiosk_instances"
    | "intake_sessions"
    | "clinician_onboarding"
    | "remote_intake_invitations"
    | "appointments"
    | "opd_queues"
    | "diagnostic_orders"
    | "diagnostic_results"
    | "prescriptions"
    | "dispenses"
    | "pharmacy_inventory";
  resource_id: string;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export const clinicalAuditSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string(),
  actor_role: z.string().optional(),
  action: z.string(),
  resource_type: z.enum([
    "patients",
    "cases",
    "documents",
    "auth",
    "fhir",
    "consents",
    "transcripts",
    "kiosk_instances",
    "intake_sessions",
    "clinician_onboarding",
    "remote_intake_invitations",
    "appointments",
    "opd_queues",
    "diagnostic_orders",
    "diagnostic_results",
    "prescriptions",
    "dispenses",
    "pharmacy_inventory",
  ]),
  resource_id: z.string(),
  metadata: z.record(z.any()).optional().nullable(),
  created_at: z.string(),
});
