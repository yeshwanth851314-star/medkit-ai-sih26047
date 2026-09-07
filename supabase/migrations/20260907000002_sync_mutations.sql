-- MedKit AI — Server-Side Idempotency & Sync Mutations Ledger
-- Migration: 20260907000002_sync_mutations.sql
-- Description: Creates persistent sync_mutations table to prevent duplicate replay of offline sync items
-- across server restarts, cold starts, and multi-worker instances.

CREATE TABLE IF NOT EXISTS public.sync_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for instant key lookups during high-frequency sync replay
CREATE INDEX IF NOT EXISTS idx_sync_mutations_key ON public.sync_mutations(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sync_mutations_user ON public.sync_mutations(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_mutations_resource ON public.sync_mutations(resource_id);

-- Enable RLS
ALTER TABLE public.sync_mutations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated clinicians and users can manage sync mutations"
    ON public.sync_mutations FOR ALL
    TO authenticated
    USING (
      user_id = auth.uid()::text
      OR public.current_user_role() IN ('doctor', 'clinician', 'staff', 'admin')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
