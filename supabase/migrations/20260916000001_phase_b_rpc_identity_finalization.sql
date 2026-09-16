-- ==============================================================================
-- SIH26047 MedKit AI — Phase B Finalization: Public RPC Identity & Assurance
-- Migration: 20260916000001_phase_b_rpc_identity_finalization.sql
--
-- Objectives:
-- 1. Drop all legacy 3-parameter approval/rejection RPCs containing p_admin_id.
-- 2. Create clean, non-spoofable 2-parameter signatures:
--      approve_clinician_application(p_profile_id UUID, p_reason TEXT DEFAULT NULL)
--      reject_clinician_application(p_profile_id UUID, p_reason TEXT)
-- 3. Exclusively derive actor identity from auth.uid() (zero caller-supplied admin ID).
-- 4. Eliminate all current_user IN ('service_role', 'postgres') actor ambiguity.
-- 5. Revoke EXECUTE from anon/PUBLIC and grant strictly to authenticated role.
-- ==============================================================================

-- 1. Drop all legacy signatures (including overloaded variants)
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.reject_clinician_application(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID, UUID);
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID, TEXT);
DROP FUNCTION IF EXISTS public.approve_clinician_application(UUID);
DROP FUNCTION IF EXISTS public.reject_clinician_application(UUID, TEXT);

-- 2. Non-spoofable Atomic Approval RPC strictly deriving admin identity from auth.uid()
CREATE OR REPLACE FUNCTION public.approve_clinician_application(
  p_profile_id UUID,
  p_reason TEXT DEFAULT NULL
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
  -- Strict identity: MUST derive exclusively from authenticated caller session
  v_admin_id := auth.uid();

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

-- 3. Non-spoofable Atomic Rejection RPC strictly deriving admin identity from auth.uid()
CREATE OR REPLACE FUNCTION public.reject_clinician_application(
  p_profile_id UUID,
  p_reason TEXT
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
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session is required for rejection';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = v_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Rejecting administrator profile not found or inactive';
  END IF;

  IF v_admin_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % is not authorized to reject facility applications', v_admin_profile.role;
  END IF;

  SELECT * INTO v_app
  FROM public.clinician_professional_profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: Clinician application % does not exist', p_profile_id;
  END IF;

  IF v_admin_profile.facility_id IS NOT NULL AND v_admin_profile.facility_id <> v_app.requested_facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot reject applicant for a different healthcare facility';
  END IF;

  UPDATE public.clinician_professional_profiles
  SET
    account_status = 'REJECTED',
    rejection_reason = p_reason,
    facility_approved_by = v_admin_id,
    facility_approved_at = v_now,
    updated_at = v_now
  WHERE id = p_profile_id;

  UPDATE public.profiles
  SET
    is_active = false,
    updated_at = v_now
  WHERE id = v_app.user_id;

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
      'role', v_app.facility_role,
      'status', 'REJECTED',
      'reason', p_reason
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'user_id', v_app.user_id,
    'status', 'REJECTED',
    'facility_id', v_app.requested_facility_id,
    'rejected_at', v_now
  );
END;
$$;

-- 4. Permissions & Trigger Hardening
-- Harden protect_clinician_onboarding_privileges to prevent NULL role bypass
CREATE OR REPLACE FUNCTION public.protect_clinician_onboarding_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF (auth.uid() IS NOT NULL) THEN
    v_caller_role := public.current_user_role();
    IF (COALESCE(v_caller_role, '') NOT IN ('admin')) THEN
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
$$;

-- Harden protect_profile_privileges to prevent NULL role bypass
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF (
    OLD.role IS DISTINCT FROM NEW.role OR 
    OLD.facility_id IS DISTINCT FROM NEW.facility_id OR
    OLD.is_active IS DISTINCT FROM NEW.is_active
  ) THEN
    IF (auth.uid() IS NOT NULL) THEN
      v_caller_role := public.current_user_role();
      IF (COALESCE(v_caller_role, '') NOT IN ('admin')) THEN
        RAISE EXCEPTION 'FORBIDDEN: Modifying role, facility_id, or is_active requires administrative privileges';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.protect_clinician_onboarding_privileges() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon;

-- Set search_path on functions to satisfy Supabase security advisor
ALTER FUNCTION public.set_documents_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_intake_session_transition() SET search_path = public, pg_temp;

