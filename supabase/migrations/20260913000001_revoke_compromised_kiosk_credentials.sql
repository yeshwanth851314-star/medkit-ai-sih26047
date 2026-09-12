-- =============================================================================
-- Migration: Revoke Compromised Evaluation Kiosk Credentials
-- Problem Statement: SIH26047 Patient Case-Taking Software
-- Security Rule: Exposed credentials must be permanently revoked in database.
-- =============================================================================

UPDATE public.kiosk_instances 
SET status = 'revoked' 
WHERE id = 'a11a0000-0000-4000-8000-000000000001' 
   OR secret_hash = '4041ae0cadff17abd0deb0b37eb7920955bd85fdf4b6a6f4ad27b20cf98f30db';

-- Ensure all revoked kiosks cannot be queried as active
COMMENT ON TABLE public.kiosk_instances IS 'Hospital kiosk instances. Revoked kiosks cannot authenticate or bootstrap intake.';
