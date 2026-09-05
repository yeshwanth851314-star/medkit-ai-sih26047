-- MedKit AI — Supabase PostgreSQL Initial Schema Migration
-- Migration: 20260906000001_initial_schema.sql
-- Description: Production-grade schema with profiles, patients, cases, documents, consents, audit_logs, red_flag_events and strict RLS policies.

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PROFILES TABLE (Clinicians, Doctors, Staff, Admins)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'clinician', 'admin', 'staff')),
  facility_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. PATIENTS TABLE (Demographics, ABHA ID, Emergency Contacts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  phone TEXT,
  address TEXT,
  blood_group TEXT,
  abha_id TEXT UNIQUE,
  emergency_contact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. CONSENTS TABLE (Patient Clinical Case-Taking Consent)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID,
  purpose TEXT NOT NULL DEFAULT 'clinical_care_and_case_taking',
  scope TEXT[] NOT NULL DEFAULT ARRAY['voice_recording', 'document_extraction', 'ai_summary'],
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'te')),
  consent_method TEXT NOT NULL DEFAULT 'touch_acknowledgement' CHECK (consent_method IN ('digital_signature', 'touch_acknowledgement', 'verbal_recorded')),
  consent_version TEXT NOT NULL DEFAULT 'v1.0',
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. CASES TABLE (Clinical Intakes, HPI, AYUSH, Red Flags, Provenance)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent_id UUID REFERENCES public.consents(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'general' CHECK (case_type IN ('general', 'ayush')),
  patient_language TEXT NOT NULL DEFAULT 'en' CHECK (patient_language IN ('en', 'te')),
  chief_complaint TEXT NOT NULL,
  raw_patient_complaint TEXT,
  hpi JSONB NOT NULL DEFAULT '{}'::jsonb,
  past_history JSONB,
  medications JSONB DEFAULT '[]'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  red_flags JSONB DEFAULT '[]'::jsonb,
  ai_summary JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  provenance JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key reference from consents to cases now that cases table exists
DO $$ BEGIN
  ALTER TABLE public.consents
    ADD CONSTRAINT fk_consents_case
    FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 5. DOCUMENTS TABLE (Prescriptions, Lab Reports, Uploads)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'prescription',
  processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. AUDIT_LOGS TABLE (Immutable Clinical Action Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('patients', 'cases', 'documents', 'auth', 'fhir')),
  resource_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. RED_FLAG_EVENTS TABLE (Triggered Red Flag Clinical Events)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.red_flag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MODERATE', 'LOW')),
  trigger_text TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES FOR HIGH-TRAFFIC CLINICAL QUERIES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_patients_code ON public.patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON public.patients(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cases_patient_id ON public.cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_clinician_id ON public.cases(clinician_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consents_patient_id ON public.consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consents_case_id ON public.consents(case_id);

CREATE INDEX IF NOT EXISTS idx_documents_patient_id ON public.documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_red_flags_case_id ON public.red_flag_events(case_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_flag_events ENABLE ROW LEVEL SECURITY;

-- Helper functions to get current user profile role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Patients Policies
CREATE POLICY "Patients viewable by clinicians and staff"
  ON public.patients FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Patients insertable by clinicians and staff"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Patients updatable by clinicians and staff"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

-- Consents Policies
CREATE POLICY "Consents viewable by clinicians and staff"
  ON public.consents FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Consents insertable by authenticated users or kiosk"
  ON public.consents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Cases Policies
CREATE POLICY "Cases viewable by clinical staff"
  ON public.cases FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Cases insertable by clinical staff"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Cases updatable by clinicians (doctors/clinicians)"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'admin'));

-- Documents Policies
CREATE POLICY "Documents viewable by clinical staff"
  ON public.documents FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Documents insertable by clinical staff and patients"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Audit Logs Policies: STRICT IMMUTABILITY
CREATE POLICY "Audit logs insertable by any authenticated user or service"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Audit logs viewable only by doctors or administrators"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'admin'));

-- Red Flag Events Policies
CREATE POLICY "Red flag events viewable by clinicians and staff"
  ON public.red_flag_events FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));

CREATE POLICY "Red flag events insertable by clinical systems"
  ON public.red_flag_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Red flag events updatable by attending doctors"
  ON public.red_flag_events FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('doctor', 'clinician', 'admin'));
