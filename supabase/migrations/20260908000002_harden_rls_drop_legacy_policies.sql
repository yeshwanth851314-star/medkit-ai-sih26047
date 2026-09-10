-- MedKit AI — Institutional RLS Hardening & Legacy Permissive Policy Purge
-- Migration: 20260908000002_harden_rls_drop_legacy_policies.sql
--
-- Description:
-- In PostgreSQL, multiple permissive RLS policies are evaluated with logical OR.
-- Adding narrow facility policies without explicitly dropping legacy broad policies
-- leaves broad access paths open. This migration unconditionally drops all legacy
-- permissive policies and replaces them with strict, facility-scoped predicates.
--
-- Live Verification Instructions (when Supabase instance is active):
-- 1. Apply: supabase db push
-- 2. Verify: Run queries as Clinician A (Facility A) and Clinician B (Facility B)
--    SELECT * FROM public.patients WHERE facility_id = 'fac-hyd-01'; -- Clinician B returns 0 rows.

-- Ensure RLS is active on all clinical tables
ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sync_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_amendments ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 1. Purge Legacy Permissive Policies
--------------------------------------------------------------------------------

-- Patients legacy drops
DROP POLICY IF EXISTS "Patients viewable by clinicians and staff" ON public.patients;
DROP POLICY IF EXISTS "Patients insertable by clinicians and staff" ON public.patients;
DROP POLICY IF EXISTS "Patients updatable by clinicians and staff" ON public.patients;
DROP POLICY IF EXISTS "Patients accessible by assigned facility clinicians" ON public.patients;
DROP POLICY IF EXISTS "Patients insertable by assigned facility staff" ON public.patients;
DROP POLICY IF EXISTS "Patients updatable by assigned facility clinicians" ON public.patients;

-- Cases legacy drops
DROP POLICY IF EXISTS "Cases viewable by clinical staff" ON public.cases;
DROP POLICY IF EXISTS "Cases insertable by clinical staff" ON public.cases;
DROP POLICY IF EXISTS "Cases updatable by clinicians (doctors/clinicians)" ON public.cases;
DROP POLICY IF EXISTS "Cases accessible by patient facility clinicians" ON public.cases;
DROP POLICY IF EXISTS "Cases insertable by licensed clinicians only" ON public.cases;
DROP POLICY IF EXISTS "Cases updatable by licensed clinicians only" ON public.cases;

-- Documents legacy drops
DROP POLICY IF EXISTS "Documents viewable by clinical staff" ON public.documents;
DROP POLICY IF EXISTS "Documents insertable by clinical staff and patients" ON public.documents;
DROP POLICY IF EXISTS "Authenticated clinicians can access clinical documents" ON public.documents;
DROP POLICY IF EXISTS "Documents updatable by authorized clinicians" ON public.documents;
DROP POLICY IF EXISTS "Documents accessible by facility clinicians" ON public.documents;
DROP POLICY IF EXISTS "Documents insertable by facility staff" ON public.documents;
DROP POLICY IF EXISTS "Documents updatable by authorized facility clinicians" ON public.documents;

-- Consents legacy drops
DROP POLICY IF EXISTS "Consents viewable by clinicians and staff" ON public.consents;
DROP POLICY IF EXISTS "Consents insertable by authenticated users or kiosk" ON public.consents;
DROP POLICY IF EXISTS "Consents updatable by clinicians and staff" ON public.consents;

-- Case amendments legacy drops
DROP POLICY IF EXISTS "Case amendments viewable by clinical staff" ON public.case_amendments;
DROP POLICY IF EXISTS "Case amendments insertable by clinicians" ON public.case_amendments;

-- Sync mutations legacy drops
DROP POLICY IF EXISTS "Authenticated clinicians and users can manage sync mutations" ON public.sync_mutations;
DROP POLICY IF EXISTS "Sync mutations caller scoped" ON public.sync_mutations;

-- Audit logs legacy drops
DROP POLICY IF EXISTS "Audit logs insertable by any authenticated user or service" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs viewable only by doctors or administrators" ON public.audit_logs;

-- Storage legacy drops
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated clinicians can access clinical documents" ON storage.objects;
  DROP POLICY IF EXISTS "Clinical documents readable by patient facility" ON storage.objects;
  DROP POLICY IF EXISTS "Clinical documents uploadable by patient facility" ON storage.objects;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

--------------------------------------------------------------------------------
-- 2. Create Hardened, Facility-Isolated Policies
--------------------------------------------------------------------------------

-- Patients
CREATE POLICY "Patients accessible by assigned facility clinicians"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician', 'staff'))
  );

CREATE POLICY "Patients insertable by assigned facility staff"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician', 'staff'))
  );

CREATE POLICY "Patients updatable by assigned facility clinicians"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician'))
  )
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician'))
  );

-- Cases
CREATE POLICY "Cases accessible by patient facility clinicians"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = cases.patient_id
        AND p.facility_id IS NOT NULL
        AND p.facility_id = public.current_user_facility()
    )
  );

CREATE POLICY "Cases insertable by licensed clinicians only"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Cases updatable by licensed clinicians only"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (
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

-- Documents
CREATE POLICY "Documents accessible by facility clinicians"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = documents.patient_id
        AND p.facility_id IS NOT NULL
        AND p.facility_id = public.current_user_facility()
    )
  );

CREATE POLICY "Documents insertable by facility staff"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = documents.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

CREATE POLICY "Documents updatable by authorized facility clinicians"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = documents.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = documents.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- Consents
CREATE POLICY "Consents accessible by patient facility clinicians"
  ON public.consents FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = consents.patient_id
        AND p.facility_id IS NOT NULL
        AND p.facility_id = public.current_user_facility()
    )
  );

CREATE POLICY "Consents updatable by patient facility clinicians"
  ON public.consents FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = consents.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = consents.patient_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- Case Amendments (Append-only)
CREATE POLICY "Case amendments viewable by patient facility clinicians"
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

CREATE POLICY "Case amendments insertable by licensed clinicians"
  ON public.case_amendments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('doctor', 'clinician', 'admin') AND
    (
      public.current_user_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.cases c
        JOIN public.patients p ON p.id = c.patient_id
        WHERE c.id = case_amendments.case_id
          AND p.facility_id IS NOT NULL
          AND p.facility_id = public.current_user_facility()
      )
    )
  );

-- Sync Mutations (Caller Scoped)
CREATE POLICY "Sync mutations caller scoped"
  ON public.sync_mutations FOR ALL
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    user_id = auth.uid()::text
  )
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    user_id = auth.uid()::text
  );

-- Audit Logs
CREATE POLICY "Audit logs insertable by authenticated callers"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Audit logs viewable only by doctors or administrators"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('doctor', 'admin')
  );

-- Storage Objects (Clinical Documents Bucket)
DO $$ BEGIN
  CREATE POLICY "Clinical documents readable by patient facility"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'clinical-documents' AND
      (
        public.current_user_role() = 'admin' OR
        EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id::text = (storage.foldername(name))[2]
            AND p.facility_id IS NOT NULL
            AND p.facility_id = public.current_user_facility()
        )
      )
    );

  CREATE POLICY "Clinical documents uploadable by patient facility"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'clinical-documents' AND
      (
        public.current_user_role() = 'admin' OR
        EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id::text = (storage.foldername(name))[2]
            AND p.facility_id IS NOT NULL
            AND p.facility_id = public.current_user_facility()
        )
      )
    );
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
