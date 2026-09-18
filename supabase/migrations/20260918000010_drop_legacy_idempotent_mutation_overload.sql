-- =============================================================================
-- Migration: 20260918000010_drop_legacy_idempotent_mutation_overload.sql
-- Description:
--   Drop legacy 5-argument overload of rpc_execute_idempotent_mutation
--   (p_idempotency_key text, p_entity text, p_action text, p_payload_hash text, p_payload jsonb)
--   to eliminate Postgres function resolution ambiguity.
--   The canonical 6-argument overload
--   rpc_execute_idempotent_mutation(text, text, text, jsonb, text, integer)
--   established in 20260918000006 is the authoritative single implementation.
-- =============================================================================

DROP FUNCTION IF EXISTS public.rpc_execute_idempotent_mutation(text, text, text, text, jsonb);
