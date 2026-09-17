-- ==============================================================================
-- MedKit AI — Phase C Final Security Closure Migration
-- Migration: 20260917000001_phase_c_final_security_closure.sql
-- Invariants:
--   1. Authoritative remote invitation revocation RPC with strict facility boundary.
--   2. Cross-facility external identifier duplicate matching returns opaque results
--      (Zero patient UUID, name, DOB, phone, or facility leaks).
--   3. Hardened permissions: execute grants for authenticated clinicians.
-- ==============================================================================

-- 1. RPC: Revoke Remote Intake Invitation
CREATE OR REPLACE FUNCTION public.rpc_revoke_remote_intake_invitation(
  p_invitation_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_facility text;
  v_caller_active boolean;
  v_inv public.remote_intake_invitations;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to revoke intake invitation';
  END IF;

  -- Verify caller profile
  SELECT role, facility_id, is_active
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller profile is not active or verified';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient role to revoke intake invitations';
  END IF;

  -- Fetch target invitation
  SELECT * INTO v_inv
  FROM public.remote_intake_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND: Remote intake invitation not found';
  END IF;

  -- Facility boundary check: non-admin cannot revoke another facility's invitation
  IF v_caller_role != 'admin' AND v_inv.facility_id != v_caller_facility THEN
    RAISE EXCEPTION 'FORBIDDEN: Cannot revoke invitation belonging to another facility';
  END IF;

  -- Set revoked timestamp
  UPDATE public.remote_intake_invitations
  SET revoked_at = now()
  WHERE id = p_invitation_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    v_caller_id::text,
    'REMOTE_INVITE_REVOKED',
    'invitations',
    p_invitation_id::text,
    jsonb_build_object(
      'facilityId', v_inv.facility_id,
      'reason', COALESCE(p_reason, 'Clinician revoked invitation')
    ),
    now()
  );

  RETURN true;
END;
$$;

-- 2. Update RPC: Duplicate Patient Detection with Cross-Facility Privacy Preservation
CREATE OR REPLACE FUNCTION public.rpc_find_duplicate_patient_candidates(
  p_facility_id text,
  p_phone text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_abha_id text DEFAULT NULL,
  p_facility_mrn text DEFAULT NULL
)
RETURNS TABLE (
  candidate_patient_id uuid,
  candidate_patient_code text,
  candidate_full_name text,
  candidate_date_of_birth date,
  candidate_phone text,
  candidate_facility_id text,
  match_type text,
  match_confidence text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- 1. Deterministic Facility MRN match (IDENTIFIER_CONFLICT) - strictly scoped to facility
  IF p_facility_mrn IS NOT NULL AND length(trim(p_facility_mrn)) > 0 THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'EXACT_FACILITY_MRN'::text, 'IDENTIFIER_CONFLICT'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id AND p.patient_code = trim(p_facility_mrn);
  END IF;

  -- 2. Deterministic ABHA match:
  -- If match is within caller's facility -> return candidate details
  -- If match is in another facility -> return OPAQUE indicator (Zero patient UUID, name, DOB, phone, or facility leaks)
  IF p_abha_id IS NOT NULL AND length(trim(p_abha_id)) > 0 THEN
    RETURN QUERY
    SELECT
      CASE WHEN p.facility_id = p_facility_id THEN p.id ELSE NULL::uuid END,
      CASE WHEN p.facility_id = p_facility_id THEN p.patient_code ELSE NULL::text END,
      CASE WHEN p.facility_id = p_facility_id THEN p.full_name ELSE 'REDACTED_CROSS_FACILITY'::text END,
      CASE WHEN p.facility_id = p_facility_id THEN p.date_of_birth ELSE NULL::date END,
      CASE WHEN p.facility_id = p_facility_id THEN p.phone ELSE NULL::text END,
      CASE WHEN p.facility_id = p_facility_id THEN p.facility_id ELSE NULL::text END,
      CASE WHEN p.facility_id = p_facility_id THEN 'EXACT_ABHA_ID'::text ELSE 'EXTERNAL_IDENTIFIER_EXISTS_OUTSIDE_CURRENT_FACILITY'::text END,
      CASE WHEN p.facility_id = p_facility_id THEN 'STRONG_MATCH'::text ELSE 'MANUAL_IDENTITY_REVIEW_REQUIRED'::text END
    FROM public.patients p
    WHERE p.abha_id = trim(p_abha_id);
  END IF;

  -- 3. Normalized Phone match within same facility (POSSIBLE_MATCH)
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'PHONE_MATCH'::text, 'POSSIBLE_MATCH'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id
      AND p.phone IS NOT NULL
      AND (
        regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
        OR
        right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
      )
      AND (p_facility_mrn IS NULL OR p.patient_code != trim(p_facility_mrn));
  END IF;

  -- 4. Exact Name + DOB match within same facility (POSSIBLE_MATCH)
  IF p_full_name IS NOT NULL AND p_date_of_birth IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'NAME_AND_DOB_MATCH'::text, 'POSSIBLE_MATCH'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id
      AND lower(trim(p.full_name)) = lower(trim(p_full_name))
      AND p.date_of_birth = p_date_of_birth;
  END IF;

  RETURN;
END;
$$;

-- 3. Update Row-Level Security on remote_intake_invitations for UPDATE
DROP POLICY IF EXISTS "Remote invites updatable by facility staff" ON public.remote_intake_invitations;
CREATE POLICY "Remote invites updatable by facility staff"
ON public.remote_intake_invitations
FOR UPDATE
TO authenticated
USING (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
)
WITH CHECK (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

-- 4. Grants & Execution Permissions
REVOKE ALL ON FUNCTION public.rpc_revoke_remote_intake_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_remote_intake_invitation(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_find_duplicate_patient_candidates(text, text, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_find_duplicate_patient_candidates(text, text, text, date, text, text) TO authenticated;
