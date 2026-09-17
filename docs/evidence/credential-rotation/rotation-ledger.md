# MedKit AI — Production Credential Rotation & Security Ledger

**Target Deployment:** Production (`https://medkit-ai-sih26047.vercel.app`)  
**Linked Remote Database:** Supabase (`aqxwmlqfvnlwabpxqchr`, Region: `ap-southeast-1`)  
**Audit Date:** 2026-09-17 / 2026-09-18  
**Standard:** Zero Secret Disclosure & Clinical Fail-Closed Integrity  

---

## 1. Executive Summary

As part of Phase C and Phase D Version 1 clinical security hardening, all default, development, and legacy credentials have been audited and rotated to establish authoritative production boundaries. In compliance with security standards, raw secrets are never disclosed in source code, logs, or reports.

---

## 2. Rotation Verification Table

| Secret / Credential | Scope / Location | Rotation Status | Fingerprint / Evidence | Operational Impact |
|---|---|---|---|---|
| **`SESSION_SECRET`** | Vercel Production & Preview | **ROTATED & ACTIVE** | 256-bit high-entropy secret (Updated 2026-09-17) | Dev/test signing keys rejected with HTTP 401 |
| **`IDENTIFIER_INDEX_PEPPER`** | Vercel Production & Preview | **ROTATED & ACTIVE** | 256-bit cryptographic salt (Updated 2026-09-17) | Used authoritatively for HMAC-SHA256 ABHA indexing |
| **Clinician Default Passwords** | Supabase Auth (`profiles`) | **ROTATED & ACTIVE** | Legacy passwords revoked; randomized credentials enforced | Default dev credentials fail closed |
| **Remote Intake Tokens** | Supabase `remote_intake_invitations` | **ROTATED & ACTIVE** | Plaintext tokens purged; SHA-256 hashes authoritative | Revoked tokens return HTTP 403 / 404 |
| **Supabase Master JWT / DB Password** | Supabase Cloud Console | **BLOCKED — AWAITING OPERATOR ROTATION** | Requires operator dashboard action | See Section 3 for exact manual operator procedure |

---

## 3. Operator Rotation Procedure (For Root Supabase Secrets)

If operator rotation of the project JWT secret or database connection password is required:

1. **Access Supabase Dashboard:**
   - Navigate to [https://supabase.com/dashboard/project/aqxwmlqfvnlwabpxqchr](https://supabase.com/dashboard/project/aqxwmlqfvnlwabpxqchr).
2. **Database Password Reset:**
   - Go to **Project Settings** > **Database** > **Database password**.
   - Click **Reset database password** and generate a strong new password.
3. **API & JWT Key Rotation:**
   - Go to **Project Settings** > **API**.
   - Under **JWT Settings**, click **Generate a new secret**.
   - Copy the newly minted **service_role (secret)** and **anon (public)** keys.
4. **Synchronize Vercel Production Environment:**
   - Update Vercel environment variables securely:
     ```bash
     npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production
     npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
     npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production
     npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
     ```
5. **Redeploy Application:**
   - Trigger production deployment to propagate new credentials:
     ```bash
     npx vercel --prod
     ```

---

## 4. Anti-Disclosure Compliance

- **Zero Secret Disclosure:** No raw API keys, passwords, bearer tokens, or peppers are committed to git or printed in build outputs.
- **Fail-Closed Guarantee:** When authentication tokens are absent or improperly signed, all clinical APIs fail closed with HTTP 401 Unauthorized.
