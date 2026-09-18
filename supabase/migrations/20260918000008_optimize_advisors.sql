-- Migration 20260918000008: Optimize Supabase Security & Performance Advisors
-- Resolves duplicate index, trigger function public exposure, and RLS initplan warnings

-- 1. Performance Advisor: Drop duplicate constraint and index on sync_mutations
ALTER TABLE public.sync_mutations DROP CONSTRAINT IF EXISTS sync_mutations_user_key_uniq;

-- 2. Security Advisor: Revoke public/anon execute on internal trigger function
REVOKE EXECUTE ON FUNCTION public.check_case_facility_consistency() FROM PUBLIC, anon;

-- 3. Performance Advisor: Optimize RLS initplan on public.profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 4. Performance Advisor: Optimize RLS initplan on public.sync_mutations
DROP POLICY IF EXISTS "Sync mutations readable by active owner or active admin" ON public.sync_mutations;
CREATE POLICY "Sync mutations readable by active owner or active admin" ON public.sync_mutations
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
        AND profiles.is_active IS TRUE
    )
  );

-- 5. Performance Advisor: Optimize RLS initplan on public.clinician_professional_profiles
DROP POLICY IF EXISTS clinician_view_own_profile ON public.clinician_professional_profiles;
CREATE POLICY clinician_view_own_profile ON public.clinician_professional_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS clinician_update_own_onboarding ON public.clinician_professional_profiles;
CREATE POLICY clinician_update_own_onboarding ON public.clinician_professional_profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND account_status IN ('PENDING_IDENTITY', 'IDENTITY_VERIFIED', 'PROFESSIONAL_VERIFICATION_PENDING', 'PROFESSIONAL_VERIFIED', 'MFA_REQUIRED')
  )
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS admin_view_facility_applications ON public.clinician_professional_profiles;
CREATE POLICY admin_view_facility_applications ON public.clinician_professional_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND (profiles.role = 'admin' OR profiles.role = 'staff')
        AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
    )
  );

DROP POLICY IF EXISTS admin_manage_facility_applications ON public.clinician_professional_profiles;
CREATE POLICY admin_manage_facility_applications ON public.clinician_professional_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND (profiles.role = 'admin' OR profiles.role = 'staff')
        AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND (profiles.role = 'admin' OR profiles.role = 'staff')
        AND profiles.facility_id = clinician_professional_profiles.requested_facility_id
    )
  );
