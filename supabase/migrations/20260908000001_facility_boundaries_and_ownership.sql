-- MedKit AI — Institutional Facility Isolation, Ownership Enforcement & Storage RLS
-- Migration: 20260908000001_facility_boundaries_and_ownership.sql
-- Description:
-- 1. Enforces strict facility boundary checks on patients, cases, and documents.
-- 2. Scopes sync_mutations strictly to the calling user or system admin.
-- 3. Implements path-based facility authorization on private clinical-documents storage bucket.

-- Enable RLS on all clinical and sync tables
ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sync_mutations ENABLE ROW LEVEL SECURITY;

-- 1. Patients Table Policies
DROP POLICY IF EXISTS "Patients accessible by assigned facility clinicians" ON public.patients;
CREATE POLICY "Patients accessible by assigned facility clinicians"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician', 'staff'))
  );

DROP POLICY IF EXISTS "Patients insertable by assigned facility staff" ON public.patients;
CREATE POLICY "Patients insertable by assigned facility staff"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin' OR
    (facility_id IS NOT NULL AND facility_id = public.current_user_facility() AND public.current_user_role() IN ('doctor', 'clinician', 'staff'))
  );

DROP POLICY IF EXISTS "Patients updatable by assigned facility clinicians" ON public.patients;
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

-- 2. Clinical Cases Table Policies
DROP POLICY IF EXISTS "Cases accessible by patient facility clinicians" ON public.cases;
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

DROP POLICY IF EXISTS "Cases insertable by licensed clinicians only" ON public.cases;
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

DROP POLICY IF EXISTS "Cases updatable by licensed clinicians only" ON public.cases;
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

-- 3. Documents Table Policies
DROP POLICY IF EXISTS "Documents accessible by facility clinicians" ON public.documents;
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

DROP POLICY IF EXISTS "Documents insertable by facility staff" ON public.documents;
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

DROP POLICY IF EXISTS "Documents updatable by authorized facility clinicians" ON public.documents;
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

-- 4. Sync Mutations Table Policies (Caller-scoped Idempotency)
DROP POLICY IF EXISTS "Sync mutations caller scoped" ON public.sync_mutations;
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

-- 5. Storage Bucket RLS Policies for clinical-documents
-- Storage path structure: patients/<patient_id>/cases/<case_id>/<doc_id>/<filename>
DO $$ BEGIN
  -- Allow read access only if user belongs to the patient's facility
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

  -- Allow upload only to caller's facility patient folder
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
