-- MedKit AI — Zero-Compromise Remediation Gate Migration
-- Migration: 20260909000001_remediation_zero_compromise.sql
-- Description: 
--   1. Aligns sync_mutations schema (adds payload_hash, lease_expires_at, updates UNIQUE(user_id, idempotency_key)).
--   2. Creates durable public.intake_sessions table for kiosk intakes.
--   3. Enforces finalized case immutability in PostgreSQL RLS (disallowing direct UPDATE on status = 'final').
--   4. Creates atomic, secure PostgreSQL RPC functions deriving caller identity strictly from auth.uid().
--   5. Implements rpc_kiosk_bootstrap_intake for unauthenticated walk-in registration without broad anon tables access.
--   6. Hardens search_path and revokes broad EXECUTE permissions.

--------------------------------------------------------------------------------
-- 1. Sync Mutations Table Alignment
--------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.sync_mutations
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Update status check constraint to include 'in_progress'
DO $$ BEGIN
  ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_status_check;
  ALTER TABLE public.sync_mutations 
    ADD CONSTRAINT sync_mutations_status_check 
    CHECK (status IN ('in_progress', 'pending', 'completed', 'failed'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Align idempotency uniqueness to (user_id, idempotency_key)
DO $$ BEGIN
  ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_idempotency_key_key;
  ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_user_key_uniq;
  ALTER TABLE public.sync_mutations 
    ADD CONSTRAINT sync_mutations_user_key_uniq UNIQUE (user_id, idempotency_key);
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sync_mutations_key_hash 
  ON public.sync_mutations(idempotency_key, payload_hash);

--------------------------------------------------------------------------------
-- 2. Durable Intake Sessions Table (Replaces process-memory Maps)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consent_id UUID REFERENCES public.consents(id) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'te')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'abandoned', 'expired')),
  current_question_id TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  compiled_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intake_sessions_patient ON public.intake_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_facility ON public.intake_sessions(facility_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_status ON public.intake_sessions(status);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_expires ON public.intake_sessions(expires_at);

ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Intake sessions accessible by facility clinicians and staff" ON public.intake_sessions;
  CREATE POLICY "Intake sessions accessible by facility clinicians and staff"
    ON public.intake_sessions FOR SELECT
    TO authenticated
    USING (
      public.current_user_role() = 'admin' OR
      (facility_id IS NOT NULL AND facility_id = public.current_user_facility())
    );

  DROP POLICY IF EXISTS "Intake sessions insertable by facility clinicians and staff" ON public.intake_sessions;
  CREATE POLICY "Intake sessions insertable by facility clinicians and staff"
    ON public.intake_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
      public.current_user_role() = 'admin' OR
      (facility_id IS NOT NULL AND facility_id = public.current_user_facility())
    );

  DROP POLICY IF EXISTS "Intake sessions updatable by facility clinicians and staff" ON public.intake_sessions;
  CREATE POLICY "Intake sessions updatable by facility clinicians and staff"
    ON public.intake_sessions FOR UPDATE
    TO authenticated
    USING (
      public.current_user_role() = 'admin' OR
      (facility_id IS NOT NULL AND facility_id = public.current_user_facility())
    )
    WITH CHECK (
      public.current_user_role() = 'admin' OR
      (facility_id IS NOT NULL AND facility_id = public.current_user_facility())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

--------------------------------------------------------------------------------
-- 3. Case Amendments Table
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_amendments_case_id ON public.case_amendments(case_id);
ALTER TABLE public.case_amendments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Case amendments viewable by authorized facility clinicians" ON public.case_amendments;
  CREATE POLICY "Case amendments viewable by authorized facility clinicians"
    ON public.case_amendments FOR SELECT
    TO authenticated
    USING (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = case_amendments.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

--------------------------------------------------------------------------------
-- 4. Enforce Finalized Case Immutability in PostgreSQL RLS
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Cases updatable by licensed clinicians only" ON public.cases;

CREATE POLICY "Cases updatable by licensed clinicians only"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (
    status = 'draft' AND
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = cases.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  )
  WITH CHECK (
    status = 'draft' AND
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = cases.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

--------------------------------------------------------------------------------
-- 5. Hardened Transactional PostgreSQL RPC Functions
--------------------------------------------------------------------------------

-- 5.1 Finalize Case with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.rpc_finalize_case_with_audit(
  p_case_id UUID
) RETURNS public.cases AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_case public.cases;
  v_patient public.patients;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to finalize case';
  END IF;

  -- 2. Read trusted profile
  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot finalize cases', v_caller_role;
  END IF;

  -- 3. Lock and verify case
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND: Case % does not exist', p_case_id;
  END IF;

  IF v_case.status = 'final' THEN
    RAISE EXCEPTION 'ALREADY_FINAL: Case % is already finalized', p_case_id;
  END IF;

  -- 4. Verify facility boundary
  SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', v_case.patient_id;
  END IF;

  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Cross-facility case finalization denied';
    END IF;
  END IF;

  -- 5. Update case to final
  UPDATE public.cases
  SET status = 'final',
      finalized_at = v_now,
      finalized_by = v_caller_id::text,
      updated_at = v_now
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  -- 6. Atomically write audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'FINALIZE_CASE',
    'cases',
    p_case_id::text,
    jsonb_build_object(
      'actorRole', v_caller_role,
      'facilityId', v_caller_facility,
      'finalizedAt', v_now
    ),
    v_now
  );

  RETURN v_case;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.2 Add Case Amendment with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.rpc_add_amendment_with_audit(
  p_case_id UUID,
  p_reason TEXT,
  p_notes TEXT
) RETURNS public.case_amendments AS $$
DECLARE
  v_caller_id UUID;
  v_caller_name TEXT;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_case public.cases;
  v_patient public.patients;
  v_version INT;
  v_amendment public.case_amendments;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to amend case';
  END IF;

  -- 2. Read trusted profile
  SELECT full_name, role, facility_id, COALESCE(is_active, true)
  INTO v_caller_name, v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot amend cases', v_caller_role;
  END IF;

  -- 3. Verify case is final
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND: Case % does not exist', p_case_id;
  END IF;
  IF v_case.status != 'final' THEN
    RAISE EXCEPTION 'CANNOT_AMEND_DRAFT: Only finalized cases can be amended';
  END IF;

  -- 4. Verify facility boundary
  SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', v_case.patient_id;
  END IF;

  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Cross-facility case amendment denied';
    END IF;
  END IF;

  -- 5. Determine next version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.case_amendments
  WHERE case_id = p_case_id;

  -- 6. Insert amendment into append-only table (pure UUID generated by gen_random_uuid())
  INSERT INTO public.case_amendments (
    id,
    case_id,
    author_id,
    author_name,
    reason,
    notes,
    version,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_case_id,
    v_caller_id::text,
    COALESCE(v_caller_name, 'Attending Clinician'),
    p_reason,
    p_notes,
    v_version,
    v_now
  ) RETURNING * INTO v_amendment;

  -- 7. Atomically insert audit record
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'AMEND_CASE',
    'cases',
    p_case_id::text,
    jsonb_build_object(
      'version', v_version,
      'reason', p_reason,
      'facilityId', v_caller_facility,
      'amendmentId', v_amendment.id
    ),
    v_now
  );

  RETURN v_amendment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.3 Record Consent with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.rpc_record_consent_with_audit(
  p_patient_id UUID,
  p_purpose TEXT,
  p_scope TEXT[],
  p_language TEXT,
  p_method TEXT,
  p_version TEXT
) RETURNS public.consents AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_patient public.patients;
  v_consent public.consents;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to record consent';
  END IF;

  SELECT role, facility_id INTO v_caller_role, v_caller_facility
  FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot record patient consent', v_caller_role;
  END IF;

  -- 2. Verify patient and facility
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', p_patient_id;
  END IF;

  IF v_caller_role != 'admin' THEN
    IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Cross-facility consent recording denied';
    END IF;
  END IF;

  -- 3. Insert consent record
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
    p_patient_id,
    p_purpose,
    p_scope,
    p_language,
    p_method,
    p_version,
    v_now,
    'granted',
    v_now,
    v_caller_id::text,
    false,
    v_now
  ) RETURNING * INTO v_consent;

  -- 4. Atomically write single audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'CONSENT_RECORDED',
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'consentId', v_consent.id,
      'purpose', p_purpose,
      'scope', p_scope,
      'method', p_method,
      'language', p_language,
      'actorRole', v_caller_role,
      'facilityId', v_caller_facility
    ),
    v_now
  );

  RETURN v_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.4 Revoke Consent with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.rpc_revoke_consent_with_audit(
  p_consent_id UUID,
  p_reason TEXT
) RETURNS public.consents AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_consent public.consents;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to revoke consent';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  SELECT * INTO v_consent FROM public.consents WHERE id = p_consent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSENT_NOT_FOUND: Consent record % does not exist', p_consent_id;
  END IF;

  UPDATE public.consents
  SET revoked = true,
      revoked_at = v_now,
      status = 'revoked',
      actor_id = v_caller_id::text,
      revocation_reason = p_reason
  WHERE id = p_consent_id
  RETURNING * INTO v_consent;

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
      'revokedAt', v_now
    ),
    v_now
  );

  RETURN v_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.5 Acknowledge Red Flag with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.rpc_acknowledge_red_flag_with_audit(
  p_case_id UUID,
  p_rule_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to acknowledge red flag';
  END IF;

  SELECT role, facility_id INTO v_caller_role, v_caller_facility
  FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot acknowledge red flags', v_caller_role;
  END IF;

  -- 1. Update red flag event
  UPDATE public.red_flag_events
  SET acknowledged_by = v_caller_id::text,
      acknowledged_at = v_now
  WHERE case_id = p_case_id AND rule_id = p_rule_id;

  -- 2. Atomically record audit log
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

-- 5.6 Restricted Kiosk Bootstrap Intake Function
-- Creates pre-registration patient, session, and consent atomically under RLS
CREATE OR REPLACE FUNCTION public.rpc_kiosk_bootstrap_intake(
  p_facility_id TEXT,
  p_full_name TEXT,
  p_language TEXT DEFAULT 'en',
  p_consent_method TEXT DEFAULT 'touch_acknowledgement',
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_pre_reg_code TEXT;
  v_patient_id UUID;
  v_consent_id UUID;
  v_session_id UUID;
  v_now TIMESTAMPTZ := now();
  v_random_suffix TEXT;
  v_date_str TEXT;
BEGIN
  IF p_facility_id IS NULL OR length(trim(p_facility_id)) = 0 THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Intake kiosk requires assigned facility identity';
  END IF;

  v_date_str := to_char(v_now, 'YYYYMMDD');
  v_random_suffix := upper(substr(md5(random()::text), 1, 6));
  v_pre_reg_code := 'PRE-' || v_date_str || '-' || v_random_suffix;

  -- 1. Create Pre-registration Patient
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
    p_facility_id,
    v_now,
    v_now
  ) RETURNING id INTO v_patient_id;

  -- 2. Create Initial Consent Record
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

  -- 3. Create Durable Intake Session
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
    p_facility_id,
    v_patient_id,
    v_consent_id,
    COALESCE(p_language, 'en'),
    'active',
    'Q_CHIEF_COMPLAINT',
    '{}'::jsonb,
    v_now + interval '2 hours',
    v_now
  ) RETURNING id INTO v_session_id;

  -- 4. Audit Event
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    'kiosk:' || p_facility_id,
    'KIOSK_BOOTSTRAP',
    'patients',
    v_patient_id::text,
    jsonb_build_object(
      'sessionId', v_session_id,
      'consentId', v_consent_id,
      'facilityId', p_facility_id,
      'patientCode', v_pre_reg_code
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'patientId', v_patient_id,
    'sessionId', v_session_id,
    'consentId', v_consent_id,
    'facilityId', p_facility_id,
    'patientCode', v_pre_reg_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--------------------------------------------------------------------------------
-- 6. Secure Privileges
--------------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_finalize_case_with_audit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_amendment_with_audit(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_consent_with_audit(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_consent_with_audit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_acknowledge_red_flag_with_audit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kiosk_bootstrap_intake(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO anon, authenticated;
