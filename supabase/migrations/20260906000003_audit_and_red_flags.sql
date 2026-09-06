-- MedKit AI — Audit Logs and Red Flag Events Alignment Migration
-- Migration: 20260906000003_audit_and_red_flags.sql
-- Description: Aligns audit_logs resource_type check constraint and red_flag_events severity check constraint with domain models.

-- 1. Expand audit_logs resource_type to include 'consents' and 'transcripts'
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN ('patients', 'cases', 'documents', 'auth', 'fhir', 'consents', 'transcripts'));

-- 2. Expand red_flag_events severity constraint to accept case-insensitive clinical alert levels
ALTER TABLE public.red_flag_events DROP CONSTRAINT IF EXISTS red_flag_events_severity_check;
ALTER TABLE public.red_flag_events
  ADD CONSTRAINT red_flag_events_severity_check
  CHECK (UPPER(severity) IN ('CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'WARNING'));
