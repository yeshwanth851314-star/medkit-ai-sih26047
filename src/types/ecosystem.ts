/**
 * MedKit AI — Connected Healthcare Ecosystem Types
 * SIH26047 Patient Case-Taking Software
 */

// ─── 1. Roles & Profiles ──────────────────────────────────────────────────
export type ExtendedUserRole =
  | "doctor"
  | "clinician"
  | "admin"
  | "staff"
  | "diagnostic_staff"
  | "pharmacist"
  | "reception_staff"
  | "facility_admin";

// ─── 2. Departments & Appointment Slots ───────────────────────────────────
export interface FacilityDepartment {
  id: string;
  facility_id: string;
  name: string;
  code: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlot {
  id: string;
  facility_id: string;
  department_id: string;
  clinician_id?: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  status: "available" | "booked" | "cancelled";
  created_at: string;
}

// ─── 3. Appointments & OPD Queue ──────────────────────────────────────────
export type AppointmentStatus =
  | "BOOKED"
  | "CHECKED_IN"
  | "IN_QUEUE"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Appointment {
  id: string;
  patient_id: string;
  facility_id: string;
  department_id?: string | null;
  clinician_id?: string | null;
  slot_id?: string | null;
  intake_case_id?: string | null;
  scheduled_at: string;
  status: AppointmentStatus;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  department?: FacilityDepartment | null;
  patient_name?: string | null;
  patient_code?: string | null;
}

export type OpdQueueStatus =
  | "WAITING"
  | "CALLED"
  | "IN_CONSULTATION"
  | "DONE"
  | "SKIPPED"
  | "NO_SHOW";

export interface OpdQueueEntry {
  id: string;
  appointment_id: string;
  patient_id: string;
  facility_id: string;
  department_id?: string | null;
  clinician_id?: string | null;
  token_number: number;
  status: OpdQueueStatus;
  checked_in_at: string;
  called_at?: string | null;
  consultation_started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  patient_name?: string | null;
  patient_code?: string | null;
  case_id?: string | null;
  department_name?: string | null;
  doctor_name?: string | null;
  priority?: string | null;
  estimated_wait_minutes?: number | null;
}

// ─── 4. Diagnostics ───────────────────────────────────────────────────────
export type DiagnosticCategory =
  | "pathology"
  | "radiology"
  | "cardiology"
  | "ayush_pariksha"
  | "other";

export interface DiagnosticCatalogItem {
  id: string;
  facility_id?: string | null;
  code: string;
  name: string;
  test_code?: string;
  test_name?: string;
  category: DiagnosticCategory;
  description?: string | null;
  turnaround_hours?: number;
  active: boolean;
  created_at: string;
}

export type DiagnosticPriority = "ROUTINE" | "URGENT" | "STAT";

export type DiagnosticOrderStatus =
  | "ORDERED"
  | "ACCEPTED"
  | "SAMPLE_COLLECTED"
  | "IN_PROGRESS"
  | "RESULT_AVAILABLE"
  | "REVIEWED"
  | "CANCELLED";

export interface DiagnosticOrder {
  id: string;
  patient_id: string;
  case_id: string;
  facility_id: string;
  ordering_clinician_id: string;
  diagnostic_facility_id?: string | null;
  priority: DiagnosticPriority;
  clinical_context?: string | null;
  clinical_indication?: string | null;
  order_number?: string | null;
  status: DiagnosticOrderStatus;
  ordered_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: DiagnosticOrderItem[];
  results?: DiagnosticResult[];
  patient_name?: string | null;
  patient_code?: string | null;
  ordering_clinician_name?: string | null;
}

export interface DiagnosticOrderItem {
  id: string;
  diagnostic_order_id: string;
  diagnostic_catalog_id?: string | null;
  test_name_snapshot: string;
  test_code_snapshot: string;
  test_name?: string;
  test_code?: string;
  instructions?: string | null;
  status: DiagnosticOrderStatus;
  created_at: string;
}

export interface DiagnosticResult {
  id: string;
  diagnostic_order_item_id: string;
  patient_id: string;
  case_id: string;
  result_json: Record<string, any>;
  result_text?: string | null;
  document_id?: string | null;
  performed_by: string;
  verified_by?: string | null;
  performed_at: string;
  verified_at?: string | null;
  supersedes_result_id?: string | null;
  created_at: string;
  updated_at: string;
  // Convenience projected fields
  parameter_name?: string;
  numeric_value?: number | null;
  text_value?: string | null;
  unit?: string | null;
  reference_range_low?: number | null;
  reference_range_high?: number | null;
  abnormal_flag?: string | null;
  finding?: string | null;
  // Joined fields
  document_storage_path?: string | null;
  document_filename?: string | null;
}

// ─── 5. Prescriptions ─────────────────────────────────────────────────────
export type PrescriptionStatus =
  | "DRAFT"
  | "FINAL"
  | "PARTIALLY_DISPENSED"
  | "DISPENSED"
  | "CANCELLED"
  | "SUPERSEDED";

export interface Prescription {
  id: string;
  patient_id: string;
  case_id: string;
  facility_id: string;
  prescriber_id: string;
  status: PrescriptionStatus;
  notes?: string | null;
  finalized_at?: string | null;
  finalized_by?: string | null;
  cancelled_at?: string | null;
  supersedes_prescription_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  prescription_number?: string | null;
  doctor_name?: string | null;
  diagnosis?: string | null;
  general_instructions?: string | null;
  ayush_dietary_advice?: string | null;
  items?: PrescriptionItem[];
  patient_name?: string | null;
  patient_code?: string | null;
  prescriber_name?: string | null;
  clarifications?: PrescriptionClarification[];
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medicine_name: string;
  generic_name?: string | null;
  strength?: string | null;
  route: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string | null;
  created_at: string;
  // Computed & projected fields
  drug_name?: string;
  form?: string;
  dosage?: string;
  anupana?: string;
  pathya_apathya?: string;
  dispensed_quantity?: number;
}

export interface PrescriptionClarification {
  id: string;
  prescription_id: string;
  raised_by: string;
  reason: string;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  response_by?: string | null;
  response_text?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

// ─── 6. Pharmacy Inventory & Dispense Events ──────────────────────────────
export interface PharmacyInventoryItem {
  id: string;
  facility_id: string;
  medicine_key: string;
  medicine_name: string;
  generic_name?: string | null;
  strength?: string | null;
  stock_quantity: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type DispenseStatus = "PARTIAL" | "COMPLETE" | "CANCELLED";

export interface DispenseEvent {
  id: string;
  prescription_id: string;
  patient_id: string;
  facility_id: string;
  dispensed_by: string;
  status: DispenseStatus;
  notes?: string | null;
  dispensed_at: string;
  confirmed_at: string;
  items?: DispenseItem[];
}

export interface DispenseItem {
  id: string;
  dispense_event_id: string;
  prescription_item_id: string;
  quantity_dispensed: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  created_at: string;
  // Joined fields
  medicine_name?: string;
}

// ─── 7. Non-Clinical Projections & UX Layers ──────────────────────────────
export interface IntakeGuidanceResult {
  recommendedDepartment: string;
  departmentCode: string;
  priority: "Routine" | "Priority" | "Urgent Clinical Review";
  reasoning: string;
  suggestedAction: string;
  matchedKeywords: string[];
  priorityLevel?: string;
  recommendedDepartmentName?: string;
  recommendedDepartmentCode?: string;
  suggestedDoctorRole?: string;
  rationale?: string;
  disclaimer?: string;
}

export type PreliminaryIntakeGuidance = IntakeGuidanceResult;

export interface DoctorQuickView {
  chiefComplaint: string;
  duration: string;
  redFlagsCount: number;
  allergies: Array<{ substance: string; severity?: string | null }>;
  currentMedications: Array<{ name: string; dose?: string | null }>;
  newDocumentsCount: number;
  pendingDiagnosticOrdersCount: number;
  recentResultsCount: number;
}

export interface CaseReadiness {
  percentage: number;
  checklist: Array<{
    id: string;
    label: string;
    completed: boolean;
    description: string;
  }>;
}

export interface ClinicalThreadStep {
  step:
    | "PATIENT_STATEMENT"
    | "STRUCTURED_INTAKE"
    | "CLINICAL_CASE"
    | "DIAGNOSTIC_ORDER"
    | "DIAGNOSTIC_RESULT"
    | "DOCTOR_REVIEW"
    | "PRESCRIPTION"
    | "DISPENSE";
  label: string;
  timestamp?: string | null;
  status: "completed" | "in_progress" | "pending";
  referenceId?: string | null;
  actor?: string | null;
}
