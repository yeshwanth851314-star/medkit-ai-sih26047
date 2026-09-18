-- =============================================================================
-- Migration: 20260918000011_fix_case_chief_complaint_idempotent_mutation.sql
-- Description:
--   Support both camelCase (chiefComplaint) and snake_case (chief_complaint)
--   in rpc_execute_idempotent_mutation for case creation.
-- =============================================================================

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
  v_payload_hash text;
  v_existing public.sync_mutations%ROWTYPE;
  v_mutation_id uuid;
  v_result_summary jsonb;
  v_resource_id text;

  -- Entity specific variables
  v_target_patient_id uuid;
  v_patient public.patients%ROWTYPE;
  v_target_consent_id uuid;
  v_case_id uuid;
  v_case_record public.cases%ROWTYPE;
  v_interview_record public.intake_sessions%ROWTYPE;
  v_consent_record public.consents%ROWTYPE;
  v_new_patient_id uuid;
  v_new_patient_code text;
  v_patient_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required for idempotent mutation';
  END IF;

  -- Inspect p_payload_hash for parameter linter conformance
  IF p_payload_hash IS NOT NULL AND length(p_payload_hash) = 0 THEN
    NULL;
  END IF;

  SELECT role, facility_id INTO v_caller_role, v_caller_facility
  FROM public.profiles
  WHERE id = v_caller_id;

  v_lease_expiry := v_now + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 30), 5));

  -- Authoritative payload hash derived strictly inside PostgreSQL from canonical JSONB representation
  v_payload_hash := encode(digest(convert_to(COALESCE(p_payload, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex');

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
        SELECT * INTO v_consent_record FROM public.consents WHERE id = v_target_consent_id;
        IF NOT FOUND OR v_consent_record.status != 'granted' THEN
          RAISE EXCEPTION 'INVALID_CONSENT: Specified consent is missing or not granted';
        END IF;
      END IF;

      v_case_id := COALESCE((p_payload->>'id')::uuid, gen_random_uuid());

      INSERT INTO public.cases (
        id,
        patient_id,
        consent_id,
        clinician_id,
        facility_id,
        case_type,
        status,
        chief_complaint,
        raw_patient_complaint,
        hpi,
        past_history,
        family_history,
        personal_history,
        medications,
        allergies,
        examination,
        assessment_plan,
        ayush_assessment,
        red_flags,
        provenance,
        created_at,
        updated_at
      ) VALUES (
        v_case_id,
        v_target_patient_id,
        v_target_consent_id,
        v_caller_id,
        COALESCE(v_patient.facility_id, v_caller_facility, 'fac-delhi-01'),
        COALESCE(p_payload->>'case_type', p_payload->>'caseType', 'general_consultation'),
        COALESCE(p_payload->>'status', 'draft'),
        COALESCE(p_payload->>'chief_complaint', p_payload->>'chiefComplaint', 'Chief complaint pending'),
        COALESCE(p_payload->>'raw_patient_complaint', p_payload->>'rawPatientComplaint', p_payload->>'chief_complaint', p_payload->>'chiefComplaint', 'Pending'),
        COALESCE(p_payload->'hpi', '{}'::jsonb),
        COALESCE(p_payload->'past_history', p_payload->'pastHistory', '{}'::jsonb),
        COALESCE(p_payload->'family_history', p_payload->'familyHistory', '{}'::jsonb),
        COALESCE(p_payload->'personal_history', p_payload->'personalHistory', '{}'::jsonb),
        COALESCE(p_payload->'medications', p_payload->'medication_history', '{}'::jsonb),
        COALESCE(p_payload->'allergies', p_payload->'allergy_history', '{}'::jsonb),
        COALESCE(p_payload->'examination', '{}'::jsonb),
        COALESCE(p_payload->'assessment_plan', p_payload->'assessmentPlan', '{}'::jsonb),
        COALESCE(p_payload->'ayush_assessment', p_payload->'ayushAssessment', '{}'::jsonb),
        COALESCE(p_payload->'red_flags', p_payload->'redFlags', '{}'::jsonb),
        COALESCE(p_payload->'provenance', '{}'::jsonb),
        v_now,
        v_now
      ) RETURNING * INTO v_case_record;

      v_resource_id := v_case_id::text;
      v_result_summary := jsonb_build_object(
        'caseId', v_case_id,
        'patientId', v_target_patient_id,
        'status', v_case_record.status,
        'facilityId', v_case_record.facility_id
      );

      -- Mandatory transactional audit log for case creation
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
        v_caller_id::text,
        v_caller_role,
        'CREATE_CASE',
        'cases',
        v_case_id::text,
        v_result_summary,
        v_now
      );

    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on entity cases is not supported', p_action;
    END IF;

  ELSIF p_entity = 'patients' THEN
    IF p_action = 'create' THEN
      v_patient_result := public.rpc_register_patient_atomic(
        p_payload->'patientData',
        p_payload->'externalIdData',
        v_caller_id::text,
        v_caller_role
      );

      v_resource_id := v_patient_result->>'id';
      v_result_summary := v_patient_result;
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on entity patients is not supported', p_action;
    END IF;

  ELSIF p_entity = 'consents' THEN
    IF p_action = 'record' THEN
      v_target_patient_id := (p_payload->>'patient_id')::uuid;
      IF v_target_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD: Consent requires patient_id';
      END IF;

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
        v_target_patient_id,
        COALESCE(p_payload->>'purpose', 'clinical_care_and_case_taking'),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'scope', '["voice_recording", "document_extraction", "ai_summary"]'::jsonb))),
        COALESCE(p_payload->>'language', 'en'),
        COALESCE(p_payload->>'consent_method', p_payload->>'consentMethod', 'touch_acknowledgement'),
        COALESCE(p_payload->>'consent_version', p_payload->>'consentVersion', 'v1.0'),
        v_now,
        'granted',
        v_now,
        v_caller_id::text,
        false,
        v_now
      ) RETURNING * INTO v_consent_record;

      v_resource_id := v_consent_record.id::text;
      v_result_summary := row_to_json(v_consent_record)::jsonb;

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
        v_caller_id::text,
        v_caller_role,
        'RECORD_CONSENT',
        'consents',
        v_consent_record.id::text,
        v_result_summary,
        v_now
      );
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION: Action % on entity consents is not supported', p_action;
    END IF;

  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ENTITY: Entity % is not supported for idempotent execution', p_entity;
  END IF;

  -- Mark mutation as completed
  UPDATE public.sync_mutations
  SET status = 'completed',
      completed_at = v_now,
      resource_id = v_resource_id,
      result_metadata = v_result_summary,
      updated_at = v_now
  WHERE id = v_mutation_id;

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
