-- =============================================================================
-- Migration: 20260918000002_fix_rpc_update_case_atomic_types.sql
-- Description:
--   Correct column type expressions in rpc_update_case_atomic so JSONB and text
--   types match strictly and avoid plpgsql type resolution errors.
-- =============================================================================

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
