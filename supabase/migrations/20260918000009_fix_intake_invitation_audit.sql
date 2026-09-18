-- Migration 20260918000009: Fix Remote Intake Invitation Audit Resource Type
-- Aligns rpc_create_remote_intake_invitation with canonical audit_logs resource_type

-- 1. Expand audit_logs check constraint to allow 'invitations' as well as 'remote_intake_invitations'
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN (
    'patients', 'cases', 'documents', 'auth', 'fhir', 'consents',
    'transcripts', 'kiosk_instances', 'kiosk_sessions', 'sync_mutations',
    'intake_sessions', 'clinician_onboarding', 'remote_intake_invitations',
    'invitations'
  ));

-- 2. Update rpc_create_remote_intake_invitation to use canonical 'remote_intake_invitations'
CREATE OR REPLACE FUNCTION public.rpc_create_remote_intake_invitation(
  p_patient_id uuid,
  p_token_hash text,
  p_expires_in_hours integer DEFAULT 24,
  p_max_uses integer DEFAULT 1,
  p_purpose text DEFAULT 'patient_registration_and_intake'::text
)
RETURNS public.remote_intake_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_facility text;
  v_caller_active boolean;
  v_invitation public.remote_intake_invitations;
  v_expires_at timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication session required to create remote intake invitation';
  END IF;

  SELECT role, facility_id, COALESCE(is_active, true)
  INTO v_caller_role, v_caller_facility, v_caller_active
  FROM public.profiles WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN: Profile is missing or inactive';
  END IF;

  IF v_caller_role NOT IN ('doctor', 'clinician', 'staff', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Role % cannot create invitations', v_caller_role;
  END IF;

  IF v_caller_role != 'admin' AND (v_caller_facility IS NULL OR length(trim(v_caller_facility)) = 0) THEN
    RAISE EXCEPTION 'FACILITY_REQUIRED: Caller requires assigned facility identity';
  END IF;

  IF p_patient_id IS NOT NULL THEN
    -- Verify patient belongs to caller's facility
    IF NOT EXISTS (
      SELECT 1 FROM public.patients
      WHERE id = p_patient_id AND (v_caller_role = 'admin' OR facility_id = v_caller_facility)
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Patient not found or belongs to another healthcare facility';
    END IF;
  END IF;

  v_expires_at := now() + (COALESCE(p_expires_in_hours, 24) || ' hours')::interval;

  INSERT INTO public.remote_intake_invitations (
    facility_id,
    patient_id,
    token_hash,
    purpose,
    expires_at,
    max_uses,
    used_count,
    created_by
  ) VALUES (
    v_caller_facility,
    p_patient_id,
    p_token_hash,
    COALESCE(p_purpose, 'patient_registration_and_intake'),
    v_expires_at,
    COALESCE(p_max_uses, 1),
    0,
    v_caller_id
  ) RETURNING * INTO v_invitation;

  -- Audit log with canonical resource_type
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    v_caller_id::text,
    'REMOTE_INVITE_CREATED',
    'remote_intake_invitations',
    v_invitation.id::text,
    jsonb_build_object(
      'facilityId', v_caller_facility,
      'patientId', p_patient_id,
      'expiresAt', v_expires_at,
      'maxUses', p_max_uses
    ),
    now()
  );

  RETURN v_invitation;
END;
$function$;
