# MedKit AI — Supabase Performance Advisor Final Evidence Report

**Project Ref:** `aqxwmlqfvnlwabpxqchr` (`MED-KIT-AI`, `ap-southeast-1`)  
**Engine:** Postgres 17.6.1.166  
**Source Tool:** `supabase db advisors --linked --type performance`  
**Execution Timestamp:** 2026-09-18T05:31:00Z  
**Overall Status:** PASS (Zero Critical/Blocking Errors)

## Summary of Findings

| Severity | Count | Blocking V1 |
|---|---|---|
| **ERROR** | 0 | 0 |
| **WARN** | 3 | 0 |
| **INFO** | 0 | 0 |

## Classification & Disposition

1. **Multiple Permissive Policies (3 Warnings)**
   - **Tables:** `case_amendments`, `clinician_professional_profiles`
   - **Detail:** Table has multiple permissive policies for `authenticated` on `SELECT` or `UPDATE` (e.g., self-view and facility admin view).
   - **Assessment:** EXPECTED / NON-BLOCKING. Multi-tenant access controls provide separate policies for clinician self-access versus administrator facility-level management.
   - **Status:** ACCEPTED V1 (Optimization deferred to V2).

2. **Resolved in Migration 20260918000008:**
   - **Duplicate Index:** Dropped redundant constraint `sync_mutations_user_key_uniq` on `public.sync_mutations`. Resolved.
   - **Auth RLS Initialization Plan:** Optimized 6 policies across `profiles`, `sync_mutations`, and `clinician_professional_profiles` to use `(SELECT auth.uid())`. Resolved.
