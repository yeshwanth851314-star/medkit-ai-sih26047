-- MedKit AI — Forward Migration: Reconcile Remote Schema Drift
-- Migration: 20260912000001_reconcile_remote_schema_drift.sql
-- Description: Canonically incorporates the public.digest(bytea, text) wrapper function required
-- by rpc_execute_idempotent_mutation under strict SET search_path = public, pg_temp.
-- In Supabase PostgreSQL, pgcrypto functions reside in the extensions schema. This wrapper
-- exposes extensions.digest safely within the public schema with restricted execution privileges.

CREATE OR REPLACE FUNCTION public.digest(bytea, text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT extensions.digest($1, $2);
$$;

-- Secure function permissions: revoke from PUBLIC and anon; grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.digest(bytea, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.digest(bytea, text) TO authenticated, service_role;
