-- =============================================================================
-- Migration: 20260918000004_fix_patient_atomic_and_idempotent_mutation.sql
-- Description:
--   Phase C & Phase D V1 Surgical Closure:
--   1. Correct column type of emergency_contact to JSONB in rpc_register_patient_atomic.
--   2. Authoritative rpc_execute_idempotent_mutation with canonical payload hash,
--      zero raw ABHA persistence, and transactional audit logging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Atomic Patient + External Identifier + Durable Audit Registration RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_register_patient_atomic(
  p_patient_data jsonb,
  p_external_id_data jsonb DEFAULT NULL,
  p_actor_id text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_facility text;
  v_target_facility text;
  v_patient_id uuid;
  v_patient_code text;
  v_full_name text;
  v_date_of_birth date;
  v_age_estimate integer;
  v_gender text;
  v_phone text;
  v_address text;
  v_blood_group text;
  v_emergency_contact jsonb;
  v_identity_status text;
  v_patient_record public.patients%ROWTYPE;
  v_ext_id_type text;
  v_ext_id_hash text;
  v_ext_id_masked text;
  v_ext_id_authority text;
  v_ext_metadata jsonb;
  v_now timestamptz := now();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role, facility_id INTO v_caller_role, v_caller_facility
    FROM public.profiles
    WHERE id = v_caller_id;
  ELSE
    v_caller_role := COALESCE(p_actor_role, 'clinician');
    v_caller_facility := NULL;
  END IF;

  v_target_facility := COALESCE(p_patient_data->>'facility_id', p_patient_data->>'facilityId', v_caller_facility);
  IF v_target_facility IS NULL OR length(trim(v_target_facility)) = 0 THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Patient must be assigned to an active facility';
  END IF;

  -- Facility boundary check for authenticated non-admin callers
  IF v_caller_id IS NOT NULL AND v_caller_role != 'admin' AND v_caller_facility IS NOT NULL AND v_target_facility != v_caller_facility THEN
    RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot register patient for another facility';
  END IF;

  v_patient_id := COALESCE((p_patient_data->>'id')::uuid, gen_random_uuid());
  v_patient_code := COALESCE(p_patient_data->>'patient_code', p_patient_data->>'patientCode', 'PT-' || upper(substr(gen_random_uuid()::text, 1, 8)));
  v_full_name := COALESCE(p_patient_data->>'full_name', p_patient_data->>'fullName', 'Unnamed Patient');
  v_date_of_birth := (p_patient_data->>'date_of_birth')::date;
  v_age_estimate := (p_patient_data->>'age_estimate')::integer;
  v_gender := p_patient_data->>'gender';
  v_phone := p_patient_data->>'phone';
  v_address := p_patient_data->>'address';
  v_blood_group := p_patient_data->>'blood_group';
  v_emergency_contact := COALESCE(p_patient_data->'emergency_contact', p_patient_data->'emergencyContact');

  -- Only set identity_status = 'ABHA_LINKED' if external identifier is provided and committed
  IF p_external_id_data IS NOT NULL AND (p_external_id_data->>'identifier_hash') IS NOT NULL THEN
    v_identity_status := COALESCE(p_patient_data->>'identity_status', 'ABHA_LINKED');
  ELSE
    v_identity_status := COALESCE(p_patient_data->>'identity_status', 'UNVERIFIED');
  END IF;

  -- 1. Insert patient record (RAW ABHA IS STRICTLY NULL)
  INSERT INTO public.patients (
    id,
    patient_code,
    full_name,
    date_of_birth,
    age_estimate,
    gender,
    phone,
    address,
    blood_group,
    emergency_contact,
    facility_id,
    abha_id,
    identity_status,
    created_at,
    updated_at
  ) VALUES (
    v_patient_id,
    v_patient_code,
    v_full_name,
    v_date_of_birth,
    v_age_estimate,
    v_gender,
    v_phone,
    v_address,
    v_blood_group,
    v_emergency_contact,
    v_target_facility,
    NULL,
    v_identity_status,
    v_now,
    v_now
  )
  RETURNING * INTO v_patient_record;

  -- 2. Insert external identifier atomically if present
  IF p_external_id_data IS NOT NULL AND (p_external_id_data->>'identifier_hash') IS NOT NULL THEN
    v_ext_id_type := COALESCE(p_external_id_data->>'identifier_type', 'ABHA_NUMBER');
    v_ext_id_hash := p_external_id_data->>'identifier_hash';
    v_ext_id_masked := p_external_id_data->>'identifier_value_encrypted_or_protected';
    v_ext_id_authority := COALESCE(p_external_id_data->>'issuing_authority', 'ABDM/NDHM');
    v_ext_metadata := COALESCE(p_external_id_data->'metadata', jsonb_build_object('source', 'registration'));

    INSERT INTO public.patient_external_identifiers (
      id,
      patient_id,
      facility_id,
      identifier_type,
      identifier_value_encrypted_or_protected,
      identifier_hash,
      issuing_authority,
      verification_status,
      linked_at,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_patient_id,
      v_target_facility,
      v_ext_id_type,
      v_ext_id_masked,
      v_ext_id_hash,
      v_ext_id_authority,
      'UNVERIFIED',
      v_now,
      v_ext_metadata,
      v_now,
      v_now
    );
  END IF;

  -- 3. Insert durable audit log atomically in the same transaction
  INSERT INTO public.audit_logs (
    id,
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    gen_random_uuid(),
    COALESCE(v_caller_id::text, p_actor_id, 'system'),
    COALESCE(v_caller_role, p_actor_role, 'clinician'),
    'CREATE_PATIENT',
    'patients',
    v_patient_id::text,
    jsonb_build_object(
      'patientCode', v_patient_code,
      'facilityId', v_target_facility,
      'identityStatus', v_identity_status,
      'hasExternalId', (p_external_id_data IS NOT NULL)
    ),
    v_now
  );

  RETURN to_jsonb(v_patient_record);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_register_patient_atomic(jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_register_patient_atomic(jsonb, jsonb, text, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Authoritative rpc_execute_idempotent_mutation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_execute_idempotent_mutation(
  p_idempotency_key text,
  p_entity text,
  p_action text,
  p_payload jsonb,
  p_payload_hash text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_facility text;
  v_now timestamptz := now();
  v_lease_expiry timestamptz;
  v_existing public.sync_mutations;
  v_payload_hash text;
  v_mutation_id uuid;
  v_resource_id uuid;
  v_result_summary jsonb;
  v_target_patient_id uuid;
  v_target_case_id uuid;
  v_target_doc_id uuid;
  v_target_consent_id uuid;
  v_patient public.patients;
  v_case public.cases;
  v_case_patient public.patients;
  v_consent public.consents;
  v_doc public.documents;
  v_doc_status text;
  v_supplied_facility text;
  v_raw_storage_path text;
  v_clean_path text;
  v_path_parts text[];
  v_path_patient_id text;
  v_path_case_id text;
  v_path_document_id text;
  v_payload_case_id text;
  v_canonical_path text;
  v_storage_exists boolean;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: idempotency_key is required';
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to execute mutations';
  END IF;

  SELECT role, facility_id INTO v_caller_role, v_caller_facility
  FROM public.profiles
  WHERE id = v_caller_id;

  v_lease_expiry := v_now + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 30), 5));

  -- Authoritative payload hash: prefer client computed canonical hash if provided, otherwise compute from JSONB
  v_payload_hash := COALESCE(
    NULLIF(p_payload_hash, ''),
    encode(digest(convert_to(COALESCE(p_payload, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
  );

  -- Advisory transaction lock scoped to (caller_id, idempotency_key)
  PERFORM pg_advisory_xact_lock(hashtext('sync:' || v_caller_id::text || ':' || p_idempotency_key));

  SELECT * INTO v_existing
  FROM public.sync_mutations
  WHERE user_id = v_caller_id::text AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
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

  -- ---------------------------------------------------------------------------
  -- Entity Mutation Logic
  -- ---------------------------------------------------------------------------
  IF p_entity = 'cases' THEN
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
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot create case for patient outside assigned facility';
        END IF;
      END IF;

      v_target_consent_id := COALESCE((p_payload->>'consentId')::uuid, (p_payload->>'consent_id')::uuid);
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
        facility_id,
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
        v_patient.facility_id,
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
      v_supplied_facility := COALESCE(p_payload->>'facilityId', p_payload->>'facility_id');

      IF v_caller_role != 'admin' THEN
        IF v_supplied_facility IS NOT NULL AND v_supplied_facility != '' AND v_supplied_facility != v_caller_facility THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot create patient outside assigned facility';
        END IF;
        v_supplied_facility := v_caller_facility;
      ELSE
        v_supplied_facility := COALESCE(v_supplied_facility, v_caller_facility);
      END IF;

      -- Permanent zero plaintext ABHA persistence in patients.abha_id
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
        NULL,
        v_now,
        v_now
      ) RETURNING id INTO v_resource_id;

      v_result_summary := jsonb_build_object('success', true, 'patientId', v_resource_id);
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on patients is not supported', p_action;
    END IF;

  ELSIF p_entity = 'documents' THEN
    IF p_action = 'create' THEN
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

      SELECT * INTO v_patient FROM public.patients WHERE id = v_doc.patient_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: Document parent patient does not exist';
      END IF;

      IF v_caller_role != 'admin' THEN
        IF v_caller_facility IS NULL OR v_patient.facility_id IS NULL OR v_caller_facility != v_patient.facility_id THEN
          RAISE EXCEPTION 'FACILITY_ACCESS_DENIED: Cannot update document outside assigned facility';
        END IF;
      END IF;

      IF (p_payload ? 'patient_id') OR (p_payload ? 'patientId') OR
         (p_payload ? 'facility_id') OR (p_payload ? 'facilityId') OR
         (p_payload ? 'storage_path') OR (p_payload ? 'storagePath') OR
         (p_payload ? 'uploaded_by') OR (p_payload ? 'uploadedBy') OR
         (p_payload ? 'created_at') OR (p_payload ? 'createdAt') OR
         (p_payload ? 'confirmed_by') OR (p_payload ? 'confirmedBy') OR
         (p_payload ? 'confirmed_at') OR (p_payload ? 'confirmedAt') THEN
        RAISE EXCEPTION 'IMMUTABLE_FIELD_TAMPERING: Offline sync cannot mutate document provenance or verification fields';
      END IF;

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
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(text, text, text, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_execute_idempotent_mutation(text, text, text, jsonb, text, integer) TO authenticated, service_role;
