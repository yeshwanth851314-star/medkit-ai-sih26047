# MedKit AI — Supabase Security Advisor Final Evidence Report

**Project Ref:** `aqxwmlqfvnlwabpxqchr` (`MED-KIT-AI`, `ap-southeast-1`)  
**Engine:** Postgres 17.6.1.166  
**Source Tool:** `supabase db advisors --linked --type security`  
**Execution Timestamp:** 2026-09-18T05:31:00Z  
**Overall Status:** PASS (Zero Critical/Blocking Errors)

## Summary of Findings

| Severity | Count | Blocking V1 |
|---|---|---|
| **ERROR** | 0 | 0 |
| **WARN** | 38 | 0 |
| **INFO** | 0 | 0 |

## Classification & Disposition

1. **Signed-In Users Can Execute SECURITY DEFINER Function (29 Warnings)**
   - **Objects:** `rpc_execute_idempotent_mutation`, `rpc_update_case_atomic`, `rpc_register_patient_atomic`, `rpc_finalize_case_with_audit`, `rpc_revoke_consent_with_audit`, etc.
   - **Assessment:** EXPECTED / INTENTIONAL. These functions are clinical API endpoints designed specifically for authenticated clinicians (`authenticated` role). Each function strictly enforces caller identity and facility scoping internally via `auth.uid()`, role verification against `public.profiles`, and facility matching.
   - **Status:** ACCEPTED V1.

2. **Public Can Execute SECURITY DEFINER Function (7 Warnings)**
   - **Objects:**
     - Remote Patient Intake: `rpc_validate_remote_intake_invitation`, `rpc_consume_remote_intake_invitation`
     - Physical Kiosk Intake: `rpc_kiosk_bootstrap_intake`, `rpc_get_kiosk_intake_session`, `rpc_submit_kiosk_answer`, `rpc_revoke_kiosk_session`
   - **Assessment:** EXPECTED / INTENTIONAL. Remote intake allows anonymous patients to access their self-intake session via secure HMAC token validation without clinician credentials. Kiosk RPCs authenticate the physical hardware terminal via `p_kiosk_id` and SHA-256 `p_kiosk_secret`.
   - **Status:** ACCEPTED V1.

3. **Function Search Path Mutable (1 Warning)**
   - **Object:** `public.digest` (standard pgcrypto extension function).
   - **Status:** ACCEPTED V1.

4. **Leaked Password Protection Disabled (1 Warning)**
   - **Assessment:** Supabase Auth project configuration setting checking passwords against HaveIBeenPwned.org.
   - **Status:** ACCEPTED V1.
