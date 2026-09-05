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

export interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  blood_group?: string | null;
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
  onset?: string;
  duration?: string;
  character?: string;
  location?: string;
  radiation?: string;
  severity?: string;
  aggravating_factors?: string | string[];
  relieving_factors?: string | string[];
  associated_symptoms?: string[];
  denies?: string[];
}

export interface MedicationEntry {
  name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  source?: ClinicalSource;
  verified_by?: string | null;
}

export interface AllergyEntry {
  substance: string;
  reaction?: string;
  severity?: "Mild" | "Moderate" | "Severe";
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
  prakriti?: string;
  vikriti?: string;
  sara?: string;
  samhanana?: string;
  pramana?: string;
  satmya?: string;
  sattva?: string;
  ahara_shakti?: string;
  vyayama_shakti?: string;
  vaya?: string;
  ahara_vihara?: {
    dietary_habits?: string;
    daily_routine?: string;
  };
}

export interface ClinicalCase {
  id: string;
  patient_id: string;
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
    summary?: string;
    plan?: string;
  } | null;
  ayush_assessment?: AyushAssessment | null;
  red_flags?: RedFlagAlert[] | null;
  provenance?: ClinicalProvenance | null;
  created_at: string;
  updated_at?: string;
  finalized_at?: string | null;
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
  created_at: string;
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
