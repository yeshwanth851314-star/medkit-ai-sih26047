-- =============================================================================
-- MedKit AI — Final Database Policy, Audit Integrity & RLS Closure Migration
-- Migration: 20260911000002_final_policy_audit_closure.sql
-- Description: 
--   1. Expands audit_logs resource_type CHECK constraint to include 'kiosk_instances'
--      and 'intake_sessions', matching all production RPC audit inserts.
--   2. Enforces strict audit_logs immutability: revokes direct write DML (INSERT,
--      UPDATE, DELETE) from anon and authenticated, scopes SELECT to active admins.
--   3. Closes red_flag_events direct-table RLS: drops legacy broad policies, enforces
--      patient-facility isolation on SELECT, INSERT, and UPDATE for clinical roles.
--   4. Eliminates sync_mutations policy shadowing: drops legacy SELECT policies and
--      recreates a single SELECT policy requiring authenticated active profile ownership.
--   5. Hardens kiosk_capability_revocations: revokes all direct table access from anon,
--      dropping legacy public viewing policy and restricting access to active clinicians.
--   6. Hardens SECURITY DEFINER helpers (current_user_role, current_user_facility,
--      rpc_get_kiosk_intake_session) with explicit search_path and is_active enforcement.
-- =============================================================================

-- =============================================================================
-- 1. FIX P0: AUDIT_LOGS.RESOURCE_TYPE CHECK CONSTRAINT
-- =============================================================================
-- Drop previous constraint allowing only 7 resource types
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;

-- Recreate constraint with complete allowlist of legitimate production resource types
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN (
    'patients',
    'cases',
    'documents',
    'auth',
    'fhir',
    'consents',
    'transcripts',
    'kiosk_instances',
    'intake_sessions'
  ));

-- =============================================================================
-- 2. FIX P1: AUDIT LOG INTEGRITY & ACCESS CONTROL
-- =============================================================================
-- Ensure RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop all legacy and permissive policies on audit_logs
DROP POLICY IF EXISTS "Audit logs insertable by any authenticated user or service" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insertable by authenticated callers" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs viewable only by doctors or administrators" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs viewable by active admin only" ON public.audit_logs;

-- Recreate single SELECT policy: raw audit logs are accessible only to active system admins
CREATE POLICY "Audit logs viewable by active admin only"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin'
  );

-- Revoke all table write privileges from clients.
-- Normal users cannot fabricate, alter, or purge audit trail records.
-- Authoritative audit inserts occur via trusted server path (service_role) or SECURITY DEFINER RPCs.
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- =============================================================================
-- 3. FIX P1: RED FLAG DIRECT-TABLE RLS & FACILITY SCOPING
-- =============================================================================
-- Ensure RLS is enabled
ALTER TABLE public.red_flag_events ENABLE ROW LEVEL SECURITY;

-- Drop all legacy policies that lacked patient-facility boundary checks or used unrestricted check
DROP POLICY IF EXISTS "Red flag events viewable by clinicians and staff" ON public.red_flag_events;
DROP POLICY IF EXISTS "Red flag events insertable by clinical systems" ON public.red_flag_events;
DROP POLICY IF EXISTS "Red flag events updatable by attending doctors" ON public.red_flag_events;
DROP POLICY IF EXISTS "Red flag events viewable by facility clinicians" ON public.red_flag_events;
DROP POLICY IF EXISTS "Red flag events insertable by facility clinicians" ON public.red_flag_events;
DROP POLICY IF EXISTS "Red flag events updatable by facility clinicians" ON public.red_flag_events;

-- SELECT Policy: Clinicians and staff can view red flags only for cases within their facility
CREATE POLICY "Red flag events viewable by facility clinicians"
  ON public.red_flag_events FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin') AND (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1
        FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = red_flag_events.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- INSERT Policy: Licensed clinicians can insert red flags only for cases within their facility
CREATE POLICY "Red flag events insertable by facility clinicians"
  ON public.red_flag_events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1
        FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = red_flag_events.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- UPDATE Policy: Licensed clinicians can acknowledge/update red flags only within their facility
CREATE POLICY "Red flag events updatable by facility clinicians"
  ON public.red_flag_events FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1
        FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = red_flag_events.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1
        FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = red_flag_events.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- Direct Table Privileges
REVOKE ALL ON public.red_flag_events FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE ON public.red_flag_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.red_flag_events TO authenticated;
GRANT ALL ON public.red_flag_events TO service_role;

-- =============================================================================
-- 4. FIX P1: SYNC_MUTATIONS SELECT POLICY & DIRECT WRITE LOCKDOWN
-- =============================================================================
-- Ensure RLS is enabled
ALTER TABLE public.sync_mutations ENABLE ROW LEVEL SECURITY;

-- Drop all historical, legacy, and duplicate policies to eliminate policy shadowing
DROP POLICY IF EXISTS "Sync mutations caller scoped" ON public.sync_mutations;
DROP POLICY IF EXISTS "Authenticated clinicians and users can manage sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can manage own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can select own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can insert own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Users can update own sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Sync mutations readable by owner or active admin" ON public.sync_mutations;
DROP POLICY IF EXISTS "Sync mutations readable by active owner or active admin" ON public.sync_mutations;

-- Recreate single SELECT policy: only active users can read their own sync ledger entries,
-- or active administrators can inspect ledger records for audit purposes.
CREATE POLICY "Sync mutations readable by active owner or active admin"
  ON public.sync_mutations FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      (
        user_id = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active IS TRUE
        )
      )
      OR public.current_user_role() = 'admin'
    )
  );

-- Confirm write lock down: all writes must route through rpc_execute_idempotent_mutation
REVOKE ALL ON public.sync_mutations FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sync_mutations FROM authenticated;
GRANT SELECT ON public.sync_mutations TO authenticated;
GRANT ALL ON public.sync_mutations TO service_role;

-- =============================================================================
-- 5. FIX REVOCATION METADATA EXPOSURE (KIOSK_CAPABILITY_REVOCATIONS)
-- =============================================================================
-- Ensure RLS is enabled
ALTER TABLE public.kiosk_capability_revocations ENABLE ROW LEVEL SECURITY;

-- Drop permissive legacy policy that allowed anonymous table browsing
DROP POLICY IF EXISTS "Allow authenticated clinicians and kiosk RPC to view revocations" ON public.kiosk_capability_revocations;
DROP POLICY IF EXISTS "Clinicians can view revocations" ON public.kiosk_capability_revocations;
DROP POLICY IF EXISTS "Clinicians can insert revocations" ON public.kiosk_capability_revocations;
DROP POLICY IF EXISTS "Clinicians can update revocations" ON public.kiosk_capability_revocations;

-- Clinicians can view revocation entries
CREATE POLICY "Clinicians can view revocations"
  ON public.kiosk_capability_revocations FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin')
  );

-- Clinicians can insert revocation records (e.g. on logout or session termination)
CREATE POLICY "Clinicians can insert revocations"
  ON public.kiosk_capability_revocations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin')
  );

-- Clinicians can update revocation records
CREATE POLICY "Clinicians can update revocations"
  ON public.kiosk_capability_revocations FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin')
  );

-- Revoke all direct table permissions from anon and PUBLIC.
-- Kiosks validate revocations exclusively through SECURITY DEFINER RPCs.
REVOKE ALL ON public.kiosk_capability_revocations FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE ON public.kiosk_capability_revocations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_capability_revocations TO authenticated;
GRANT ALL ON public.kiosk_capability_revocations TO service_role;

-- =============================================================================
-- 6. SECURITY DEFINER FUNCTIONS HARDENING & SEARCH PATH INTEGRITY
-- =============================================================================

-- Helper: current_user_role()
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active IS TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

-- Helper: current_user_facility()
CREATE OR REPLACE FUNCTION public.current_user_facility()
RETURNS TEXT AS $$
  SELECT facility_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active IS TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.current_user_facility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_facility() TO authenticated, service_role;

-- Hardened Kiosk Intake Session Rehydration RPC:
-- Verifies kiosk credentials and enforces revocation status from kiosk_capability_revocations
CREATE OR REPLACE FUNCTION public.rpc_get_kiosk_intake_session(
  p_kiosk_id UUID,
  p_kiosk_secret TEXT,
  p_session_id UUID
) RETURNS public.intake_sessions AS $$
DECLARE
  v_kiosk public.kiosk_instances;
  v_session public.intake_sessions;
  v_secret_hash TEXT;
  v_is_revoked BOOLEAN;
BEGIN
  IF p_kiosk_id IS NULL OR p_kiosk_secret IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk credentials required';
  END IF;

  SELECT * INTO v_kiosk FROM public.kiosk_instances WHERE id = p_kiosk_id;
  IF NOT FOUND OR v_kiosk.status != 'active' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Active kiosk instance required';
  END IF;

  IF v_kiosk.expires_at IS NOT NULL AND v_kiosk.expires_at < now() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Kiosk registration has expired';
  END IF;

  v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  IF v_kiosk.secret_hash != v_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Invalid kiosk secret';
  END IF;

  SELECT * INTO v_session FROM public.intake_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Intake session % does not exist', p_session_id;
  END IF;

  IF v_session.facility_id != v_kiosk.facility_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Session facility does not match kiosk facility';
  END IF;

  -- Check if session has been explicitly revoked in kiosk_capability_revocations
  SELECT EXISTS(
    SELECT 1 FROM public.kiosk_capability_revocations
    WHERE session_id = p_session_id
  ) INTO v_is_revoked;

  IF v_is_revoked AND v_session.status NOT IN ('abandoned', 'submitted', 'revoked') THEN
    v_session.status := 'revoked';
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.rpc_get_kiosk_intake_session(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_kiosk_intake_session(UUID, TEXT, UUID) TO anon, authenticated, service_role;

-- Grant EXECUTE on red flag acknowledge RPC to authenticated and service_role
REVOKE ALL ON FUNCTION public.rpc_acknowledge_red_flag_with_audit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acknowledge_red_flag_with_audit(UUID, TEXT) TO authenticated, service_role;

-- Grant EXECUTE on kiosk provision RPC to authenticated and service_role
REVOKE ALL ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
