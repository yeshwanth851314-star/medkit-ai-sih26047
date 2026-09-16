export type UserRole = "doctor" | "clinician" | "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  facility_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PatientIdentityStatus =
  | "UNVERIFIED"
  | "VERIFIED_LOCAL"
  | "ABHA_LINKED"
  | "MERGE_REVIEW_REQUIRED"
  | "ARCHIVED";

export interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  date_of_birth?: string | null;
  age_estimate?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  blood_group?: string | null;
  abha_id?: string | null;
  facility_id: string;
  identity_status?: PatientIdentityStatus;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export type CaseStatus = "draft" | "final";
export type CaseType = "general" | "ayush";
export type ClinicalSource = "patient" | "clinician" | "ocr" | "ai" | "system/rule";

export interface ClinicalProvenance {
  [field: string]: ClinicalSource;
}

export interface HPIStructure {
  onset?: string | null;
  duration?: string | null;
  character?: string | null;
  location?: string | null;
  radiation?: string | null;
  severity?: string | null;
  aggravating_factors?: string | string[] | null;
  relieving_factors?: string | string[] | null;
  associated_symptoms?: string[] | null;
  denies?: string[] | null;
}

export interface MedicationEntry {
  name: string;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  source?: ClinicalSource;
  verified_by?: string | null;
}

export interface AllergyEntry {
  substance: string;
  reaction?: string | null;
  severity?: "Mild" | "Moderate" | "Severe" | null;
  source?: ClinicalSource;
  verified_by?: string | null;
}

export interface RedFlagAlert {
  rule_id: string;
  severity: "critical" | "warning";
  message: string;
  triggered_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
}

export interface AyushAssessment {
  prakriti?: string | null;
  vikriti?: string | null;
  sara?: string | null;
  samhanana?: string | null;
  pramana?: string | null;
  satmya?: string | null;
  sattva?: string | null;
  ahara_shakti?: string | null;
  vyayama_shakti?: string | null;
  vaya?: string | null;
  ahara_vihara?: {
    dietary_habits?: string | null;
    daily_routine?: string | null;
  } | null;
  source?: "clinician" | "patient" | "ai" | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface ClinicalCase {
  id: string;
  patient_id: string;
  facility_id?: string | null;
  clinician_id?: string | null;
  consent_id?: string | null;
  created_by?: string | null;
  status: CaseStatus;
  case_type: CaseType;
  patient_language: string;
  chief_complaint: string;
  raw_patient_complaint?: string | null;
  hpi?: HPIStructure | null;
  past_history?: Record<string, any> | null;
  family_history?: Record<string, any> | null;
  personal_history?: Record<string, any> | null;
  medication_history?: MedicationEntry[] | null;
  allergy_history?: AllergyEntry[] | null;
  examination?: Record<string, any> | null;
  assessment_plan?: {
    summary?: string | null;
    plan?: string | null;
  } | null;
  ai_summary?: Record<string, any> | null;
  ayush_assessment?: AyushAssessment | null;
  red_flags?: RedFlagAlert[] | null;
  provenance?: ClinicalProvenance | null;
  amendments?: CaseAmendment[] | null;
  created_at: string;
  updated_at?: string;
  finalized_at?: string | null;
  finalized_by?: string | null;
}

export interface CaseAmendment {
  id: string;
  version: number;
  actor_id: string;
  actor_name: string;
  timestamp: string;
  reason: string;
  notes: string;
}

export interface MedicalDocument {
  id: string;
  patient_id: string;
  case_id?: string | null;
  uploaded_by?: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  document_type: "prescription" | "lab" | "discharge" | "other";
  processing_status: "uploaded" | "processing" | "extracted" | "review" | "confirmed" | "failed";
  ocr_confidence?: number | null;
  extracted_data?: Record<string, any> | null;
  error_message?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PatientConsent {
  id: string;
  patient_id: string;
  purpose: string;
  scope: string[];
  language: string;
  consented: boolean;
  consent_method: "touch" | "voice" | "assisted";
  consent_version: string;
  status?: "granted" | "revoked";
  actor_id?: string | null;
  revocation_reason?: string | null;
  granted_at: string;
  revoked_at?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface IntakeSessionRecord {
  id: string;
  facility_id: string;
  patient_id: string;
  consent_id?: string | null;
  language: "en" | "te";
  status: "active" | "submitted" | "abandoned" | "expired" | "revoked";
  current_question_id?: string | null;
  answers: Record<string, any>;
  compiled_case_id?: string | null;
  expires_at: string;
  started_at: string;
  completed_at?: string | null;
}

export interface SyncMutationRecord {
  id: string;
  idempotency_key: string;
  user_id: string;
  entity: string;
  action: string;
  resource_id?: string | null;
  payload_hash?: string | null;
  status: "in_progress" | "pending" | "completed" | "failed";
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface KioskInstance {
  id: string;
  facility_id: string;
  name: string;
  secret_hash: string;
  status: "active" | "disabled" | "revoked";
  created_at: string;
  expires_at?: string | null;
  last_active_at?: string | null;
}

export type ExternalIdentifierType = "ABHA_NUMBER" | "ABHA_ADDRESS" | "FACILITY_MRN" | "OTHER_APPROVED_ID";
export type IdentifierVerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED";

export interface PatientExternalIdentifier {
  id: string;
  patient_id: string;
  facility_id: string;
  identifier_type: ExternalIdentifierType;
  identifier_value_encrypted_or_protected?: string | null;
  identifier_hash: string;
  issuing_authority?: string | null;
  verification_status: IdentifierVerificationStatus;
  verified_at?: string | null;
  linked_at: string;
  unlinked_at?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteIntakeInvitation {
  id: string;
  facility_id: string;
  patient_id?: string | null;
  token_hash: string;
  purpose: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at?: string | null;
  created_by: string;
  created_at: string;
}

