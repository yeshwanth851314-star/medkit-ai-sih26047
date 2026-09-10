-- =============================================================================
-- Migration: 20260910000006_final_schema_rpc_consistency.sql
-- Description: Final Database / RPC Consistency & Zero-Vulnerability Closure
--
-- Closes:
-- 1. Eliminate case column drift (clinician_id vs legacy clinician assignment column).
-- 2. Eliminate nonexistent cases.facility_id references; derive case facility
--    strictly through cases.patient_id -> patients.facility_id.
-- 3. Patient CREATE rejects client facilityId mismatch for non-admins and
--    forces v_caller_facility.
-- 4. Restore transactional audit logging (public.audit_logs insert inside the
--    same database transaction).
-- 5. Harden SECURITY DEFINER execution with SET search_path = public, pg_temp.
-- 6. Canonicalize storage path contract (/private/documents/... canonical vs
--    bucket-relative object name in clinical-documents bucket).
-- 7. Explicit privilege hardening: REVOKE from PUBLIC/anon, GRANT to authenticated.
-- =============================================================================

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

      -- Canonical Storage Path Validation
      v_raw_storage_path := COALESCE(p_payload->>'storage_path', p_payload->>'storagePath');
      IF v_raw_storage_path IS NULL OR length(trim(v_raw_storage_path)) = 0 THEN
        RAISE EXCEPTION 'STORAGE_PATH_REQUIRED: Document creation requires a valid, pre-existing storage path';
      END IF;

      -- Reject fake offline placeholder paths
      IF v_raw_storage_path LIKE 'offline-sync/%' OR v_raw_storage_path LIKE '%/offline-sync/%' THEN
        RAISE EXCEPTION 'STORAGE_PATH_REQUIRED: Fake offline-sync placeholder paths are strictly prohibited';
      END IF;

      -- Reject traversal attempts
      IF v_raw_storage_path ~ '\.\.' OR v_raw_storage_path ~ '\\' OR v_raw_storage_path ~* '%2e' OR v_raw_storage_path ~* '%5c' THEN
        RAISE EXCEPTION 'STORAGE_PATH_TRAVERSAL: Path traversal sequences are strictly forbidden';
      END IF;

      -- Reject URL schemes
      IF v_raw_storage_path ~* '^[a-zA-Z][a-zA-Z0-9+.-]*:' THEN
        RAISE EXCEPTION 'STORAGE_PATH_INVALID: Protocol schemes are forbidden in storage paths';
      END IF;

      -- Normalize and clean relative path
      v_clean_path := regexp_replace(v_raw_storage_path, '^/+', '');
      v_clean_path := regexp_replace(v_clean_path, '^(private/documents/)?', '');
      v_clean_path := regexp_replace(v_clean_path, '^/+', '');

      -- Verify canonical prefix structure
      IF NOT (v_clean_path ~ '^patients/([a-zA-Z0-9_-]+)') THEN
        RAISE EXCEPTION 'STORAGE_PATH_INVALID: Path must follow canonical structure starting with patients/{patientId}';
      END IF;

      -- Verify patient ID binding
      v_path_patient_id := (regexp_match(v_clean_path, '^patients/([a-zA-Z0-9_-]+)'))[1];
      IF v_path_patient_id != v_target_patient_id::text THEN
        RAISE EXCEPTION 'STORAGE_PATH_PATIENT_MISMATCH: Path patient % does not match document patient %', v_path_patient_id, v_target_patient_id;
      END IF;

      -- Extract case segment from clean path
      IF v_clean_path ~ '^patients/[^/]+/cases/([^/]+)' THEN
        v_path_case_id := (regexp_match(v_clean_path, '^patients/[^/]+/cases/([^/]+)'))[1];
      ELSE
        v_path_case_id := 'uncategorized';
      END IF;

      v_payload_case_id := COALESCE(p_payload->>'caseId', p_payload->>'case_id', NULL);

      IF v_payload_case_id IS NOT NULL AND length(trim(v_payload_case_id)) > 0 THEN
        -- Case ID is specified in payload:
        -- 1. Path segment must match payload caseId
        IF v_path_case_id != v_payload_case_id THEN
          RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Path case segment % does not match payload case %', v_path_case_id, v_payload_case_id;
        END IF;

        -- 2. Case must exist in DB and belong to this patient
        IF v_payload_case_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          SELECT * INTO v_case FROM public.cases WHERE id = v_payload_case_id::uuid;
          IF NOT FOUND OR v_case.patient_id != v_target_patient_id THEN
            RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Referenced case % does not exist for patient %', v_payload_case_id, v_target_patient_id;
          END IF;

          -- 3. Case must belong to caller facility (derived strictly via parent patient)
          SELECT * INTO v_case_patient FROM public.patients WHERE id = v_case.patient_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'PATIENT_NOT_FOUND: Case parent patient does not exist';
          END IF;

          IF v_caller_role != 'admin' THEN
            IF v_caller_facility IS NULL OR v_case_patient.facility_id IS NULL OR v_caller_facility != v_case_patient.facility_id THEN
              RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot associate document with case outside assigned facility';
            END IF;
          END IF;
        ELSE
          RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Invalid case UUID format %', v_payload_case_id;
        END IF;
      ELSE
        -- No case ID in payload: path case segment MUST be 'uncategorized'
        IF v_path_case_id != 'uncategorized' THEN
          RAISE EXCEPTION 'STORAGE_PATH_CASE_MISMATCH: Unassociated document must use uncategorized case path segment, found %', v_path_case_id;
        END IF;
      END IF;

      -- Canonical storage path persisted to database
      v_canonical_path := '/private/documents/' || v_clean_path;

      -- Verify existence in Supabase Storage bucket (if storage.objects table is active)
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'objects'
      ) THEN
        SELECT EXISTS (
          SELECT 1 FROM storage.objects
          WHERE bucket_id = 'clinical-documents'
            AND (name = v_clean_path OR name = 'private/documents/' || v_clean_path OR name = v_raw_storage_path)
        ) INTO v_storage_exists;

        IF NOT v_storage_exists THEN
          RAISE EXCEPTION 'STORAGE_OBJECT_NOT_FOUND: Storage object does not exist at %', v_raw_storage_path;
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
      resource_id = v_resource_id,
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
      'payloadHash', p_payload_hash,
      'facilityId', v_caller_facility,
      'role', v_caller_role
    ),
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

-- Revoke all execute privileges from PUBLIC and anonymous users
REVOKE ALL ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
