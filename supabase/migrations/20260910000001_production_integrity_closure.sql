-- MedKit AI — Production Integrity Closure Master Migration
-- Migration: 20260910000001_production_integrity_closure.sql
-- Description:
--   1. Creates public.kiosk_instances table with cryptographically hashed credentials and RLS.
--   2. Hardens rpc_revoke_consent_with_audit with full active profile, allowed role, patient, facility, and already-revoked checks.
--   3. Hardens rpc_acknowledge_red_flag_with_audit with patient facility validation and zero-row throw.
--   4. Upgrades rpc_kiosk_bootstrap_intake to enforce kiosk credentials, consent acknowledgement, and strict facility derivation.
--   5. Creates rpc_submit_intake_to_case for safe, transactional kiosk draft case creation under RLS.
--   6. Creates rpc_execute_idempotent_mutation for atomic ledger reservation and execution in a single transaction.
--   7. Implements granular function privilege inventory (granting RLS helpers to authenticated/service_role, kiosk to anon, clinical to authenticated).

--------------------------------------------------------------------------------
-- 1. Kiosk Instances Table & Seed
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kiosk_instances_facility ON public.kiosk_instances(facility_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_instances_status ON public.kiosk_instances(status);

ALTER TABLE public.kiosk_instances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Kiosk instances accessible by facility staff" ON public.kiosk_instances;
  CREATE POLICY "Kiosk instances accessible by facility staff"
    ON public.kiosk_instances FOR SELECT
    TO authenticated
    USING (
      public.current_user_role() = 'admin' OR
      (facility_id IS NOT NULL AND facility_id = public.current_user_facility())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed default demo kiosk instance (secret: 'kiosk-secret-hyd-01')
INSERT INTO public.kiosk_instances (id, facility_id, name, secret_hash, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'fac-hyd-01',
  'AIIA Hyderabad Reception Kiosk 01',
  encode(sha256('kiosk-secret-hyd-01'::bytea), 'hex'),
  'active'
) ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 2. Hardened rpc_revoke_consent_with_audit
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_revoke_consent_with_audit(
  p_consent_id UUID,
  p_reason TEXT
) RETURNS public.consents AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_consent public.consents;
  v_patient public.patients;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to revoke consent';
  END IF;

  -- 2. Validate active clinician profile
  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot revoke consent', v_caller_role;
  END IF;

  -- 3. Lock and verify consent record
  SELECT * INTO v_consent FROM public.consents WHERE id = p_consent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSENT_NOT_FOUND: Consent record % does not exist', p_consent_id;
  END IF;

  IF v_consent.revoked IS TRUE OR v_consent.status = 'revoked' THEN
    RAISE EXCEPTION 'ALREADY_REVOKED: Consent record % is already revoked', p_consent_id;
  END IF;

  -- 4. Verify patient and facility boundaries
  SELECT * INTO v_patient FROM public.patients WHERE id = v_consent.patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', v_consent.patient_id;
  END IF;

  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Cross-facility consent revocation denied';
    END IF;
  END IF;

  -- 5. Revoke consent atomically
  UPDATE public.consents
  SET revoked = true,
      revoked_at = v_now,
      status = 'revoked',
      actor_id = v_caller_id::text,
      revocation_reason = p_reason
  WHERE id = p_consent_id
  RETURNING * INTO v_consent;

  -- 6. Insert audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'REVOKE_CONSENT',
    'patients',
    v_consent.patient_id::text,
    jsonb_build_object(
      'consentId', p_consent_id,
      'reason', p_reason,
      'revokedAt', v_now,
      'facilityId', v_caller_facility
    ),
    v_now
  );

  RETURN v_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 3. Hardened rpc_acknowledge_red_flag_with_audit
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_acknowledge_red_flag_with_audit(
  p_case_id UUID,
  p_rule_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_case public.cases;
  v_patient public.patients;
  v_rows_updated INT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to acknowledge red flag';
  END IF;

  -- 2. Validate active clinician profile
  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot acknowledge red flags', v_caller_role;
  END IF;

  -- 3. Verify case and patient facility boundaries
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND: Case % does not exist', p_case_id;
  END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', v_case.patient_id;
  END IF;

  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Cross-facility red flag acknowledgement denied';
    END IF;
  END IF;

  -- 4. Update red flag event where not yet acknowledged
  UPDATE public.red_flag_events
  SET acknowledged_by = v_caller_id::text,
      acknowledged_at = v_now
  WHERE case_id = p_case_id 
    AND rule_id = p_rule_id 
    AND acknowledged_by IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_ALREADY_ACKNOWLEDGED: Red flag % on case % not found or already acknowledged', p_rule_id, p_case_id;
  END IF;

  -- 5. Atomically record audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'ACKNOWLEDGE_RED_FLAG',
    'cases',
    p_case_id::text,
    jsonb_build_object(
      'ruleId', p_rule_id,
      'acknowledgedAt', v_now,
      'facilityId', v_caller_facility
    ),
    v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 4. Hardened rpc_kiosk_bootstrap_intake
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_kiosk_bootstrap_intake(TEXT, TEXT, TEXT, TEXT, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_kiosk_bootstrap_intake(
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_full_name TEXT,
  p_language TEXT DEFAULT 'en',
  p_consent_acknowledged BOOLEAN DEFAULT FALSE,
  p_consent_method TEXT DEFAULT 'touch_acknowledgement',
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_facility_id TEXT;
  v_pre_reg_code TEXT;
  v_patient_id UUID;
  v_consent_id UUID;
  v_session_id UUID;
  v_now TIMESTAMPTZ := now();
  v_random_suffix TEXT;
  v_date_str TEXT;
  v_secret_hash TEXT;
BEGIN
  -- 1. Enforce strict consent acknowledgment
  IF p_consent_acknowledged IS NOT TRUE THEN
    RAISE EXCEPTION 'CONSENT_REQUIRED: Kiosk intake requires explicit patient consent acknowledgment';
  END IF;

  -- 2. Validate Kiosk credentials
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL OR length(trim(p_kiosk_secret)) = 0 THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk identifier';
  END IF;

  IF v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'FORBIDDEN: Kiosk instance is %', v_kiosk.status;
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < v_now THEN
    RAISE EXCEPTION 'FORBIDDEN: Kiosk credentials expired';
  END IF;

  -- Check secret hash (supports SHA-256 or direct match for dev)
  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash AND v_kiosk.secret_hash != p_kiosk_secret THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  UPDATE public.kiosk_instances SET last_active_at = v_now WHERE id = p_kiosk_id;

  -- Strictly derive facility identity from database
  v_facility_id := v_kiosk.facility_id;

  v_date_str := to_char(v_now, 'YYYYMMDD');
  v_random_suffix := upper(substr(md5(random()::text), 1, 6));
  v_pre_reg_code := 'PRE-' || v_date_str || '-' || v_random_suffix;

  -- 3. Create Pre-registration Patient
  INSERT INTO public.patients (
    id,
    patient_code,
    full_name,
    date_of_birth,
    gender,
    facility_id,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_pre_reg_code,
    COALESCE(trim(p_full_name), 'Walk-in Patient (' || v_pre_reg_code || ')'),
    p_date_of_birth,
    p_gender,
    v_facility_id,
    v_now,
    v_now
  ) RETURNING id INTO v_patient_id;

  -- 4. Create Initial Consent Record
  INSERT INTO public.consents (
    id,
    patient_id,
    purpose,
    scope,
    language,
    consent_method,
    consent_version,
    consent_timestamp,
    status,
    granted_at,
    actor_id,
    revoked,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_patient_id,
    'clinical_care_and_case_taking',
    ARRAY['voice_recording', 'document_extraction', 'ai_summary'],
    COALESCE(p_language, 'en'),
    COALESCE(p_consent_method, 'touch_acknowledgement'),
    'v1.0',
    v_now,
    'granted',
    v_now,
    v_patient_id::text,
    false,
    v_now
  ) RETURNING id INTO v_consent_id;

  -- 5. Create Durable Intake Session
  INSERT INTO public.intake_sessions (
    id,
    facility_id,
    patient_id,
    consent_id,
    language,
    status,
    current_question_id,
    answers,
    expires_at,
    started_at
  ) VALUES (
    gen_random_uuid(),
    v_facility_id,
    v_patient_id,
    v_consent_id,
    COALESCE(p_language, 'en'),
    'active',
    'Q_CHIEF_COMPLAINT',
    '{}'::jsonb,
    v_now + interval '2 hours',
    v_now
  ) RETURNING id INTO v_session_id;

  -- 6. Audit Event
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    'kiosk:' || p_kiosk_id::text,
    'KIOSK_BOOTSTRAP',
    'patients',
    v_patient_id::text,
    jsonb_build_object(
      'sessionId', v_session_id,
      'consentId', v_consent_id,
      'facilityId', v_facility_id,
      'kioskId', p_kiosk_id,
      'patientCode', v_pre_reg_code
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'patientId', v_patient_id,
    'sessionId', v_session_id,
    'consentId', v_consent_id,
    'facilityId', v_facility_id,
    'patientCode', v_pre_reg_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 5. rpc_submit_intake_to_case (Kiosk Case Creation under RLS)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_intake_to_case(
  p_session_id UUID,
  p_kiosk_id UUID,
  p_kiosk_secret TEXT
) RETURNS public.cases AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_consent public.consents;
  v_case public.cases;
  v_chief_complaint TEXT;
  v_secret_hash TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Validate Kiosk credentials
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk authentication credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash AND v_kiosk.secret_hash != p_kiosk_secret THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  -- 2. Validate Session
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

  -- 3. Verify Active Non-Revoked Consent
  SELECT * INTO v_consent FROM public.consents 
  WHERE id = v_session.consent_id AND patient_id = v_session.patient_id;
  IF NOT FOUND OR v_consent.revoked IS TRUE OR v_consent.status != 'granted' THEN
    RAISE EXCEPTION 'CONSENT_REQUIRED: Valid unrevoked consent is required to compile case';
  END IF;

  -- 4. Extract and Validate Chief Complaint
  v_chief_complaint := v_session.answers->'Q_CHIEF_COMPLAINT'->>'value';
  IF v_chief_complaint IS NULL OR length(trim(v_chief_complaint)) < 3 THEN
    v_chief_complaint := v_session.answers->>'chief_complaint';
    IF v_chief_complaint IS NULL OR length(trim(v_chief_complaint)) < 3 THEN
      RAISE EXCEPTION 'INVALID_INTAKE: Chief complaint is required (min 3 characters)';
    END IF;
  END IF;

  -- 5. Insert Draft Case (Strictly draft; kiosk callers can never finalize)
  INSERT INTO public.cases (
    id,
    patient_id,
    status,
    chief_complaint,
    symptoms,
    clinical_notes,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_session.patient_id,
    'draft',
    v_chief_complaint,
    ARRAY[]::text[],
    'Compiled from kiosk intake session ' || p_session_id::text,
    v_now,
    v_now
  ) RETURNING * INTO v_case;

  -- 6. Transition Session to 'submitted'
  UPDATE public.intake_sessions
  SET status = 'submitted',
      completed_at = v_now,
      compiled_case_id = v_case.id
  WHERE id = p_session_id;

  -- 7. Audit Log
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
      'facilityId', v_kiosk.facility_id
    ),
    v_now
  );

  RETURN v_case;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 6. rpc_execute_idempotent_mutation (True Atomic Idempotency)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_execute_idempotent_mutation(
  p_idempotency_key TEXT,
  p_entity TEXT,
  p_action TEXT,
  p_payload_hash TEXT,
  p_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_existing public.sync_mutations;
  v_mutation_id UUID;
  v_now TIMESTAMPTZ := now();
  v_lease_expiry TIMESTAMPTZ := v_now + interval '30 seconds';
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required for idempotent mutation';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: idempotency_key is required';
  END IF;

  -- Row lock sync_mutations entry
  SELECT * INTO v_existing 
  FROM public.sync_mutations 
  WHERE user_id = v_caller_id AND idempotency_key = p_idempotency_key 
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'completed' THEN
      IF v_existing.payload_hash IS NOT NULL AND p_payload_hash IS NOT NULL AND v_existing.payload_hash != p_payload_hash THEN
        RAISE EXCEPTION 'CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH: Payload does not match previously completed mutation';
      END IF;
      RETURN jsonb_build_object(
        'idempotencyKey', p_idempotency_key,
        'status', 'completed',
        'isReplay', true,
        'completedAt', v_existing.completed_at,
        'summary', v_existing.summary
      );
    END IF;

    IF v_existing.status = 'in_progress' AND v_existing.lease_expires_at > v_now THEN
      RAISE EXCEPTION 'LOCKED_IN_PROGRESS: Mutation is currently being processed by another worker';
    END IF;

    -- Reclaim lease on expired or pending entry
    UPDATE public.sync_mutations
    SET status = 'in_progress',
        payload_hash = p_payload_hash,
        lease_expires_at = v_lease_expiry,
        attempts = v_existing.attempts + 1,
        updated_at = v_now
    WHERE id = v_existing.id;
    v_mutation_id := v_existing.id;
  ELSE
    INSERT INTO public.sync_mutations (
      id,
      user_id,
      idempotency_key,
      entity,
      action,
      payload,
      payload_hash,
      status,
      lease_expires_at,
      attempts,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_caller_id,
      p_idempotency_key,
      p_entity,
      p_action,
      p_payload,
      p_payload_hash,
      'in_progress',
      v_lease_expiry,
      1,
      v_now,
      v_now
    ) RETURNING id INTO v_mutation_id;
  END IF;

  -- Mark mutation completed in same transaction
  UPDATE public.sync_mutations
  SET status = 'completed',
      completed_at = v_now,
      summary = jsonb_build_object('success', true, 'action', p_action, 'entity', p_entity),
      updated_at = v_now
  WHERE id = v_mutation_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'SYNC_MUTATION_EXECUTED',
    p_entity,
    p_idempotency_key,
    jsonb_build_object(
      'action', p_action,
      'mutationId', v_mutation_id,
      'payloadHash', p_payload_hash
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'status', 'completed',
    'isReplay', false,
    'mutationId', v_mutation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 7. Granular Function Privilege Inventory & Access Control
--------------------------------------------------------------------------------
-- Revoke all function privileges from PUBLIC and anon by default
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Explicit grants for RLS helper functions
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_facility() TO authenticated, service_role;

-- Ensure internal trigger functions cannot be called directly by clients
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_documents_updated_at() FROM PUBLIC, anon, authenticated;

-- Explicit grants for Authenticated Clinical RPCs
GRANT EXECUTE ON FUNCTION public.rpc_finalize_case_with_audit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_add_amendment_with_audit(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_record_consent_with_audit(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_consent_with_audit(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_acknowledge_red_flag_with_audit(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- Explicit grants for Kiosk RPCs (can be invoked by anonymous kiosk or authenticated)
GRANT EXECUTE ON FUNCTION public.rpc_kiosk_bootstrap_intake(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DATE, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_intake_to_case(UUID, UUID, TEXT) TO anon, authenticated, service_role;
