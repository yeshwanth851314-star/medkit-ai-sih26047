-- Migration: 20260915000001_harden_clinician_onboarding.sql
-- Description: Phase B Professional Onboarding Hardening — RLS Self-Promotion Protection, Atomic Approval RPC, Schema Alignment & Legacy Migration

-- 1. Align professional_type CHECK constraint with canonical vocabulary
ALTER TABLE public.clinician_professional_profiles
  DROP CONSTRAINT IF EXISTS clinician_professional_profiles_professional_type_check;

ALTER TABLE public.clinician_professional_profiles
  ADD CONSTRAINT clinician_professional_profiles_professional_type_check
  CHECK (professional_type IN (
    'allopathy',
    'ayush_ayurveda',
    'ayush_yoga_naturopathy',
    'ayush_unani',
    'ayush_siddha',
    'ayush_homeopathy',
    'nursing',
    'paramedical'
  ));

-- 2. Align verification_status CHECK constraint
ALTER TABLE public.clinician_professional_profiles
  DROP CONSTRAINT IF EXISTS clinician_professional_profiles_verification_status_check;

ALTER TABLE public.clinician_professional_profiles
  ADD CONSTRAINT clinician_professional_profiles_verification_status_check
  CHECK (verification_status IN (
    'pending',
    'pending_external_verification',
    'verified',
    'rejected',
    'recheck_required'
  ));

-- 3. Add mfa_verified_at column if not exists
ALTER TABLE public.clinician_professional_profiles
  ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

-- 4. Harden protect_profile_privileges trigger on public.profiles to prevent self-modification of is_active
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.role IS DISTINCT FROM NEW.role OR 
    OLD.facility_id IS DISTINCT FROM NEW.facility_id OR
    OLD.is_active IS DISTINCT FROM NEW.is_active
  ) THEN
    -- Allow service_role or admin to modify
    IF (public.current_user_role() NOT IN ('admin') AND current_user NOT IN ('service_role', 'postgres')) THEN
      RAISE EXCEPTION 'FORBIDDEN: Modifying role, facility_id, or is_active requires administrative privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create database trigger on clinician_professional_profiles to prevent direct client self-promotion
CREATE OR REPLACE FUNCTION public.protect_clinician_onboarding_privileges()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoked by service_role or postgres superuser, permit updates
  IF (current_user IN ('service_role', 'postgres')) THEN
    RETURN NEW;
  END IF;

  -- If non-admin attempts to modify authoritative workflow fields directly, reject
  IF (public.current_user_role() NOT IN ('admin')) THEN
    IF (
      OLD.account_status IS DISTINCT FROM NEW.account_status OR
      OLD.verification_status IS DISTINCT FROM NEW.verification_status OR
      OLD.verification_reference IS DISTINCT FROM NEW.verification_reference OR
      OLD.verification_provider IS DISTINCT FROM NEW.verification_provider OR
      OLD.verified_at IS DISTINCT FROM NEW.verified_at OR
      OLD.recheck_at IS DISTINCT FROM NEW.recheck_at OR
      OLD.mfa_enrolled IS DISTINCT FROM NEW.mfa_enrolled OR
      OLD.mfa_verified_at IS DISTINCT FROM NEW.mfa_verified_at OR
      OLD.facility_approved_by IS DISTINCT FROM NEW.facility_approved_by OR
      OLD.facility_approved_at IS DISTINCT FROM NEW.facility_approved_at OR
      OLD.facility_role IS DISTINCT FROM NEW.facility_role OR
      OLD.requested_facility_id IS DISTINCT FROM NEW.requested_facility_id
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Modifying authoritative clinician onboarding fields requires server authorization or administrative approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_clinician_onboarding ON public.clinician_professional_profiles;
CREATE TRIGGER trg_protect_clinician_onboarding
  BEFORE UPDATE ON public.clinician_professional_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_clinician_onboarding_privileges();

-- 6. Atomic PostgreSQL RPC for Facility Approval
CREATE OR REPLACE FUNCTION public.approve_clinician_application(
  p_profile_id UUID,
  p_admin_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_profile RECORD;
  v_app RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Identify and verify admin caller
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrative session required for approval';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = p_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Approving administrator profile not found or inactive';
  END IF;

  IF v_admin_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % is not authorized to approve facility applications', v_admin_profile.role;
  END IF;

  -- 2. Lock application row FOR UPDATE to prevent concurrent race conditions
  SELECT * INTO v_app
  FROM public.clinician_professional_profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: Clinician application % does not exist', p_profile_id;
  END IF;

  -- 3. Verify facility boundary isolation
  IF v_admin_profile.facility_id IS NOT NULL AND v_admin_profile.facility_id <> v_app.requested_facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot approve applicant for a different facility';
  END IF;

  -- 4. Verify prerequisite gates: verification, MFA, state
  IF v_app.account_status <> 'PENDING_FACILITY_APPROVAL' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Application must be in PENDING_FACILITY_APPROVAL state (current: %)', v_app.account_status;
  END IF;

  IF v_app.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Professional credentials must be verified before approval (current: %)', v_app.verification_status;
  END IF;

  IF v_app.mfa_enrolled IS NOT TRUE THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Multi-factor authentication must be enrolled before approval';
  END IF;

  -- 5. Atomically update clinician_professional_profiles
  UPDATE public.clinician_professional_profiles
  SET
    account_status = 'ACTIVE',
    facility_approved_by = p_admin_id,
    facility_approved_at = v_now,
    updated_at = v_now
  WHERE id = p_profile_id;

  -- 6. Atomically update base profiles table (unlock active clinical status and assign facility)
  UPDATE public.profiles
  SET
    is_active = true,
    facility_id = v_app.requested_facility_id,
    role = v_app.facility_role,
    updated_at = v_now
  WHERE id = v_app.user_id;

  -- 7. Record clinical audit event
  INSERT INTO public.clinical_audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    v_admin_profile.role,
    'CLINICIAN_FACILITY_APPROVED',
    'clinician_onboarding',
    v_app.user_id::TEXT,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'approved_by', p_admin_id,
      'facility_id', v_app.requested_facility_id,
      'role', v_app.facility_role,
      'status', 'ACTIVE'
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'user_id', v_app.user_id,
    'status', 'ACTIVE',
    'facility_id', v_app.requested_facility_id,
    'approved_at', v_now
  );
END;
$$;

-- 7. Atomic PostgreSQL RPC for Facility Rejection
CREATE OR REPLACE FUNCTION public.reject_clinician_application(
  p_profile_id UUID,
  p_reason TEXT,
  p_admin_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_profile RECORD;
  v_app RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrative session required for rejection';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = p_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrator profile not found or inactive';
  END IF;

  IF v_admin_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % is not authorized to review facility applications', v_admin_profile.role;
  END IF;

  SELECT * INTO v_app
  FROM public.clinician_professional_profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: Clinician application % does not exist', p_profile_id;
  END IF;

  IF v_admin_profile.facility_id IS NOT NULL AND v_admin_profile.facility_id <> v_app.requested_facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot reject applicant for a different facility';
  END IF;

  UPDATE public.clinician_professional_profiles
  SET
    account_status = 'REJECTED',
    rejection_reason = p_reason,
    updated_at = v_now
  WHERE id = p_profile_id;

  INSERT INTO public.clinical_audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    p_admin_id,
    v_admin_profile.role,
    'CLINICIAN_FACILITY_REJECTED',
    'clinician_onboarding',
    v_app.user_id::TEXT,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'rejected_by', p_admin_id,
      'facility_id', v_app.requested_facility_id,
      'reason', p_reason,
      'status', 'REJECTED'
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'user_id', v_app.user_id,
    'status', 'REJECTED',
    'reason', p_reason
  );
END;
$$;

-- Grant execution to authenticated users (functions enforce internal role checks)
REVOKE ALL ON FUNCTION public.approve_clinician_application(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.reject_clinician_application(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT, UUID) TO service_role;

-- 8. Safe Legacy Migration: Reclassify historical clinical profiles
-- Do NOT preserve false claim of completed external registry verification.
-- Place them in recheck_required with 30-day operational grace period.
UPDATE public.clinician_professional_profiles
SET
  verification_status = 'recheck_required',
  verification_reference = 'LEGACY_TRANSITION_PENDING',
  registration_number = 'LEGACY-PENDING-REVERIFICATION',
  recheck_at = now() + INTERVAL '30 days',
  updated_at = now()
WHERE verification_reference = 'VERIF-SEEDED-PRE-PILOT-01';
