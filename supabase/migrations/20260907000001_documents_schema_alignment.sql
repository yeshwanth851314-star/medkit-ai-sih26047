-- MedKit AI — Document Schema Alignment & Storage Migration
-- Migration: 20260907000001_documents_schema_alignment.sql
-- Description: Aligns documents status constraint with canonical lifecycle ('uploaded', 'processing', 'extracted', 'review', 'confirmed', 'failed'),
-- adds OCR confidence, error tracking, clinician verification metadata, and provisions the private 'clinical-documents' storage bucket.

-- 1. Align documents status check constraint with canonical lifecycle
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_processing_status_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_processing_status_check
  CHECK (processing_status IN ('uploaded', 'processing', 'extracted', 'review', 'confirmed', 'failed'));

-- 2. Add OCR confidence, error tracking, clinician verification metadata, and timestamps
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Update trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_documents_updated_at();

-- 4. Provision Private Supabase Storage Bucket for Medical Documents
-- Note: Must remain strictly private (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents',
  'clinical-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 5. Storage Access Control Policies (Strict RBAC)
DO $$ BEGIN
  CREATE POLICY "Authenticated clinicians can access clinical documents"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'clinical-documents' AND public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
