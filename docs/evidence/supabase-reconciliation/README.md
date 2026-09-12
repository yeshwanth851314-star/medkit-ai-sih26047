# MedKit AI — Supabase Migration Lineage & Remote Schema Drift Reconciliation

**Project:** MedKit AI (SIH26047 — Patient Case-Taking Software)  
**Supabase Project:** `MED-KIT-AI`  
**Project Ref:** `aqxwmlqfvnlwabpxqchr`  
**Region:** `ap-southeast-1` (Singapore)  
**Database Engine:** PostgreSQL 17.6.1.109  

---

## 1. Executive Summary & Audit Conclusions

| Audit Domain | Assessment Result | Canonical Evidence |
| :--- | :--- | :--- |
| **Canonical Git Commit** | `842e5dad468119404ad10448197033dd21268e62` | `git rev-parse HEAD` |
| **Git Working Tree** | `CLEAN` | `git status` |
| **Local Migration Count** | 20 (before forward reconciliation) -> 21 | `supabase/migrations/*.sql` |
| **Local First Migration** | `20260906000001_initial_schema.sql` | `local-migration-inventory.txt` |
| **Local Final Migration** | `20260911000005_final_session_state_authority.sql` | `local-migration-inventory.txt` |
| **Remote Migration Count** | 20 (before forward reconciliation) -> 21 | `remote-migration-history.txt` |
| **Remote / Git Lineage Match** | `EXACT MATCH (100% PARITY)` | `supabase_migrations.schema_migrations` |
| **Table Structure Drift** | `0 UNEXPECTED` (12 core base tables match) | `schema-drift-summary.txt` |
| **RLS Policy Drift** | `0 UNEXPECTED` (25 policies match, fail-closed) | `schema-drift-summary.txt` |
| **Trigger Drift** | `0 UNEXPECTED` (3 triggers match) | `schema-drift-summary.txt` |
| **Constraint / Index Drift** | `0 UNEXPECTED` (all keys/uniques/checks match)| `schema-drift-summary.txt` |
| **Storage Bucket / RLS Drift** | `0 UNEXPECTED` (clinical-documents private) | `schema-drift-summary.txt` |
| **Detected Hot-Fix Drift** | `1 RESOLVED OBJECT` (`public.digest(bytea, text)`)| Forward migration created & applied |
| **Overall Schema Drift** | `0 UNEXPECTED DRIFT` | Fully Reconciled |
| **Final Reconciliation Status**| **`RECONCILED AND FROZEN`** | Ready for Phase 6D |

---

## 2. Root Cause Analysis: The "February vs September" Discrepancy

A discrepancy was identified between two recorded descriptions of the migration history:
1. **Committed Git History & Real Remote Database:**
   - Always started with `20260906000001_initial_schema.sql`
   - Ended with `20260911000005_final_session_state_authority.sql`
   - Total of 20 migrations in `supabase/migrations/`
   - Total of 20 migrations recorded in `supabase_migrations.schema_migrations`
   - Total of 20 migrations archived in `D:\SIH-zip-files-gpt\medkit-supabase-config.zip`
2. **Previous AI Assistant Report Text:**
   - In the previous session, the AI assistant printed a markdown narrative listing hypothetical filenames starting with `20260228000001_initial_schema.sql` and ending with `20260911000001_production_contract_closure.sql`.
   - **Investigation Proof:** Running `git log --all --full-history -- "**/20260228*"` returns zero commits. No February/March migration files ever existed in the repository or were pushed to Supabase. The CLI pushed the September migrations verbatim, and Supabase's `schema_migrations` table confirms version `20260906000001` through `20260911000005`.
   - **Conclusion:** The previous report text contained a hallucinated markdown list. The actual codebase, package archives, and live database were and remain 100% on the canonical September lineage.

---

## 3. Remote Hot-Fix Drift & Forward Migration Resolution

During live integration testing in the previous session:
1. `rpc_execute_idempotent_mutation` declared `SET search_path = public, pg_temp;` as a security defense against search_path injection.
2. Inside the function, it calls `digest(..., 'sha256')`.
3. Supabase installs the `pgcrypto` extension into schema `extensions` rather than `public`.
4. Because `extensions` was not in `search_path`, execution failed with `function digest(bytea, unknown) does not exist`.
5. An ad-hoc remote `CREATE OR REPLACE FUNCTION public.digest(bytea, text) ...` was run directly on the database to verify the test suite without altering the frozen migration file.
6. **The Drift:** The live database contained `public.digest(bytea, text)`, but Git did not track this object in any migration file.

### Forward Migration:
In accordance with production migration hygiene (avoiding rewriting historical applied migrations), a new forward migration was created:
`supabase/migrations/20260912000001_reconcile_remote_schema_drift.sql`
- Captures `public.digest(bytea, text)` canonically.
- Revokes broad execution from `PUBLIC` and `anon`.
- Grants execute to `authenticated` and `service_role`.
- Registers version `20260912000001` in `supabase_migrations.schema_migrations`.

Result: `100% parity` across Git, canonical migrations, remote migration history, and PostgreSQL schema definitions.
