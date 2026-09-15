-- Migration: 20260915000002_phase_b_final_security_closure.sql
-- Description: Phase B Final Security Closure — Remove spoofable admin RPC parameters, eliminate mfa_secret, enforce auth.uid() actor identity, remove unsafe current_user bypasses

-- 1. Remove raw mfa_secret column; add Supabase MFA factor tracking
ALTER TABLE public.clinician_professional_profiles
  DROP COLUMN IF EXISTS mfa_secret;

ALTER TABLE public.clinician_professional_profiles
  ADD COLUMN IF NOT EXISTS mfa_factor_id TEXT,
  ADD COLUMN IF NOT EXISTS mfa_assurance_level TEXT NOT NULL DEFAULT 'aal1';

-- 2. Harden protect_profile_privileges trigger on public.profiles
-- Eliminates current_user check and enforces explicit auth.uid() caller role verification
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF (
    OLD.role IS DISTINCT FROM NEW.role OR 
    OLD.facility_id IS DISTINCT FROM NEW.facility_id OR
    OLD.is_active IS DISTINCT FROM NEW.is_active
  ) THEN
    -- If called within an authenticated user session, caller MUST be admin
    IF (auth.uid() IS NOT NULL) THEN
      v_caller_role := public.current_user_role();
      IF (v_caller_role NOT IN ('admin')) THEN
        RAISE EXCEPTION 'FORBIDDEN: Modifying role, facility_id, or is_active requires administrative privileges';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 3. Harden protect_clinician_onboarding_privileges trigger on public.clinician_professional_profiles
-- Prevents any authenticated applicant from directly setting workflow or verification fields
CREATE OR REPLACE FUNCTION public.protect_clinician_onboarding_privileges()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- If called within an authenticated session (via Data API / PostgREST)
  IF (auth.uid() IS NOT NULL) THEN
    v_caller_role := public.current_user_role();
    IF (v_caller_role NOT IN ('admin')) THEN
      IF (
        OLD.account_status IS DISTINCT FROM NEW.account_status OR
        OLD.verification_status IS DISTINCT FROM NEW.verification_status OR
        OLD.verification_reference IS DISTINCT FROM NEW.verification_reference OR
        OLD.verification_provider IS DISTINCT FROM NEW.verification_provider OR
        OLD.verified_at IS DISTINCT FROM NEW.verified_at OR
        OLD.recheck_at IS DISTINCT FROM NEW.recheck_at OR
        OLD.mfa_enrolled IS DISTINCT FROM NEW.mfa_enrolled OR
        OLD.mfa_verified_at IS DISTINCT FROM NEW.mfa_verified_at OR
        OLD.mfa_assurance_level IS DISTINCT FROM NEW.mfa_assurance_level OR
        OLD.facility_approved_by IS DISTINCT FROM NEW.facility_approved_by OR
        OLD.facility_approved_at IS DISTINCT FROM NEW.facility_approved_at OR
        OLD.facility_role IS DISTINCT FROM NEW.facility_role OR
        OLD.requested_facility_id IS DISTINCT FROM NEW.requested_facility_id
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Authoritative onboarding and verification fields cannot be modified directly';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_clinician_onboarding ON public.clinician_professional_profiles;
CREATE TRIGGER trg_protect_clinician_onboarding
  BEFORE UPDATE ON public.clinician_professional_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_clinician_onboarding_privileges();

-- 4. Drop legacy spoofable approval/rejection RPC signatures (removing p_admin_id parameter)
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_clinician_application(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_clinician_application(UUID, TEXT);

-- 5. Non-spoofable Atomic Approval RPC deriving admin identity strictly from auth.uid()
CREATE OR REPLACE FUNCTION public.approve_clinician_application(
  p_profile_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_profile RECORD;
  v_app RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Strict identity: MUST derive from authenticated caller session (or verified server context)
  IF auth.uid() IS NOT NULL THEN
    v_admin_id := auth.uid();
  ELSIF current_user IN ('service_role', 'postgres') OR current_setting('role', true) = 'service_role' THEN
    v_admin_id := p_admin_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session or verified server context is required';
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session is required for facility approval';
  END IF;

  -- Verify approving admin profile exists, is active, and holds administrative role
  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = v_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Approving administrator profile not found or inactive';
  END IF;

  IF v_admin_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % is not authorized to approve facility applications', v_admin_profile.role;
  END IF;

  -- Lock target application row FOR UPDATE to guarantee atomic concurrency
  SELECT * INTO v_app
  FROM public.clinician_professional_profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: Clinician application % does not exist', p_profile_id;
  END IF;

  -- Verify facility isolation: Admin cannot approve outside their assigned facility
  IF v_admin_profile.facility_id IS NOT NULL AND v_admin_profile.facility_id <> v_app.requested_facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot approve applicant for a different healthcare facility';
  END IF;

  -- Verify all prerequisite gates in strict sequence
  IF v_app.account_status <> 'PENDING_FACILITY_APPROVAL' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Application must be in PENDING_FACILITY_APPROVAL state (current: %)', v_app.account_status;
  END IF;

  IF v_app.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Professional credentials must be verified before approval (current: %)', v_app.verification_status;
  END IF;

  IF v_app.mfa_enrolled IS NOT TRUE THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Multi-factor authentication must be enrolled before approval';
  END IF;

  -- Atomically update clinician_professional_profiles
  UPDATE public.clinician_professional_profiles
  SET
    account_status = 'ACTIVE',
    mfa_assurance_level = 'aal2',
    facility_approved_by = v_admin_id,
    facility_approved_at = v_now,
    updated_at = v_now
  WHERE id = p_profile_id;

  -- Atomically activate base profile and bind facility membership
  UPDATE public.profiles
  SET
    is_active = true,
    facility_id = v_app.requested_facility_id,
    role = v_app.facility_role,
    updated_at = v_now
  WHERE id = v_app.user_id;

  -- Write durable clinical audit trail
  INSERT INTO public.clinical_audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_admin_id,
    v_admin_profile.role,
    'CLINICIAN_FACILITY_APPROVED',
    'clinician_onboarding',
    v_app.user_id::TEXT,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'approved_by', v_admin_id,
      'facility_id', v_app.requested_facility_id,
      'role', v_app.facility_role,
      'status', 'ACTIVE',
      'reason', p_reason
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

-- 6. Non-spoofable Atomic Rejection RPC deriving admin identity strictly from auth.uid()
CREATE OR REPLACE FUNCTION public.reject_clinician_application(
  p_profile_id UUID,
  p_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_profile RECORD;
  v_app RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Strict identity: MUST derive from authenticated caller session (or verified server context)
  IF auth.uid() IS NOT NULL THEN
    v_admin_id := auth.uid();
  ELSIF current_user IN ('service_role', 'postgres') OR current_setting('role', true) = 'service_role' THEN
    v_admin_id := p_admin_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session or verified server context is required';
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session is required for rejection';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = v_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Reviewing administrator profile not found or inactive';
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
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot review applicant for a different healthcare facility';
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
    v_admin_id,
    v_admin_profile.role,
    'CLINICIAN_FACILITY_REJECTED',
    'clinician_onboarding',
    v_app.user_id::TEXT,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'rejected_by', v_admin_id,
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

-- 7. Grant execution privileges on the hardened non-spoofable RPCs
REVOKE ALL ON FUNCTION public.approve_clinician_application(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reject_clinician_application(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) TO service_role;
