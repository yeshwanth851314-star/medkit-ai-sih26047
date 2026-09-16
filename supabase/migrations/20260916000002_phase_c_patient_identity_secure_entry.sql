-- ==============================================================================
-- Migration: 20260916000002_phase_c_patient_identity_secure_entry.sql
-- Description: Phase C — Patient Identity, Consent & Secure Entry Hardening
-- ==============================================================================

-- 1. Patients Table Hardening
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS age_estimate integer;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'UNVERIFIED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_identity_status'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT chk_patient_identity_status
      CHECK (identity_status IN ('UNVERIFIED', 'VERIFIED_LOCAL', 'ABHA_LINKED', 'MERGE_REVIEW_REQUIRED', 'ARCHIVED'));
  END IF;
END $$;

-- Enforce NOT NULL on facility_id
ALTER TABLE public.patients ALTER COLUMN facility_id SET NOT NULL;

-- Unique MRN within facility
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_facility_patient_code
  ON public.patients(facility_id, patient_code);

-- Search and duplicate candidate indexes
CREATE INDEX IF NOT EXISTS idx_patients_facility_phone
  ON public.patients(facility_id, phone);

CREATE INDEX IF NOT EXISTS idx_patients_facility_name_dob
  ON public.patients(facility_id, full_name, date_of_birth);

-- 2. Cases Table Facility-Binding & Invariant
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS facility_id text;

-- Backfill cases.facility_id from parent patient record
UPDATE public.cases c
SET facility_id = p.facility_id
FROM public.patients p
WHERE c.patient_id = p.id AND c.facility_id IS NULL;

-- Enforce NOT NULL on cases.facility_id
ALTER TABLE public.cases ALTER COLUMN facility_id SET NOT NULL;

-- Case-to-Patient Facility Consistency Trigger
CREATE OR REPLACE FUNCTION public.check_case_facility_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_patient_facility text;
BEGIN
  SELECT facility_id INTO v_patient_facility FROM public.patients WHERE id = NEW.patient_id;
  IF v_patient_facility IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Patient % does not exist', NEW.patient_id;
  END IF;
  IF NEW.facility_id != v_patient_facility THEN
    RAISE EXCEPTION 'FORBIDDEN: Case facility (%) does not match patient facility (%)', NEW.facility_id, v_patient_facility;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_case_facility ON public.cases;
CREATE TRIGGER trg_check_case_facility
BEFORE INSERT OR UPDATE OF patient_id, facility_id ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.check_case_facility_consistency();

-- Index on cases(facility_id)
CREATE INDEX IF NOT EXISTS idx_cases_facility_id ON public.cases(facility_id);

-- 3. Consents Table Facility-Binding
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS facility_id text;

UPDATE public.consents c
SET facility_id = p.facility_id
FROM public.patients p
WHERE c.patient_id = p.id AND c.facility_id IS NULL;

ALTER TABLE public.consents ALTER COLUMN facility_id SET NOT NULL;

-- Consents insert policy for authenticated facility clinicians/staff
DROP POLICY IF EXISTS "Consents insertable by patient facility clinicians" ON public.consents;
CREATE POLICY "Consents insertable by patient facility clinicians"
ON public.consents
FOR INSERT
TO authenticated
WITH CHECK (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff'])) AND
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = consents.patient_id AND p.facility_id = current_user_facility()
    )
  )
);

-- 4. Patient External Identifiers Table
CREATE TABLE IF NOT EXISTS public.patient_external_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  facility_id text NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('ABHA_NUMBER', 'ABHA_ADDRESS', 'FACILITY_MRN', 'OTHER_APPROVED_ID')),
  identifier_value_encrypted_or_protected text,
  identifier_hash text NOT NULL,
  issuing_authority text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  verified_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: active ABHA cannot belong to multiple MedKit patients
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_id_active_unique_national
  ON public.patient_external_identifiers(identifier_type, identifier_hash)
  WHERE unlinked_at IS NULL AND identifier_type IN ('ABHA_NUMBER', 'ABHA_ADDRESS');

-- Uniqueness: active facility MRN within facility
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_id_active_facility_mrn
  ON public.patient_external_identifiers(facility_id, identifier_type, identifier_hash)
  WHERE unlinked_at IS NULL AND identifier_type = 'FACILITY_MRN';

CREATE INDEX IF NOT EXISTS idx_ext_id_patient_id ON public.patient_external_identifiers(patient_id);
CREATE INDEX IF NOT EXISTS idx_ext_id_facility_id ON public.patient_external_identifiers(facility_id);

ALTER TABLE public.patient_external_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "External IDs accessible by facility clinicians" ON public.patient_external_identifiers;
CREATE POLICY "External IDs accessible by facility clinicians"
ON public.patient_external_identifiers
FOR SELECT
TO authenticated
USING (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

DROP POLICY IF EXISTS "External IDs insertable by facility clinicians" ON public.patient_external_identifiers;
CREATE POLICY "External IDs insertable by facility clinicians"
ON public.patient_external_identifiers
FOR INSERT
TO authenticated
WITH CHECK (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

DROP POLICY IF EXISTS "External IDs updatable by facility clinicians" ON public.patient_external_identifiers;
CREATE POLICY "External IDs updatable by facility clinicians"
ON public.patient_external_identifiers
FOR UPDATE
TO authenticated
USING (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

-- 5. Remote Intake Invitations Table
CREATE TABLE IF NOT EXISTS public.remote_intake_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id text NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'patient_registration_and_intake',
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remote_invites_facility ON public.remote_intake_invitations(facility_id);
CREATE INDEX IF NOT EXISTS idx_remote_invites_token_hash ON public.remote_intake_invitations(token_hash);

ALTER TABLE public.remote_intake_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Remote invites accessible by facility staff" ON public.remote_intake_invitations;
CREATE POLICY "Remote invites accessible by facility staff"
ON public.remote_intake_invitations
FOR SELECT
TO authenticated
USING (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

DROP POLICY IF EXISTS "Remote invites insertable by facility staff" ON public.remote_intake_invitations;
CREATE POLICY "Remote invites insertable by facility staff"
ON public.remote_intake_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  (current_user_role() = 'admin') OR
  (
    (facility_id IS NOT NULL) AND
    (facility_id = current_user_facility()) AND
    (current_user_role() = ANY (ARRAY['doctor', 'clinician', 'staff']))
  )
);

-- 6. RPC: Create Remote Intake Invitation
CREATE OR REPLACE FUNCTION public.rpc_create_remote_intake_invitation(
  p_patient_id uuid,
  p_token_hash text,
  p_expires_in_hours integer DEFAULT 24,
  p_max_uses integer DEFAULT 1,
  p_purpose text DEFAULT 'patient_registration_and_intake'
)
RETURNS public.remote_intake_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    v_caller_id::text,
    'REMOTE_INVITE_CREATED',
    'invitations',
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
$$;

-- 7. RPC: Validate Remote Intake Invitation (Publicly accessible for invitation link entry)
CREATE OR REPLACE FUNCTION public.rpc_validate_remote_intake_invitation(
  p_token_hash text
)
RETURNS TABLE (
  valid boolean,
  reason text,
  invitation_id uuid,
  facility_id text,
  patient_id uuid,
  purpose text,
  expires_at timestamptz,
  remaining_uses integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_inv public.remote_intake_invitations;
BEGIN
  SELECT * INTO v_inv FROM public.remote_intake_invitations WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'INVITATION_NOT_FOUND', NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::timestamptz, 0;
    RETURN;
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'INVITATION_REVOKED', v_inv.id, v_inv.facility_id, v_inv.patient_id, v_inv.purpose, v_inv.expires_at, 0;
    RETURN;
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN QUERY SELECT false, 'INVITATION_EXPIRED', v_inv.id, v_inv.facility_id, v_inv.patient_id, v_inv.purpose, v_inv.expires_at, 0;
    RETURN;
  END IF;

  IF v_inv.used_count >= v_inv.max_uses THEN
    RETURN QUERY SELECT false, 'INVITATION_CONSUMED', v_inv.id, v_inv.facility_id, v_inv.patient_id, v_inv.purpose, v_inv.expires_at, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    'VALID',
    v_inv.id,
    v_inv.facility_id,
    v_inv.patient_id,
    v_inv.purpose,
    v_inv.expires_at,
    (v_inv.max_uses - v_inv.used_count);
END;
$$;

-- 8. RPC: Consume Remote Intake Invitation (Atomically increments used_count and prevents replay)
CREATE OR REPLACE FUNCTION public.rpc_consume_remote_intake_invitation(
  p_token_hash text
)
RETURNS TABLE (
  consumed boolean,
  facility_id text,
  patient_id uuid,
  invitation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_inv public.remote_intake_invitations;
BEGIN
  -- Row-level lock to prevent concurrent consumption races
  SELECT * INTO v_inv
  FROM public.remote_intake_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND: Remote invitation not found';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_REVOKED: Remote invitation has been revoked';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'INVITATION_EXPIRED: Remote invitation expired at %', v_inv.expires_at;
  END IF;

  IF v_inv.used_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'INVITATION_CONSUMED: Remote invitation usage limit reached (% of %)', v_inv.used_count, v_inv.max_uses;
  END IF;

  UPDATE public.remote_intake_invitations
  SET used_count = used_count + 1
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    'remote_intake_session',
    'REMOTE_INVITE_USED',
    'invitations',
    v_inv.id::text,
    jsonb_build_object(
      'facilityId', v_inv.facility_id,
      'patientId', v_inv.patient_id,
      'useNumber', v_inv.used_count + 1,
      'maxUses', v_inv.max_uses
    ),
    now()
  );

  RETURN QUERY SELECT true, v_inv.facility_id, v_inv.patient_id, v_inv.id;
END;
$$;

-- 9. RPC: Deterministic Duplicate Patient Candidate Detection
CREATE OR REPLACE FUNCTION public.rpc_find_duplicate_patient_candidates(
  p_facility_id text,
  p_phone text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_abha_id text DEFAULT NULL,
  p_facility_mrn text DEFAULT NULL
)
RETURNS TABLE (
  candidate_patient_id uuid,
  candidate_patient_code text,
  candidate_full_name text,
  candidate_date_of_birth date,
  candidate_phone text,
  candidate_facility_id text,
  match_type text,
  match_confidence text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- 1. Deterministic Facility MRN match (IDENTIFIER_CONFLICT)
  IF p_facility_mrn IS NOT NULL AND length(trim(p_facility_mrn)) > 0 THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'EXACT_FACILITY_MRN'::text, 'IDENTIFIER_CONFLICT'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id AND p.patient_code = trim(p_facility_mrn);
  END IF;

  -- 2. Deterministic Verified ABHA match (STRONG_MATCH / IDENTIFIER_CONFLICT)
  IF p_abha_id IS NOT NULL AND length(trim(p_abha_id)) > 0 THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'EXACT_ABHA_ID'::text, 'STRONG_MATCH'::text
    FROM public.patients p
    WHERE p.abha_id = trim(p_abha_id);
  END IF;

  -- 3. Normalized Phone match within same facility (POSSIBLE_MATCH)
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'PHONE_MATCH'::text, 'POSSIBLE_MATCH'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id
      AND p.phone IS NOT NULL
      AND (
        regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
      )
      AND (p_facility_mrn IS NULL OR p.patient_code != trim(p_facility_mrn));
  END IF;

  -- 4. Exact Name + DOB match within same facility (POSSIBLE_MATCH)
  IF p_full_name IS NOT NULL AND p_date_of_birth IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.patient_code, p.full_name, p.date_of_birth, p.phone, p.facility_id,
           'NAME_AND_DOB_MATCH'::text, 'POSSIBLE_MATCH'::text
    FROM public.patients p
    WHERE p.facility_id = p_facility_id
      AND lower(trim(p.full_name)) = lower(trim(p_full_name))
      AND p.date_of_birth = p_date_of_birth;
  END IF;

  RETURN;
END;
$$;

-- Grant proper permissions: revoke from PUBLIC, grant to authenticated and anon (for validation RPC)
REVOKE ALL ON FUNCTION public.rpc_create_remote_intake_invitation(uuid, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_remote_intake_invitation(uuid, text, integer, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_validate_remote_intake_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_validate_remote_intake_invitation(text) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.rpc_consume_remote_intake_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_consume_remote_intake_invitation(text) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.rpc_find_duplicate_patient_candidates(text, text, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_find_duplicate_patient_candidates(text, text, text, date, text, text) TO authenticated;
