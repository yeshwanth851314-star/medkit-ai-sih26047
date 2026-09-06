-- MedKit AI — Schema Alignment and Defense Hardening Migration
-- Migration: 20260906000002_schema_alignment.sql
-- Description: Aligns Supabase schema with domain models: adds case finalization fields, amendments table,
-- consent lifecycle tracking with UPDATE RLS policy, patient facility/gender flexibility, and audit persistence.

-- 1. Patients Table Enhancements
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS facility_id TEXT;

-- Update gender check constraint to accept both canonical and UI cases safely
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_gender_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_gender_check
  CHECK (LOWER(gender) IN ('male', 'female', 'other', 'unknown'));

-- 2. Consents Table Enhancements & RLS UPDATE Policy
ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'revoked')),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- Enable UPDATE policy for consent revocation
DO $$ BEGIN
  CREATE POLICY "Consents updatable by clinicians and staff"
    ON public.consents FOR UPDATE
    TO authenticated
    USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Cases Table Enhancements (Finalization, Addenda, Clinical Sections)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by TEXT,
  ADD COLUMN IF NOT EXISTS amendments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS family_history JSONB,
  ADD COLUMN IF NOT EXISTS personal_history JSONB,
  ADD COLUMN IF NOT EXISTS examination JSONB,
  ADD COLUMN IF NOT EXISTS assessment_plan JSONB,
  ADD COLUMN IF NOT EXISTS ayush_assessment JSONB,
  ADD COLUMN IF NOT EXISTS medication_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allergy_history JSONB DEFAULT '[]'::jsonb;

-- 4. Case Amendments Dedicated Table (Structured Immutable Addenda)
CREATE TABLE IF NOT EXISTS public.case_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_amendments_case_id ON public.case_amendments(case_id);

ALTER TABLE public.case_amendments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Case amendments viewable by clinical staff"
    ON public.case_amendments FOR SELECT
    TO authenticated
    USING (public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Case amendments insertable by clinicians"
    ON public.case_amendments FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_role() IN ('doctor', 'clinician', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
