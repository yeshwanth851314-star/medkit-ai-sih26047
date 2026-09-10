-- =============================================================================
-- Migration: 20260911000001_production_contract_closure.sql
-- Description: Final production contract closure after full-project audit.
-- - makes active profile status authoritative in RLS helpers and consent RPC
-- - prevents self-reactivation / privilege self-modification
-- - locks sync_mutations writes behind the SECURITY DEFINER RPC
-- - binds idempotency server-side to entity/action/actual JSONB payload
-- - validates case consent provenance
-- - requires facility assignment for facility-bound clinical callers
-- - enforces exact canonical document Storage path semantics
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active IS TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.current_user_facility()
RETURNS TEXT AS $$
  SELECT facility_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active IS TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_facility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_facility() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-side administrative SQL has no end-user auth.uid(); ordinary users do.
  IF auth.uid() IS NOT NULL AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.facility_id IS DISTINCT FROM NEW.facility_id
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
     ) THEN
    IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'FORBIDDEN: Modifying role, facility_id, or is_active requires administrative privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;

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
  v_caller_active BOOLEAN;
  v_patient public.patients;
  v_consent public.consents;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to record consent';
  END IF;

  SELECT role, facility_id, is_active
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Clinician profile is missing or inactive';
  END IF;
  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot record patient consent', v_caller_role;
  END IF;
  IF v_caller_role != 'admin' AND (v_caller_facility IS NULL OR length(trim(v_caller_facility)) = 0) THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Facility-bound clinical caller has no assigned facility';
  END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', p_patient_id;
  END IF;
  IF v_caller_role != 'admin' AND (v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Cross-facility consent recording denied';
  END IF;

  INSERT INTO public.consents (
    id, patient_id, purpose, scope, language, consent_method, consent_version,
    consent_timestamp, status, granted_at, actor_id, revoked, created_at
  ) VALUES (
    gen_random_uuid(), p_patient_id, p_purpose, p_scope, p_language, p_method,
    p_version, v_now, 'granted', v_now, v_caller_id::text, false, v_now
  ) RETURNING * INTO v_consent;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    v_caller_id::text, 'CONSENT_RECORDED', 'patients', p_patient_id::text,
    jsonb_build_object(
      'consentId', v_consent.id, 'purpose', p_purpose, 'scope', p_scope,
      'method', p_method, 'language', p_language, 'actorRole', v_caller_role,
      'facilityId', v_caller_facility
    ),
    v_now
  );
  RETURN v_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.rpc_record_consent_with_audit(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_record_consent_with_audit(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT) TO authenticated, service_role;

-- The sync ledger is internal state. Authenticated callers may inspect only their
-- own rows (or admins may inspect all) but cannot write it directly.
DROP POLICY IF EXISTS "Sync mutations caller scoped" ON public.sync_mutations;
DROP POLICY IF EXISTS "Authenticated clinicians and users can manage sync mutations" ON public.sync_mutations;
CREATE POLICY "Sync mutations readable by owner or active admin"
  ON public.sync_mutations FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.current_user_role() = 'admin');

REVOKE ALL ON public.sync_mutations FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.sync_mutations FROM authenticated;
GRANT SELECT ON public.sync_mutations TO authenticated;

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
  v_case_patient public.patients;
  v_doc public.documents;
  v_now TIMESTAMPTZ := now();
  v_lease_expiry TIMESTAMPTZ := v_now + interval '30 seconds';
  v_result_summary JSONB;
  v_raw_storage_path TEXT;
  v_clean_path TEXT;
  v_canonical_path TEXT;
  v_path_patient_id TEXT;
  v_path_case_id TEXT;
  v_payload_case_id TEXT;
  v_doc_status TEXT;
  v_storage_exists BOOLEAN := false;
  v_supplied_facility TEXT;
  v_payload_hash TEXT;
  v_target_consent_id UUID;
  v_consent public.consents;
  v_path_document_id TEXT;
  v_path_parts TEXT[];
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required for idempotent mutation';
  END IF;

  -- Validate caller profile
  SELECT role, facility_id, is_active
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Profile missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % not permitted to execute mutations', v_caller_role;
  END IF;

  IF v_caller_role != 'admin' AND (v_caller_facility IS NULL OR length(trim(v_caller_facility)) = 0) THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Facility-bound clinical caller has no assigned facility';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: idempotency_key is required';
  END IF;

  -- Security source of truth: compute the payload hash inside PostgreSQL from JSONB.
  -- p_payload_hash is retained only for backward-compatible RPC signature stability.
  v_payload_hash := encode(
    digest(convert_to(COALESCE(p_payload, '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  );

  -- Advisory transaction lock scoped to (caller_id, idempotency_key) to serialize concurrent requests
  PERFORM pg_advisory_xact_lock(hashtext('sync:' || v_caller_id::text || ':' || p_idempotency_key));

  -- Row lock sync_mutations entry
  SELECT * INTO v_existing 
  FROM public.sync_mutations 
  WHERE user_id = v_caller_id::text AND idempotency_key = p_idempotency_key 
  FOR UPDATE;

  IF FOUND THEN
    -- Bind an idempotency key to the original entity, action, and actual payload for ALL states.
    -- Never let an expired/stale lease be reclaimed with a different request contract.
    IF v_existing.entity IS DISTINCT FROM p_entity
       OR v_existing.action IS DISTINCT FROM p_action
       OR v_existing.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency key is already bound to a different entity/action/payload';
    END IF;

    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'idempotencyKey', p_idempotency_key,
        'status', 'completed',
        'isReplay', true,
        'mutationId', v_existing.id,
        'completedAt', v_existing.completed_at,
        'resourceId', v_existing.resource_id,
        'summary', v_existing.result_metadata
      );
    END IF;

    IF v_existing.status = 'in_progress' AND v_existing.lease_expires_at > v_now THEN
      RAISE EXCEPTION 'LOCKED_IN_PROGRESS: Mutation is currently being processed by another worker';
    END IF;

    -- Reclaim only the lease. Entity/action/payload hash remain immutable for this key.
    UPDATE public.sync_mutations
    SET status = 'in_progress',
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
      v_payload_hash,
      'in_progress',
      v_lease_expiry,
      1,
      v_now,
      v_now
    ) RETURNING id INTO v_mutation_id;
  END IF;

  ------------------------------------------------------------------------------
  -- Entity Mutation Logic
  ------------------------------------------------------------------------------
  IF p_entity = 'cases' THEN
    IF v_caller_role = 'staff' THEN
      RAISE EXCEPTION 'ROLE_UNAUTHORIZED: Staff members cannot create or update clinical cases';
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

      v_target_consent_id := COALESCE(
        NULLIF(p_payload->>'consentId', '')::uuid,
        NULLIF(p_payload->>'consent_id', '')::uuid
      );

      IF v_target_consent_id IS NOT NULL THEN
        SELECT * INTO v_consent FROM public.consents WHERE id = v_target_consent_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'CONSENT_NOT_FOUND: Referenced consent does not exist';
        END IF;
        IF v_consent.patient_id != v_target_patient_id THEN
          RAISE EXCEPTION 'CONSENT_PATIENT_MISMATCH: Consent does not belong to the target patient';
        END IF;
        IF v_consent.revoked IS TRUE OR v_consent.status IS DISTINCT FROM 'granted' OR v_consent.revoked_at IS NOT NULL THEN
          RAISE EXCEPTION 'CONSENT_INVALID: Referenced consent is not currently granted';
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
        v_target_consent_id,
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

      -- Resolve case facility through parent patient (cases table has no facility_id column)
      SELECT * INTO v_patient FROM public.patients WHERE id = v_case.patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Parent patient for case does not exist';
      END IF;

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
      v_supplied_facility := COALESCE(p_payload->>'facilityId', p_payload->>'facility_id');

      -- Non-admin callers cannot create patients for other facilities; reject if mismatched
      IF v_caller_role != 'admin' THEN
        IF v_supplied_facility IS NOT NULL AND v_supplied_facility != '' AND v_supplied_facility != v_caller_facility THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot create patient outside assigned facility';
        END IF;
        -- Force caller facility
        v_supplied_facility := v_caller_facility;
      ELSE
        -- Admin: use supplied facility or fallback to admin facility
        v_supplied_facility := COALESCE(v_supplied_facility, v_caller_facility);
      END IF;

      INSERT INTO public.patients (
        id,
        patient_code,
        full_name,
        date_of_birth,
        gender,
        phone,
        facility_id,
        abha_id,
        created_at,
        updated_at
      ) VALUES (
        COALESCE((p_payload->>'id')::uuid, gen_random_uuid()),
        COALESCE(p_payload->>'patientCode', p_payload->>'patient_code', 'PT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
        COALESCE(p_payload->>'fullName', p_payload->>'full_name', 'Unnamed Patient'),
        (p_payload->>'dateOfBirth')::date,
        p_payload->>'gender',
        p_payload->>'phone',
        v_supplied_facility,
        p_payload->>'abhaId',
        v_now,
        v_now
      ) RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'patientId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on patients is not supported', p_action;
    END IF;

  ELSIF p_entity = 'documents' THEN
    IF p_action = 'create' THEN
      -- Strict check: block clinician-only status transitions
      v_doc_status := COALESCE(p_payload->>'processing_status', p_payload->>'processingStatus', 'uploaded');
      IF v_doc_status IN ('confirmed', 'accepted', 'verified', 'final', 'clinician_confirmed', 'reviewed', 'rejected') OR 
         v_doc_status NOT IN ('uploaded', 'processing', 'extracted', 'review', 'failed') THEN
        RAISE EXCEPTION 'FORBIDDEN_DOCUMENT_STATUS_TRANSITION: Offline sync cannot set clinician-only status %', v_doc_status;
      END IF;

      v_target_patient_id := COALESCE((p_payload->>'patientId')::uuid, (p_payload->>'patient_id')::uuid);
      IF v_target_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Document creation requires patientId.';
      END IF;

      SELECT * INTO v_patient FROM public.patients WHERE id = v_target_patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Referenced patient does not exist';
      END IF;

      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot upload document for patient outside assigned facility';
        END IF;
      END IF;

      -- Exact canonical Storage path validation. The persisted application path is
      -- /private/documents/patients/{patientUuid}/cases/{caseUuid|uncategorized}/{documentUuid}/{filename}
      -- while storage.objects.name is strictly the bucket-relative suffix.
      v_raw_storage_path := COALESCE(p_payload->>'storage_path', p_payload->>'storagePath');
      IF v_raw_storage_path IS NULL OR length(trim(v_raw_storage_path)) = 0 THEN
        RAISE EXCEPTION 'STORAGE_PATH_REQUIRED: Document creation requires a valid, pre-existing storage path';
      END IF;

      IF v_raw_storage_path ~ '[?#]' OR v_raw_storage_path ~ '\\' OR v_raw_storage_path ~ '\.\.'
         OR v_raw_storage_path ~* '%2e' OR v_raw_storage_path ~* '%2f' OR v_raw_storage_path ~* '%5c'
         OR v_raw_storage_path ~* '^[a-zA-Z][a-zA-Z0-9+.-]*:'
         OR v_raw_storage_path LIKE 'offline-sync/%' OR v_raw_storage_path LIKE '%/offline-sync/%'
         OR v_raw_storage_path LIKE '%//%' THEN
        RAISE EXCEPTION 'STORAGE_PATH_INVALID: Unsafe or non-canonical storage path';
      END IF;

      IF v_raw_storage_path LIKE '/%' AND v_raw_storage_path NOT LIKE '/private/documents/%' THEN
        RAISE EXCEPTION 'STORAGE_PATH_INVALID: Absolute paths must use /private/documents/ canonical prefix';
      END IF;

      v_clean_path := regexp_replace(trim(v_raw_storage_path), '^/?private/documents/', '');
      v_path_parts := regexp_match(
        v_clean_path,
        '^patients/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/cases/(uncategorized|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/([A-Za-z0-9][A-Za-z0-9._-]*)$'
      );
      IF v_path_parts IS NULL THEN
        RAISE EXCEPTION 'STORAGE_PATH_INVALID: Path must exactly match patients/{patientId}/cases/{caseId|uncategorized}/{documentId}/{filename}';
      END IF;

      v_path_patient_id := v_path_parts[1];
      v_path_case_id := v_path_parts[2];
      v_path_document_id := v_path_parts[3];

      IF v_path_patient_id != v_target_patient_id::text THEN
        RAISE EXCEPTION 'STORAGE_PATH_PATIENT_MISMATCH: Path patient % does not match document patient %', v_path_patient_id, v_target_patient_id;
      END IF;

      v_payload_case_id := NULLIF(COALESCE(p_payload->>'caseId', p_payload->>'case_id'), '');
      IF v_payload_case_id IS NOT NULL THEN
        IF v_path_case_id != v_payload_case_id THEN
          RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Path case segment % does not match payload case %', v_path_case_id, v_payload_case_id;
        END IF;
        SELECT * INTO v_case FROM public.cases WHERE id = v_payload_case_id::uuid;
        IF NOT FOUND OR v_case.patient_id != v_target_patient_id THEN
          RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Referenced case does not exist for target patient';
        END IF;
        SELECT * INTO v_case_patient FROM public.patients WHERE id = v_case.patient_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'PATIENT_NOT_FOUND: Case parent patient does not exist';
        END IF;
        IF v_caller_role != 'admin' AND v_case_patient.facility_id != v_caller_facility THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot associate document with case outside assigned facility';
        END IF;
      ELSIF v_path_case_id != 'uncategorized' THEN
        RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Document without caseId must use uncategorized path';
      END IF;

      v_target_doc_id := COALESCE(
        NULLIF(p_payload->>'id', '')::uuid,
        NULLIF(p_payload->>'documentId', '')::uuid,
        NULLIF(p_payload->>'document_id', '')::uuid
      );
      IF v_target_doc_id IS NOT NULL AND v_target_doc_id::text != v_path_document_id THEN
        RAISE EXCEPTION 'STORAGE_PATH_DOCUMENT_MISMATCH: Path documentId does not match payload document id';
      END IF;
      v_target_doc_id := v_path_document_id::uuid;
      v_canonical_path := '/private/documents/' || v_clean_path;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'objects'
      ) THEN
        RAISE EXCEPTION 'STORAGE_VERIFICATION_FAILED: storage.objects is unavailable';
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM storage.objects
        WHERE bucket_id = 'clinical-documents'
          AND name = v_clean_path
      ) INTO v_storage_exists;

      IF NOT v_storage_exists THEN
        RAISE EXCEPTION 'STORAGE_OBJECT_NOT_FOUND: Storage object does not exist at %', v_canonical_path;
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
        v_target_doc_id,
        v_target_patient_id,
        CASE 
          WHEN v_payload_case_id IS NOT NULL AND v_payload_case_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          THEN v_payload_case_id::uuid 
          ELSE NULL 
        END,
        v_caller_id::text,
        v_canonical_path,
        COALESCE(p_payload->>'original_filename', p_payload->>'originalFilename', 'document.bin'),
        COALESCE(p_payload->>'mime_type', p_payload->>'mimeType', 'application/octet-stream'),
        COALESCE((p_payload->>'file_size')::bigint, (p_payload->>'fileSize')::bigint, 0),
        COALESCE(p_payload->>'document_type', p_payload->>'documentType', 'prescription'),
        v_doc_status,
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

      -- Load document parent patient and verify facility access
      SELECT * INTO v_patient FROM public.patients WHERE id = v_doc.patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Document parent patient does not exist';
      END IF;

      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot update document outside assigned facility';
        END IF;
      END IF;

      -- Verify immutable provenance and integrity fields
      IF (p_payload ? 'patient_id') OR (p_payload ? 'patientId') OR
         (p_payload ? 'facility_id') OR (p_payload ? 'facilityId') OR
         (p_payload ? 'storage_path') OR (p_payload ? 'storagePath') OR
         (p_payload ? 'uploaded_by') OR (p_payload ? 'uploadedBy') OR
         (p_payload ? 'created_at') OR (p_payload ? 'createdAt') OR
         (p_payload ? 'confirmed_by') OR (p_payload ? 'confirmedBy') OR
         (p_payload ? 'confirmed_at') OR (p_payload ? 'confirmedAt') THEN
        RAISE EXCEPTION 'IMMUTABLE_FIELD_TAMPERING: Offline sync cannot mutate document provenance or verification fields';
      END IF;

      -- Block clinician-only status transitions
      IF (p_payload ? 'processing_status') OR (p_payload ? 'processingStatus') THEN
        v_doc_status := COALESCE(p_payload->>'processing_status', p_payload->>'processingStatus');
        IF v_doc_status IN ('confirmed', 'accepted', 'verified', 'final', 'clinician_confirmed', 'reviewed', 'rejected') OR 
           v_doc_status NOT IN ('uploaded', 'processing', 'extracted', 'review', 'failed') THEN
          RAISE EXCEPTION 'FORBIDDEN_DOCUMENT_STATUS_TRANSITION: Offline sync cannot set clinician-only status %', v_doc_status;
        END IF;
      END IF;

      UPDATE public.documents
      SET processing_status = COALESCE(p_payload->>'processing_status', p_payload->>'processingStatus', processing_status),
          extracted_data = COALESCE(p_payload->'extracted_data', p_payload->'extractedData', extracted_data),
          ocr_confidence = COALESCE((p_payload->>'ocr_confidence')::double precision, (p_payload->>'ocrConfidence')::double precision, ocr_confidence),
          updated_at = v_now
      WHERE id = v_target_doc_id
      RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'documentId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on documents is not supported', p_action;
    END IF;

  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ENTITY: Entity type % is not supported for idempotent mutation', p_entity;
  END IF;

  -- Mark mutation completed and store result summary
  UPDATE public.sync_mutations
  SET status = 'completed',
      resource_id = v_resource_id::text,
      result_metadata = v_result_summary,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = v_mutation_id;

  -- Transactional audit logging inside the same database transaction.
  -- If audit log insert fails, the entire transaction (including mutation) will roll back.
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
    jsonb_build_object(
      'idempotencyKey', p_idempotency_key,
      'mutationId', v_mutation_id,
      'action', p_action,
      'entity', p_entity,
      'payloadHash', v_payload_hash,
      'facilityId', v_caller_facility,
      'role', v_caller_role
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'status', 'completed',
    'isReplay', false,
    'mutationId', v_mutation_id,
    'completedAt', v_now,
    'resourceId', v_resource_id,
    'summary', v_result_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
