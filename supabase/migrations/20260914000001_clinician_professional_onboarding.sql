-- Migration: 20260914000001_clinician_professional_onboarding.sql
-- Description: Healthcare Professional Onboarding, Medical Registry Verification, MFA & Facility Approval System

CREATE TABLE IF NOT EXISTS public.clinician_professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_type TEXT NOT NULL CHECK (professional_type IN (
    'allopathy',
    'ayush_ayurveda',
    'ayush_yoga',
    'ayush_unani',
    'ayush_siddha',
    'ayush_homeopathy',
    'nursing',
    'paramedical'
  )),
  registration_number TEXT NOT NULL,
  registration_authority TEXT NOT NULL,
  registration_state TEXT NOT NULL,
  verification_provider TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending',
    'verified',
    'rejected',
    'recheck_required'
  )),
  verification_reference TEXT,
  verified_at TIMESTAMPTZ,
  recheck_at TIMESTAMPTZ,
  requested_facility_id TEXT NOT NULL,
  facility_role TEXT NOT NULL DEFAULT 'doctor',
  account_status TEXT NOT NULL DEFAULT 'PENDING_IDENTITY' CHECK (account_status IN (
    'PENDING_IDENTITY',
    'IDENTITY_VERIFIED',
    'PROFESSIONAL_VERIFICATION_PENDING',
    'PROFESSIONAL_VERIFIED',
    'MFA_REQUIRED',
    'PENDING_FACILITY_APPROVAL',
    'ACTIVE',
    'REJECTED',
    'SUSPENDED',
    'REVOKED',
    'RECHECK_REQUIRED'
  )),
  mfa_enrolled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret TEXT,
  facility_approved_by UUID REFERENCES public.profiles(id),
  facility_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_clinician_prof_user_id ON public.clinician_professional_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_clinician_prof_facility ON public.clinician_professional_profiles(requested_facility_id);
CREATE INDEX IF NOT EXISTS idx_clinician_prof_status ON public.clinician_professional_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_clinician_prof_reg_no ON public.clinician_professional_profiles(registration_number);

-- Enable Row Level Security
ALTER TABLE public.clinician_professional_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Clinicians can view their own professional profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinician_professional_profiles' AND policyname = 'clinician_view_own_profile'
  ) THEN
    CREATE POLICY clinician_view_own_profile ON public.clinician_professional_profiles
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy 2: Clinicians can update their own profile while in onboarding pending states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinician_professional_profiles' AND policyname = 'clinician_update_own_onboarding'
  ) THEN
    CREATE POLICY clinician_update_own_onboarding ON public.clinician_professional_profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id AND account_status IN ('PENDING_IDENTITY', 'IDENTITY_VERIFIED', 'PROFESSIONAL_VERIFICATION_PENDING', 'PROFESSIONAL_VERIFIED', 'MFA_REQUIRED'))
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy 3: Facility Administrators can view applications for their facility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinician_professional_profiles' AND policyname = 'admin_view_facility_applications'
  ) THEN
    CREATE POLICY admin_view_facility_applications ON public.clinician_professional_profiles
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'staff')
            AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
        )
      );
  END IF;
END $$;

-- Policy 4: Facility Administrators can update status (approve / reject)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clinician_professional_profiles' AND policyname = 'admin_manage_facility_applications'
  ) THEN
    CREATE POLICY admin_manage_facility_applications ON public.clinician_professional_profiles
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'staff')
            AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'staff')
            AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
        )
      );
  END IF;
END $$;

-- Seed existing active clinical accounts so existing verified workflows remain 100% operational
INSERT INTO public.clinician_professional_profiles (
  user_id,
  professional_type,
  registration_number,
  registration_authority,
  registration_state,
  verification_provider,
  verification_status,
  verification_reference,
  verified_at,
  requested_facility_id,
  facility_role,
  account_status,
  mfa_enrolled,
  facility_approved_at
)
SELECT
  p.id,
  CASE
    WHEN p.full_name ILIKE '%Vaidya%' THEN 'ayush_ayurveda'
    WHEN p.role = 'staff' THEN 'nursing'
    ELSE 'allopathy'
  END,
  CASE
    WHEN p.full_name ILIKE '%Vaidya%' THEN 'AYUSH-DEL-2018-0921'
    WHEN p.role = 'staff' THEN 'NURSE-DEL-2021-4412'
    ELSE 'MCI-DEL-2015-88421'
  END,
  CASE
    WHEN p.full_name ILIKE '%Vaidya%' THEN 'Delhi Bharatiya Chikitsa Parishad'
    WHEN p.role = 'staff' THEN 'Delhi Nursing Council'
    ELSE 'National Medical Commission'
  END,
  'Delhi',
  'nmr_registry',
  'verified',
  'VERIF-SEEDED-PRE-PILOT-01',
  now(),
  COALESCE(p.facility_id, 'facility-aiia-delhi'),
  p.role,
  'ACTIVE',
  true,
  now()
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;
