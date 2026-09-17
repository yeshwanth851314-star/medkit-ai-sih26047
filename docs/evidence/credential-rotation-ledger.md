# MedKit AI — Production Credential Rotation Ledger

**Target Environment:** Production (`https://medkit-ai-sih26047.vercel.app`)  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-09-17 / 2026-09-18  

---

## 1. Scope & Objective

As part of Phase C and Phase D Version 1 clinical security hardening, all default, placeholder, and legacy development credentials were systematically rotated and revoked in the live production Supabase instance to prevent unauthorized access.

---

## 2. Rotation Audit Ledger

| Account / Service | Scope | Old State | New State | Verification Result |
|---|---|---|---|---|
| `doctor@medkit.ai` | Primary Clinician Profile | Legacy default password | Cryptographically randomized high-entropy password | **VERIFIED (Old password rejected)** |
| `ayush@medkit.ai` | AYUSH Specialist Profile | Legacy default password | Cryptographically randomized high-entropy password | **VERIFIED (Old password rejected)** |
| `staff@medkit.ai` | Facility Staff / Triage Profile | Legacy default password | Cryptographically randomized high-entropy password | **VERIFIED (Old password rejected)** |
| Temporary Invitations | Remote Intake Tokens | Expired / Pre-test tokens | Revoked via database trigger & SHA-256 hash lookup | **VERIFIED (404/403 enforced)** |
| Session Signing Key | `SESSION_SECRET` | Checked in dev secret | Isolated 256-bit production environment variable in Vercel | **VERIFIED (Dev key rejected in production)** |

---

## 3. Hygiene & Anti-Disclosure Verification

- **Zero Secret Disclosure:** Raw passwords, session secrets, and service keys are strictly excluded from git tracking, build artifacts, test assertions, and client logs.
- **Fail-Closed Auth:** In production mode (`!env.isDemoMode`), fallback to hardcoded mock passwords is systematically disabled.
