-- =============================================================================
-- Migration: 20260918000001_fix_audit_table_and_case_concurrency.sql
-- Description:
--   1. Expand public.audit_logs resource_type check constraint to include 'clinician_onboarding'
--   2. Fix approve_clinician_application and reject_clinician_application to insert into public.audit_logs
--   3. Add atomic case compare-and-swap RPC rpc_update_case_atomic
-- =============================================================================

-- 1. Expand audit_logs resource_type CHECK constraint
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
    'clinician_onboarding'
  ));

-- 2. Correct approve_clinician_application to write to public.audit_logs
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
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: An authenticated administrative session is required for facility approval';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_admin_profile
  FROM public.profiles
  WHERE id = v_admin_id;

  IF NOT FOUND OR v_admin_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Approving administrator profile not found or inactive';
  END IF;

  IF v_admin_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % is not authorized to approve facility applications', v_admin_profile.role;
  END IF;

  SELECT * INTO v_app
  FROM public.clinician_professional_profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: Clinician application % does not exist', p_profile_id;
  END IF;

  IF v_admin_profile.facility_id IS NOT NULL AND v_admin_profile.facility_id <> v_app.requested_facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Facility administrator cannot approve applicant for a different healthcare facility';
  END IF;

  IF v_app.account_status <> 'PENDING_FACILITY_APPROVAL' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Application must be in PENDING_FACILITY_APPROVAL state (current: %)', v_app.account_status;
  END IF;

  IF v_app.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Professional credentials must be verified before approval (current: %)', v_app.verification_status;
  END IF;

  IF v_app.mfa_enrolled IS NOT TRUE THEN
    RAISE EXCEPTION 'APPLICATION_NOT_ELIGIBLE: Multi-factor authentication must be enrolled before approval';
  END IF;

  UPDATE public.clinician_professional_profiles
  SET
    account_status = 'ACTIVE',
    mfa_assurance_level = 'aal2',
    facility_approved_by = v_admin_id,
    facility_approved_at = v_now,
    updated_at = v_now
  WHERE id = p_profile_id;

  UPDATE public.profiles
  SET
    is_active = true,
    facility_id = v_app.requested_facility_id,
    role = v_app.facility_role,
    updated_at = v_now
  WHERE id = v_app.user_id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_admin_id::TEXT,
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

REVOKE EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_clinician_application(UUID, TEXT) TO authenticated, service_role;

-- 3. Correct reject_clinician_application to write to public.audit_logs
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

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_admin_id::TEXT,
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

REVOKE EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_clinician_application(UUID, TEXT) TO authenticated, service_role;

-- 4. Atomic compare-and-swap RPC for cases
CREATE OR REPLACE FUNCTION public.rpc_update_case_atomic(
  p_case_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_case RECORD;
  v_patient RECORD;
  v_now TIMESTAMPTZ := now();
  v_updated_case public.cases;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required for case update';
  END IF;

  SELECT id, role, facility_id, is_active INTO v_caller_profile
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller profile not found or inactive';
  END IF;

  IF v_caller_profile.role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot update clinical cases', v_caller_profile.role;
  END IF;

  -- Lock target case FOR UPDATE
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND: Case % does not exist', p_case_id;
  END IF;

  -- Finalized cases are immutable
  IF v_case.status = 'final' THEN
    RAISE EXCEPTION 'IMMUTABLE_FINAL_CASE: Finalized cases cannot be mutated directly';
  END IF;

  -- Verify facility isolation via patient
  SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
  IF v_caller_profile.role <> 'admin' THEN
    IF v_caller_profile.facility_id IS NULL OR v_patient.facility_id IS NULL OR v_caller_profile.facility_id <> v_patient.facility_id THEN
      RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot access case outside assigned facility';
    END IF;
  END IF;

  -- Enforce optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_case.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'CONFLICT_CONCURRENT_UPDATE: Case was modified concurrently by another session (expected %, current %)',
      p_expected_updated_at, v_case.updated_at;
  END IF;

  -- Apply updates
  UPDATE public.cases
  SET
    chief_complaint = COALESCE(p_updates->>'chief_complaint', p_updates->>'chiefComplaint', v_case.chief_complaint),
    raw_patient_complaint = COALESCE(p_updates->>'raw_patient_complaint', p_updates->>'rawPatientComplaint', v_case.raw_patient_complaint),
    hpi = COALESCE(p_updates->'hpi', v_case.hpi),
    past_history = COALESCE(p_updates->'past_history', p_updates->'pastHistory', v_case.past_history),
    medications = COALESCE(p_updates->'medications', p_updates->'medication_history', v_case.medications),
    allergies = COALESCE(p_updates->'allergies', p_updates->'allergy_history', v_case.allergies),
    red_flags = COALESCE(p_updates->'red_flags', p_updates->'redFlags', v_case.red_flags),
    provenance = COALESCE(p_updates->'provenance', v_case.provenance),
    updated_at = v_now
  WHERE id = p_case_id
  RETURNING * INTO v_updated_case;

  RETURN row_to_json(v_updated_case)::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_update_case_atomic(UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_case_atomic(UUID, TIMESTAMPTZ, JSONB) TO authenticated, service_role;
