-- =============================================================================
-- Migration: 20260911000004_clinician_actor_and_revocation_integrity.sql
-- Description: Hardens rpc_clinician_revoke_session target status validation
--              and state transition enforcement.
--              1. Validates p_target_status against explicit allowlist:
--                 strictly ('abandoned', 'submitted').
--              2. Enforces valid state transitions:
--                 - active -> abandoned or submitted allowed.
--                 - idempotent abandoned -> abandoned or submitted -> submitted allowed/no-op.
--                 - Any transition attempting to set active or reopen terminated
--                   sessions rejected with INVALID_STATE_TRANSITION.
--              3. Verifies caller auth.uid(), active profile, and facility match.
--              4. Maintains atomic audit log with KIOSK_SESSION_REVOKED.
--              5. Hardens SECURITY DEFINER search_path and role privileges.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_clinician_revoke_session(
  p_session_id UUID,
  p_reason TEXT DEFAULT 'clinician_revoked',
  p_target_status TEXT DEFAULT 'abandoned'
) RETURNS VOID AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_session public.intake_sessions;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to revoke kiosk session';
  END IF;

  -- 2. Validate active clinician profile
  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot revoke kiosk sessions', v_caller_role;
  END IF;

  -- 3. Lock and verify session
  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Intake session % does not exist', p_session_id;
  END IF;

  -- 4. Verify facility boundaries (admin can revoke across facilities)
  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_session.facility_id IS NULL OR v_caller_facility != v_session.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Clinician facility % does not match session facility %',
        COALESCE(v_caller_facility, 'none'), COALESCE(v_session.facility_id, 'none');
    END IF;
  END IF;

  -- 5. Validate target status allowlist
  IF p_target_status IS NULL OR p_target_status NOT IN ('abandoned', 'submitted') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS: Target status must be abandoned or submitted, received %', p_target_status;
  END IF;

  -- 6. Enforce valid state transitions
  IF v_session.status = p_target_status THEN
    -- Idempotent replay: already at target status
    NULL;
  ELSIF v_session.status = 'active' AND p_target_status IN ('abandoned', 'submitted') THEN
    -- Valid transition from active to terminal status
    NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot transition session % from % to %',
      p_session_id, v_session.status, p_target_status;
  END IF;

  -- 7. Update intake_sessions
  UPDATE public.intake_sessions
  SET status = p_target_status,
      completed_at = COALESCE(completed_at, v_now)
  WHERE id = p_session_id;

  -- 8. Upsert into kiosk_capability_revocations
  INSERT INTO public.kiosk_capability_revocations (
    session_id,
    revoked_at,
    reason,
    expires_at
  ) VALUES (
    p_session_id,
    v_now,
    COALESCE(p_reason, 'clinician_revoked'),
    v_now + INTERVAL '7 days'
  )
  ON CONFLICT (session_id) DO UPDATE
  SET revoked_at = EXCLUDED.revoked_at,
      reason = EXCLUDED.reason,
      expires_at = EXCLUDED.expires_at;

  -- 9. Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'KIOSK_SESSION_REVOKED',
    'intake_sessions',
    p_session_id::text,
    jsonb_build_object(
      'reason', COALESCE(p_reason, 'clinician_revoked'),
      'targetStatus', p_target_status,
      'actorRole', v_caller_role,
      'facilityId', v_session.facility_id
    ),
    v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke all permissions from anon and PUBLIC; grant execute to authenticated and service_role
REVOKE ALL ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_clinician_revoke_session(UUID, TEXT, TEXT) TO authenticated, service_role;
