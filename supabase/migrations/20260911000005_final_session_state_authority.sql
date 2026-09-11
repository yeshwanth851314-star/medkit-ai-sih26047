-- =============================================================================
-- Migration: 20260911000005_final_session_state_authority.sql
-- Description: Final Session State Authority & Privileged Red-Flag RPC Boundary
--              1. Establishes trigger trg_enforce_intake_session_transitions on
--                 public.intake_sessions to prevent terminal session resurrection
--                 (reopening to active) or mutating revoked sessions across all paths.
--              2. Hardens rpc_revoke_kiosk_session with explicit target status allowlist
--                 ('abandoned', 'submitted') and state transition validation.
--              3. Hardens rpc_submit_kiosk_answer with fail-closed check against
--                 public.kiosk_capability_revocations.
--              4. Hardens rpc_submit_intake_to_case with fail-closed check against
--                 public.kiosk_capability_revocations, and restricts execution
--                 strictly to service_role (revoking anon/authenticated).
--              5. Revokes execution of legacy rpc_update_kiosk_intake_session from
--                 PUBLIC, anon, and authenticated roles.
-- =============================================================================

-- =============================================================================
-- 1. INTAKE SESSION STATE TRANSITION TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_intake_session_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent reopening a session that has reached terminal status
  IF OLD.status IN ('submitted', 'abandoned', 'expired', 'revoked') AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot reopen terminated intake session % from % to active',
      OLD.id, OLD.status;
  END IF;

  -- Prevent activating any session with an active revocation record
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1 FROM public.kiosk_capability_revocations
    WHERE session_id = OLD.id AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SESSION_REVOKED: Cannot activate revoked intake session %', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_intake_session_transitions ON public.intake_sessions;
CREATE TRIGGER trg_enforce_intake_session_transitions
  BEFORE UPDATE ON public.intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_intake_session_transition();

-- =============================================================================
-- 2. HARDEN rpc_revoke_kiosk_session
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_revoke_kiosk_session(
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_session_id UUID,
  p_reason TEXT DEFAULT 'abandoned_or_revoked',
  p_target_status TEXT DEFAULT 'abandoned'
) RETURNS VOID AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_secret_hash TEXT;
  v_now TIMESTAMPTZ := now();
  v_target_status TEXT;
BEGIN
  -- 1. Validate Kiosk credentials
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < v_now THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk registration has expired';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  -- 2. Validate target status against strict allowlist
  v_target_status := COALESCE(p_target_status, 'abandoned');
  IF v_target_status NOT IN ('abandoned', 'submitted') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS: Target status must be abandoned or submitted, received %', v_target_status;
  END IF;

  -- 3. Lock and verify session
  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    -- Fail-closed revocation record for unknown/missing session
    INSERT INTO public.kiosk_capability_revocations (session_id, revoked_at, reason, expires_at)
    VALUES (p_session_id, v_now, p_reason, v_now + interval '7 days')
    ON CONFLICT (session_id) DO UPDATE
    SET revoked_at = v_now, reason = p_reason;
    RETURN;
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility does not match kiosk facility';
  END IF;

  -- 4. Validate state transition
  IF v_session.status = v_target_status THEN
    -- Idempotent replay: already at target status
    NULL;
  ELSIF v_session.status = 'active' THEN
    -- Valid transition from active to terminal status
    NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot transition session % from % to %',
      p_session_id, v_session.status, v_target_status;
  END IF;

  -- 5. Update intake_sessions
  UPDATE public.intake_sessions
  SET status = v_target_status,
      completed_at = COALESCE(completed_at, v_now)
  WHERE id = p_session_id;

  -- 6. Upsert revocation record
  INSERT INTO public.kiosk_capability_revocations (session_id, revoked_at, reason, expires_at)
  VALUES (p_session_id, v_now, p_reason, v_now + interval '7 days')
  ON CONFLICT (session_id) DO UPDATE
  SET revoked_at = v_now, reason = p_reason;

  -- 7. Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    'kiosk:' || p_kiosk_id::text,
    'KIOSK_SESSION_REVOKED',
    'intake_sessions',
    p_session_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'targetStatus', v_target_status,
      'facilityId', v_kiosk.facility_id
    ),
    v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_revoke_kiosk_session(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_kiosk_session(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 3. HARDEN rpc_submit_kiosk_answer
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_kiosk_answer(
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_session_id UUID,
  p_question_key TEXT,
  p_raw_answer TEXT,
  p_input_mode TEXT DEFAULT 'touch',
  p_next_question_id TEXT DEFAULT NULL
) RETURNS public.intake_sessions AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_secret_hash TEXT;
  v_now TIMESTAMPTZ := now();
  v_answer_obj JSONB;
  v_updated_answers JSONB;
  v_new_status TEXT;
  v_completed_at TIMESTAMPTZ;
BEGIN
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < v_now THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk registration has expired';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  -- Verify session has not been revoked
  IF EXISTS (
    SELECT 1 FROM public.kiosk_capability_revocations
    WHERE session_id = p_session_id AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SESSION_REVOKED: Intake session % has been revoked', p_session_id;
  END IF;

  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Intake session % does not exist', p_session_id;
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE: Session status is %, expected active', v_session.status;
  END IF;

  IF v_session.expires_at < v_now THEN
    RAISE EXCEPTION 'SESSION_EXPIRED: Intake session has expired';
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility does not match kiosk facility';
  END IF;

  v_answer_obj := jsonb_build_object(
    'questionKey', p_question_key,
    'rawAnswer', p_raw_answer,
    'inputMode', COALESCE(p_input_mode, 'touch'),
    'timestamp', v_now
  );

  v_updated_answers := COALESCE(v_session.answers, '{}'::jsonb) || jsonb_build_object(p_question_key, v_answer_obj);
  
  IF p_next_question_id IS NULL THEN
    v_new_status := 'submitted';
    v_completed_at := v_now;
  ELSE
    v_new_status := 'active';
    v_completed_at := NULL;
  END IF;

  UPDATE public.intake_sessions
  SET answers = v_updated_answers,
      current_question_id = p_next_question_id,
      status = v_new_status,
      completed_at = COALESCE(v_completed_at, completed_at)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_submit_kiosk_answer(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_submit_kiosk_answer(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 4. HARDEN rpc_submit_intake_to_case (PRIVILEGED SERVICE ROLE ONLY)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_intake_to_case(
  p_session_id UUID,
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_red_flags JSONB DEFAULT '[]'::jsonb
) RETURNS public.cases AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_consent public.consents;
  v_case public.cases;
  v_chief_complaint TEXT;
  v_raw_complaint TEXT;
  v_secret_hash TEXT;
  v_now TIMESTAMPTZ := now();
  v_hpi JSONB := '{}'::jsonb;
  v_rf RECORD;
BEGIN
  -- 1. Validate Kiosk credentials
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk authentication credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < v_now THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk registration has expired';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  -- 2. Verify session has not been revoked
  IF EXISTS (
    SELECT 1 FROM public.kiosk_capability_revocations
    WHERE session_id = p_session_id AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SESSION_REVOKED: Intake session % has been revoked', p_session_id;
  END IF;

  -- 3. Validate Session
  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Intake session % does not exist', p_session_id;
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE: Session status is %, expected active', v_session.status;
  END IF;

  IF v_session.expires_at < v_now THEN
    RAISE EXCEPTION 'SESSION_EXPIRED: Intake session has expired';
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility % does not match kiosk facility %', v_session.facility_id, v_kiosk.facility_id;
  END IF;

  -- 4. Verify Active Non-Revoked Consent
  SELECT * INTO v_consent FROM public.consents 
  WHERE id = v_session.consent_id AND patient_id = v_session.patient_id;
  IF NOT FOUND OR v_consent.revoked IS TRUE OR v_consent.status != 'granted' THEN
    RAISE EXCEPTION 'CONSENT_REQUIRED: Valid unrevoked consent is required to compile case';
  END IF;

  -- 5. Extract and Validate Chief Complaint from answers JSONB
  v_chief_complaint := COALESCE(
    v_session.answers->'chief_complaint'->>'rawAnswer',
    v_session.answers->'Q_CHIEF_COMPLAINT'->>'rawAnswer',
    v_session.answers->'chief_complaint'->>'value',
    v_session.answers->'Q_CHIEF_COMPLAINT'->>'value',
    v_session.answers->>'chief_complaint'
  );
  v_raw_complaint := v_chief_complaint;

  IF v_chief_complaint IS NULL OR length(trim(v_chief_complaint)) < 3 THEN
    RAISE EXCEPTION 'INVALID_INTAKE: Chief complaint is required (min 3 characters)';
  END IF;

  -- 6. Build HPI from captured answers
  v_hpi := jsonb_build_object(
    'onset', COALESCE(v_session.answers->'chest_onset'->>'rawAnswer', v_session.answers->'general_onset'->>'rawAnswer'),
    'duration', v_session.answers->'cough_duration'->>'rawAnswer',
    'character', v_session.answers->'cough_type'->>'rawAnswer',
    'radiation', v_session.answers->'chest_radiation'->>'rawAnswer'
  );

  -- 7. Insert Draft Case conforming strictly to public.cases schema
  INSERT INTO public.cases (
    id,
    patient_id,
    consent_id,
    case_type,
    patient_language,
    chief_complaint,
    raw_patient_complaint,
    hpi,
    past_history,
    red_flags,
    status,
    provenance,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_session.patient_id,
    v_session.consent_id,
    'general',
    COALESCE(v_session.language, 'en'),
    trim(v_chief_complaint),
    v_raw_complaint,
    v_hpi,
    CASE WHEN v_session.answers ? 'past_conditions' 
      THEN jsonb_build_object('conditions', jsonb_build_array(v_session.answers->'past_conditions'->>'rawAnswer'))
      ELSE NULL 
    END,
    COALESCE(p_red_flags, '[]'::jsonb),
    'draft',
    jsonb_build_object('chief_complaint', 'patient', 'hpi', 'patient'),
    v_now,
    v_now
  ) RETURNING * INTO v_case;

  -- 8. Persist red flag events for clinical triage tracking atomically
  IF p_red_flags IS NOT NULL AND jsonb_array_length(p_red_flags) > 0 THEN
    FOR v_rf IN SELECT * FROM jsonb_to_recordset(p_red_flags) AS (
      "ruleId" TEXT,
      "severity" TEXT,
      "message" TEXT
    ) LOOP
      INSERT INTO public.red_flag_events (
        case_id,
        rule_id,
        severity,
        trigger_text,
        created_at
      ) VALUES (
        v_case.id,
        v_rf."ruleId",
        v_rf."severity",
        COALESCE(v_rf."message", 'Triggered red flag ' || v_rf."ruleId"),
        v_now
      );
    END LOOP;
  END IF;

  -- 9. Transition Session to 'submitted'
  UPDATE public.intake_sessions
  SET status = 'submitted',
      completed_at = v_now,
      compiled_case_id = v_case.id
  WHERE id = p_session_id;

  -- 10. Audit Log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    'kiosk:' || p_kiosk_id::text,
    'INTAKE_CASE_COMPILED',
    'cases',
    v_case.id::text,
    jsonb_build_object(
      'sessionId', p_session_id,
      'patientId', v_session.patient_id,
      'facilityId', v_kiosk.facility_id,
      'redFlagsCount', COALESCE(jsonb_array_length(p_red_flags), 0)
    ),
    v_now
  );

  RETURN v_case;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke all execute permissions from PUBLIC, anon, and authenticated roles.
-- Red-flag persistence during case compilation is strictly restricted to trusted server-side execution.
REVOKE ALL ON FUNCTION public.rpc_submit_intake_to_case(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_intake_to_case(UUID, UUID, TEXT, JSONB) TO service_role;

-- =============================================================================
-- 5. LOCK DOWN LEGACY rpc_update_kiosk_intake_session
-- =============================================================================

-- Revoke execution of legacy unrestricted kiosk update function from public/client roles
REVOKE ALL ON FUNCTION public.rpc_update_kiosk_intake_session(UUID, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_kiosk_intake_session(UUID, TEXT, UUID, TEXT, JSONB, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_update_kiosk_intake_session(
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_session_id UUID,
  p_current_question_id TEXT DEFAULT NULL,
  p_answers JSONB DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS public.intake_sessions AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_secret_hash TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < v_now THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk registration has expired';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  -- Verify session has not been revoked
  IF EXISTS (
    SELECT 1 FROM public.kiosk_capability_revocations
    WHERE session_id = p_session_id AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SESSION_REVOKED: Intake session % has been revoked', p_session_id;
  END IF;

  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Intake session % does not exist', p_session_id;
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility does not match kiosk facility';
  END IF;

  -- Validate status transition if status update requested
  IF p_status IS NOT NULL THEN
    IF p_status NOT IN ('active', 'submitted', 'abandoned') THEN
      RAISE EXCEPTION 'INVALID_TARGET_STATUS: Invalid status %', p_status;
    END IF;
    IF v_session.status IN ('submitted', 'abandoned', 'expired', 'revoked') AND p_status = 'active' THEN
      RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot reopen terminated session % from % to active',
        p_session_id, v_session.status;
    END IF;
  END IF;

  UPDATE public.intake_sessions
  SET current_question_id = COALESCE(p_current_question_id, current_question_id),
      answers = COALESCE(p_answers, answers),
      status = COALESCE(p_status, status),
      completed_at = CASE WHEN p_status IN ('submitted', 'abandoned') THEN v_now ELSE completed_at END
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
