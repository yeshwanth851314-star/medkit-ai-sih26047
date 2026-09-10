-- MedKit AI — Final Code Closure Migration
-- Migration: 20260910000002_final_code_closure.sql
-- Description: Resolves the final six production code defects:
--   1. Kiosk Provisioning RLS (rpc_provision_kiosk with role gating and facility derivation).
--   2. Durable Kiosk Revocations Table & Hardened Revocation RPC.
--   3. Sync Ledger User-Scoped Unique Constraint & Strict RLS.
--   4. Atomic Document Sync in rpc_execute_idempotent_mutation with Concurrency Advisory Locks.

--------------------------------------------------------------------------------
-- 1. Kiosk Instances Columns & Revocation Tracking
--------------------------------------------------------------------------------
ALTER TABLE public.kiosk_instances
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.kiosk_capability_revocations (
  session_id UUID PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kiosk_capability_revocations_expires 
  ON public.kiosk_capability_revocations(expires_at);

ALTER TABLE public.kiosk_capability_revocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated clinicians and kiosk RPC to view revocations" ON public.kiosk_capability_revocations;
  CREATE POLICY "Allow authenticated clinicians and kiosk RPC to view revocations"
    ON public.kiosk_capability_revocations FOR SELECT
    TO authenticated, anon
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

--------------------------------------------------------------------------------
-- 2. Kiosk Provisioning RPC (Blocker 1)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_provision_kiosk(
  p_name TEXT,
  p_secret_hash TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS public.kiosk_instances AS $$
DECLARE
  v_caller_id UUID;
  v_profile public.profiles;
  v_kiosk public.kiosk_instances;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to provision kiosks';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND OR v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Profile missing or inactive';
  END IF;

  -- Allowed roles: admin and staff only
  IF v_profile.role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % not permitted to provision kiosks', v_profile.role;
  END IF;

  IF v_profile.facility_id IS NULL OR length(trim(v_profile.facility_id)) = 0 THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Caller profile has no assigned facility';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Kiosk name must be at least 3 characters';
  END IF;

  IF p_secret_hash IS NULL OR length(trim(p_secret_hash)) < 32 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Valid secret hash required';
  END IF;

  INSERT INTO public.kiosk_instances (
    id,
    facility_id,
    name,
    secret_hash,
    status,
    created_by,
    created_at,
    updated_at,
    expires_at
  ) VALUES (
    gen_random_uuid(),
    v_profile.facility_id,
    trim(p_name),
    trim(p_secret_hash),
    'active',
    v_caller_id,
    v_now,
    v_now,
    COALESCE(p_expires_at, v_now + interval '365 days')
  ) RETURNING * INTO v_kiosk;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id::text,
    'KIOSK_PROVISIONED',
    'kiosk_instances',
    v_kiosk.id::text,
    jsonb_build_object('facilityId', v_kiosk.facility_id, 'name', v_kiosk.name),
    v_now
  );

  RETURN v_kiosk;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

--------------------------------------------------------------------------------
-- 3. Hardened Kiosk Session Revocation RPC (Blocker 4)
--------------------------------------------------------------------------------
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
BEGIN
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    -- Ensure revocation is recorded so that any replayed token is rejected
    INSERT INTO public.kiosk_capability_revocations (session_id, revoked_at, reason, expires_at)
    VALUES (p_session_id, v_now, p_reason, v_now + interval '7 days')
    ON CONFLICT (session_id) DO NOTHING;
    RETURN;
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility does not match kiosk facility';
  END IF;

  UPDATE public.intake_sessions
  SET status = COALESCE(p_target_status, 'abandoned'),
      completed_at = v_now
  WHERE id = p_session_id;

  INSERT INTO public.kiosk_capability_revocations (session_id, revoked_at, reason, expires_at)
  VALUES (p_session_id, v_now, p_reason, v_now + interval '7 days')
  ON CONFLICT (session_id) DO UPDATE
  SET revoked_at = v_now, reason = p_reason;

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
    jsonb_build_object('reason', p_reason, 'targetStatus', p_target_status, 'facilityId', v_kiosk.facility_id),
    v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_revoke_kiosk_session(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_kiosk_session(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 4. Sync Ledger Uniqueness & User-Scoped RLS (Blocker 5)
--------------------------------------------------------------------------------
ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_idempotency_key_key;
DROP INDEX IF EXISTS idx_sync_mutations_idempotency_key_unique;

ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_user_id_idempotency_key_key;
ALTER TABLE public.sync_mutations ADD CONSTRAINT sync_mutations_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);

DROP POLICY IF EXISTS "Authenticated clinicians and users can manage sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can manage own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can select own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can insert own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can update own sync mutations" ON public.sync_mutations;

CREATE POLICY "Users can select own sync mutations"
  ON public.sync_mutations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own sync mutations"
  ON public.sync_mutations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own sync mutations"
  ON public.sync_mutations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

--------------------------------------------------------------------------------
-- 5. Atomic Document Sync & Concurrency Lock in rpc_execute_idempotent_mutation (Blocker 6)
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
  v_caller_role TEXT;
  v_caller_facility TEXT;
  v_caller_active BOOLEAN;
  v_existing public.sync_mutations;
  v_mutation_id UUID;
  v_resource_id UUID;
  v_target_patient_id UUID;
  v_target_case_id UUID;
  v_target_doc_id UUID;
  v_patient public.patients;
  v_case public.cases;
  v_doc public.documents;
  v_now TIMESTAMPTZ := now();
  v_lease_expiry TIMESTAMPTZ := v_now + interval '30 seconds';
  v_result_summary JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required for idempotent mutation';
  END IF;

  -- Validate caller profile
  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Profile missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % not permitted to execute mutations', v_caller_role;
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: idempotency_key is required';
  END IF;

  -- Advisory transaction lock scoped to (caller_id, idempotency_key) to serialize concurrent requests
  PERFORM pg_advisory_xact_lock(hashtext('sync:' || v_caller_id::text || ':' || p_idempotency_key));

  -- Row lock sync_mutations entry
  SELECT * INTO v_existing 
  FROM public.sync_mutations 
  WHERE user_id = v_caller_id::text AND idempotency_key = p_idempotency_key 
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
        'resourceId', v_existing.resource_id,
        'summary', v_existing.result_metadata
      );
    END IF;

    IF v_existing.status = 'in_progress' AND v_existing.lease_expires_at > v_now THEN
      RAISE EXCEPTION 'LOCKED_IN_PROGRESS: Mutation is currently being processed by another worker';
    END IF;

    -- Reclaim lease
    UPDATE public.sync_mutations
    SET status = 'in_progress',
        payload_hash = p_payload_hash,
        lease_expires_at = v_lease_expiry,
        attempts = COALESCE(v_existing.attempts, 1) + 1,
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
      v_caller_id::text,
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

  -- Perform business mutation atomically inside this transaction
  IF p_entity = 'cases' THEN
    IF v_caller_role = 'staff' THEN
      RAISE EXCEPTION 'ROLE_UNAUTHORIZED: Staff members cannot create or update clinical cases.';
    END IF;

    IF p_action = 'create' THEN
      v_target_patient_id := COALESCE((p_payload->>'patientId')::uuid, (p_payload->>'patient_id')::uuid);
      IF v_target_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Case creation requires patientId.';
      END IF;

      SELECT * INTO v_patient FROM public.patients WHERE id = v_target_patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Target patient does not exist';
      END IF;

      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot create case outside assigned facility';
        END IF;
      END IF;

      INSERT INTO public.cases (
        id,
        patient_id,
        clinician_id,
        consent_id,
        case_type,
        patient_language,
        chief_complaint,
        raw_patient_complaint,
        hpi,
        past_history,
        medications,
        allergies,
        red_flags,
        status,
        provenance,
        created_at,
        updated_at
      ) VALUES (
        COALESCE((p_payload->>'id')::uuid, gen_random_uuid()),
        v_target_patient_id,
        v_caller_id,
        (p_payload->>'consentId')::uuid,
        COALESCE(p_payload->>'caseType', 'general'),
        COALESCE(p_payload->>'patientLanguage', 'en'),
        COALESCE(p_payload->>'chiefComplaint', p_payload->>'chief_complaint', 'Chief complaint pending'),
        p_payload->>'rawPatientComplaint',
        COALESCE(p_payload->'hpi', '{}'::jsonb),
        p_payload->'pastHistory',
        COALESCE(p_payload->'medications', '[]'::jsonb),
        COALESCE(p_payload->'allergies', '[]'::jsonb),
        COALESCE(p_payload->'red_flags', p_payload->'redFlags', '[]'::jsonb),
        'draft',
        COALESCE(p_payload->'provenance', '{}'::jsonb),
        v_now,
        v_now
      ) RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'caseId', v_resource_id);

    ELSIF p_action IN ('update', 'update_draft') THEN
      v_target_case_id := COALESCE((p_payload->>'id')::uuid, (p_payload->>'caseId')::uuid);
      IF v_target_case_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Case update requires id.';
      END IF;

      SELECT * INTO v_case FROM public.cases WHERE id = v_target_case_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'CASE_NOT_FOUND: Target case does not exist';
      END IF;

      SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot update case outside assigned facility';
        END IF;
      END IF;

      IF v_case.status = 'final' THEN
        RAISE EXCEPTION 'IMMUTABLE_FINAL_CASE: Finalized cases cannot be mutated directly';
      END IF;

      UPDATE public.cases
      SET chief_complaint = COALESCE(p_payload->>'chiefComplaint', p_payload->>'chief_complaint', chief_complaint),
          raw_patient_complaint = COALESCE(p_payload->>'rawPatientComplaint', raw_patient_complaint),
          hpi = COALESCE(p_payload->'hpi', hpi),
          past_history = COALESCE(p_payload->'pastHistory', past_history),
          medications = COALESCE(p_payload->'medications', medications),
          allergies = COALESCE(p_payload->'allergies', allergies),
          red_flags = COALESCE(p_payload->'red_flags', p_payload->'redFlags', red_flags),
          updated_at = v_now
      WHERE id = v_target_case_id
      RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'caseId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on cases is not supported', p_action;
    END IF;

  ELSIF p_entity = 'patients' THEN
    IF p_action = 'create' THEN
      INSERT INTO public.patients (
        id,
        patient_code,
        full_name,
        date_of_birth,
        gender,
        phone,
        facility_id,
        created_at,
        updated_at
      ) VALUES (
        COALESCE((p_payload->>'id')::uuid, gen_random_uuid()),
        COALESCE(p_payload->>'patientCode', 'MED-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6))),
        COALESCE(p_payload->>'fullName', 'Unnamed Patient'),
        (p_payload->>'dateOfBirth')::date,
        p_payload->>'gender',
        p_payload->>'phone',
        v_caller_facility,
        v_now,
        v_now
      ) RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'patientId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on patients is not supported', p_action;
    END IF;

  ELSIF p_entity = 'documents' THEN
    IF p_action = 'create' THEN
      v_target_patient_id := COALESCE((p_payload->>'patientId')::uuid, (p_payload->>'patient_id')::uuid);
      IF v_target_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Document creation requires patientId.';
      END IF;

      SELECT * INTO v_patient FROM public.patients WHERE id = v_target_patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Target patient does not exist';
      END IF;

      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot create document outside assigned facility';
        END IF;
      END IF;

      INSERT INTO public.documents (
        id,
        patient_id,
        case_id,
        uploaded_by,
        storage_path,
        original_filename,
        mime_type,
        file_size,
        document_type,
        processing_status,
        extracted_data,
        ocr_confidence,
        created_at,
        updated_at
      ) VALUES (
        COALESCE((p_payload->>'id')::uuid, gen_random_uuid()),
        v_target_patient_id,
        COALESCE((p_payload->>'caseId')::uuid, (p_payload->>'case_id')::uuid, NULL),
        v_caller_id::text,
        COALESCE(p_payload->>'storage_path', p_payload->>'storagePath', 'offline-sync/' || gen_random_uuid()::text),
        COALESCE(p_payload->>'original_filename', p_payload->>'originalFilename', 'document.bin'),
        COALESCE(p_payload->>'mime_type', p_payload->>'mimeType', 'application/octet-stream'),
        COALESCE((p_payload->>'file_size')::bigint, (p_payload->>'fileSize')::bigint, 0),
        COALESCE(p_payload->>'document_type', p_payload->>'documentType', 'prescription'),
        COALESCE(p_payload->>'processing_status', p_payload->>'processingStatus', 'uploaded'),
        COALESCE(p_payload->'extracted_data', p_payload->'extractedData', NULL),
        COALESCE((p_payload->>'ocr_confidence')::double precision, (p_payload->>'ocrConfidence')::double precision, NULL),
        v_now,
        v_now
      ) RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'documentId', v_resource_id);

    ELSIF p_action = 'update' THEN
      v_target_doc_id := COALESCE((p_payload->>'id')::uuid, (p_payload->>'documentId')::uuid, (p_payload->>'document_id')::uuid);
      IF v_target_doc_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Document update requires documentId.';
      END IF;

      SELECT * INTO v_doc FROM public.documents WHERE id = v_target_doc_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Target document does not exist';
      END IF;

      SELECT * INTO v_patient FROM public.patients WHERE id = v_doc.patient_id;
      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot update document outside assigned facility';
        END IF;
      END IF;

      -- Allowlist mutable metadata only: do not allow offline sync to alter source file or auto-confirm
      UPDATE public.documents
      SET extracted_data = COALESCE(p_payload->'extracted_data', p_payload->'extractedData', extracted_data),
          processing_status = COALESCE(p_payload->>'processing_status', p_payload->>'processingStatus', processing_status),
          ocr_confidence = COALESCE((p_payload->>'ocr_confidence')::double precision, (p_payload->>'ocrConfidence')::double precision, ocr_confidence),
          updated_at = v_now
      WHERE id = v_target_doc_id
      RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'documentId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on documents is not supported', p_action;
    END IF;
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ENTITY: Entity % is not supported for idempotent mutation', p_entity;
  END IF;

  -- Complete mutation record atomically
  UPDATE public.sync_mutations
  SET status = 'completed',
      completed_at = v_now,
      resource_id = v_resource_id::text,
      result_metadata = v_result_summary,
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
    v_resource_id::text,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'action', p_action, 'mutationId', v_mutation_id),
    v_now
  );

  RETURN jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'status', 'completed',
    'isReplay', false,
    'completedAt', v_now,
    'resourceId', v_resource_id,
    'summary', v_result_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
