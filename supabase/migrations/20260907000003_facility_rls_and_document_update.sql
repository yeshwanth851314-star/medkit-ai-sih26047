-- MedKit AI — Facility Boundaries, Profile Privilege Protection & Document Update Policy
-- Migration: 20260907000003_facility_rls_and_document_update.sql
-- Description: 
-- 1. Protects profiles authorization columns (role, facility_id) from self-promotion.
-- 2. Adds missing UPDATE policy for public.documents.
-- 3. Adds facility-scoping helper functions for Row Level Security.

-- 1. Helper function to retrieve authenticated user's facility ID
CREATE OR REPLACE FUNCTION public.current_user_facility()
RETURNS TEXT AS $$
  SELECT facility_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Prevent self-promotion: regular users cannot alter their role or facility_id on profile UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.facility_id IS DISTINCT FROM NEW.facility_id) THEN
    IF (public.current_user_role() NOT IN ('admin')) THEN
      RAISE EXCEPTION 'FORBIDDEN: Modifying role or facility_id requires administrative privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 3. Provision authenticated UPDATE policy on documents table
DO $$ BEGIN
  CREATE POLICY "Documents updatable by authorized clinicians"
    ON public.documents FOR UPDATE
    TO authenticated
    USING (public.current_user_role() IN ('doctor', 'clinician', 'admin'))
    WITH CHECK (public.current_user_role() IN ('doctor', 'clinician', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
