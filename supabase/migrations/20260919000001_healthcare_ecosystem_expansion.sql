-- =============================================================================
-- MedKit AI — Connected Healthcare Ecosystem Expansion Migration
-- Migration: 20260919000001_healthcare_ecosystem_expansion.sql
-- Description:
--   1. Expands profiles.role to support 'diagnostic_staff', 'pharmacist', 'reception_staff', 'facility_admin'.
--   2. Expands audit_logs.resource_type check constraint to include ecosystem resources.
--   3. Creates facility_departments and appointment_slots.
--   4. Creates appointments and opd_queue_entries.
--   5. Creates diagnostic_catalog, diagnostic_orders, diagnostic_order_items, diagnostic_results.
--   6. Creates prescriptions, prescription_items, prescription_clarifications.
--   7. Creates pharmacy_inventory, dispense_events, dispense_items.
--   8. Enforces strict Row Level Security (RLS) with facility isolation on all new tables.
-- =============================================================================

-- 1. Expand profiles.role check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'doctor',
    'clinician',
    'admin',
    'staff',
    'diagnostic_staff',
    'pharmacist',
    'reception_staff',
    'facility_admin'
  ));

-- 2. Expand audit_logs.resource_type check constraint
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN (
    'patients',
    'cases',
    'documents',
    'auth',
    'fhir',
    'consents',
    'transcripts',
    'kiosk_instances',
    'intake_sessions',
    'appointments',
    'opd_queues',
    'diagnostic_orders',
    'diagnostic_results',
    'prescriptions',
    'dispenses',
    'pharmacy_inventory'
  ));

-- =============================================================================
-- 3. FACILITY DEPARTMENTS & APPOINTMENT SLOTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facility_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_departments_facility ON public.facility_departments(facility_id);

CREATE TABLE IF NOT EXISTS public.appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  department_id UUID REFERENCES public.facility_departments(id) ON DELETE CASCADE,
  clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_facility ON public.appointment_slots(facility_id, starts_at);

-- =============================================================================
-- 4. APPOINTMENTS & OPD QUEUE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  department_id UUID REFERENCES public.facility_departments(id) ON DELETE SET NULL,
  clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  slot_id UUID REFERENCES public.appointment_slots(id) ON DELETE SET NULL,
  intake_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CHECKED_IN', 'IN_QUEUE', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_facility_scheduled ON public.appointments(facility_id, scheduled_at);

CREATE TABLE IF NOT EXISTS public.opd_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  department_id UUID REFERENCES public.facility_departments(id) ON DELETE SET NULL,
  clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'IN_CONSULTATION', 'DONE', 'SKIPPED')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  consultation_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opd_queue_facility_status ON public.opd_queue_entries(facility_id, status, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_opd_queue_patient ON public.opd_queue_entries(patient_id);

-- =============================================================================
-- 5. DIAGNOSTICS MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.diagnostic_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pathology', 'radiology', 'cardiology', 'ayush_pariksha', 'other')),
  description TEXT,
  turnaround_hours INTEGER DEFAULT 24,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diagnostic_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  ordering_clinician_id UUID NOT NULL REFERENCES public.profiles(id),
  diagnostic_facility_id TEXT,
  priority TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (priority IN ('ROUTINE', 'URGENT', 'STAT')),
  clinical_context TEXT,
  status TEXT NOT NULL DEFAULT 'ORDERED' CHECK (status IN ('ORDERED', 'ACCEPTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_AVAILABLE', 'REVIEWED', 'CANCELLED')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_orders_patient ON public.diagnostic_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_orders_facility_status ON public.diagnostic_orders(facility_id, status);

CREATE TABLE IF NOT EXISTS public.diagnostic_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_order_id UUID NOT NULL REFERENCES public.diagnostic_orders(id) ON DELETE CASCADE,
  diagnostic_catalog_id UUID REFERENCES public.diagnostic_catalog(id) ON DELETE SET NULL,
  test_name_snapshot TEXT NOT NULL,
  test_code_snapshot TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'ORDERED' CHECK (status IN ('ORDERED', 'ACCEPTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_AVAILABLE', 'REVIEWED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diagnostic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_order_item_id UUID NOT NULL REFERENCES public.diagnostic_order_items(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_text TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  performed_by TEXT NOT NULL,
  verified_by TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  supersedes_result_id UUID REFERENCES public.diagnostic_results(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_results_case ON public.diagnostic_results(case_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_patient ON public.diagnostic_results(patient_id);

-- =============================================================================
-- 6. PRESCRIPTIONS MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  prescriber_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED', 'SUPERSEDED')),
  notes TEXT,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ,
  supersedes_prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_facility_status ON public.prescriptions(facility_id, status);

CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  route TEXT NOT NULL DEFAULT 'oral',
  dose TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prescription_clarifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  raised_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  response_by TEXT,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- =============================================================================
-- 7. PHARMACY & DISPENSING MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  medicine_key TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_facility ON public.pharmacy_inventory(facility_id, medicine_key);

CREATE TABLE IF NOT EXISTS public.dispense_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  dispensed_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETE' CHECK (status IN ('PARTIAL', 'COMPLETE', 'CANCELLED')),
  notes TEXT,
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispense_events_patient ON public.dispense_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispense_events_facility ON public.dispense_events(facility_id);

CREATE TABLE IF NOT EXISTS public.dispense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_event_id UUID NOT NULL REFERENCES public.dispense_events(id) ON DELETE CASCADE,
  prescription_item_id UUID NOT NULL REFERENCES public.prescription_items(id) ON DELETE CASCADE,
  quantity_dispensed INTEGER NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.facility_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opd_queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispense_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispense_items ENABLE ROW LEVEL SECURITY;

-- 8.1 Facility Departments
CREATE POLICY "Departments viewable by authenticated users"
  ON public.facility_departments FOR SELECT
  TO authenticated
  USING (true);

-- 8.2 Appointments & OPD Queue
CREATE POLICY "Appointments viewable by facility staff"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

CREATE POLICY "Appointments insertable by authorized staff"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

CREATE POLICY "OPD queue viewable by facility staff"
  ON public.opd_queue_entries FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

CREATE POLICY "OPD queue manageable by facility staff"
  ON public.opd_queue_entries FOR ALL
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  )
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

-- 8.3 Diagnostics
CREATE POLICY "Diagnostic catalog viewable by authenticated users"
  ON public.diagnostic_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Diagnostic orders viewable by facility clinical and lab staff"
  ON public.diagnostic_orders FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

CREATE POLICY "Diagnostic orders insertable by licensed clinicians"
  ON public.diagnostic_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (public.current_user_role() = 'admin' OR facility_id = public.current_user_facility())
  );

CREATE POLICY "Diagnostic results viewable by facility clinical and lab staff"
  ON public.diagnostic_results FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = diagnostic_results.patient_id
        AND p.facility_id = public.current_user_facility()
    )
  );

-- 8.4 Prescriptions
CREATE POLICY "Prescriptions viewable by facility staff based on status"
  ON public.prescriptions FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    (
      facility_id = public.current_user_facility() AND (
        public.current_user_role() IN ('doctor', 'clinician') OR
        (public.current_user_role() = 'pharmacist' AND status IN ('FINAL', 'PARTIALLY_DISPENSED', 'DISPENSED')) OR
        status IN ('FINAL', 'PARTIALLY_DISPENSED', 'DISPENSED')
      )
    )
  );

CREATE POLICY "Prescriptions insertable and updatable by doctors only"
  ON public.prescriptions FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (public.current_user_role() = 'admin' OR facility_id = public.current_user_facility())
  )
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (public.current_user_role() = 'admin' OR facility_id = public.current_user_facility())
  );

-- 8.5 Pharmacy & Dispensing
CREATE POLICY "Pharmacy inventory viewable by facility staff"
  ON public.pharmacy_inventory FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    facility_id = public.current_user_facility()
  );

CREATE POLICY "Dispense events manageable by facility pharmacists"
  ON public.dispense_events FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('pharmacist', 'admin', 'doctor', 'clinician') AND
    (public.current_user_role() = 'admin' OR facility_id = public.current_user_facility())
  )
  WITH CHECK (
    public.current_user_role() IN ('pharmacist', 'admin') AND
    (public.current_user_role() = 'admin' OR facility_id = public.current_user_facility())
  );
