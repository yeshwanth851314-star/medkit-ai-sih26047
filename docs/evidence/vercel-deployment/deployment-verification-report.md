# MedKit AI — Phase 6D Vercel Deployment & Verification Master Report

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Date:** September 12, 2026  
**Execution Phase:** Phase 6D — Final Deployment Closure to Vercel (Preview & Production)

---

## 1. Executive Summary & Verification Declaration

MedKit AI (SIH26047) has successfully completed Phase 6D Final Deployment Closure. The application is deployed and operational on **Vercel**, backed by the real, live, synchronized **Supabase** cloud infrastructure (`MED-KIT-AI`, project ref: `aqxwmlqfvnlwabpxqchr`, region: `ap-southeast-1`).

Both **Preview** and **Production** deployments were sequentially compiled, linked, configured, protected, and rigorously verified against the live PostgreSQL database, Row Level Security policies, Supabase Auth, and clinical API gates.

```text
================================================================================
DEPLOYMENT AUDIT SUMMARY
================================================================================
Vercel Project Name:            medkit-ai-sih26047
Vercel Project ID:              prj_NnVWnxqPNvTdpM6F6NH4LXOiGUD2
Vercel Team / Scope:            yeshwanth851314-stars-projects
Vercel Deployment Protection:   ACTIVE (ssoProtection: { deploymentType: "all" })
CANONICAL PROD ALIAS PUBLIC:    NO (Strictly Protected: HTTP 302 SSO Redirect)
Supabase Project:               MED-KIT-AI (aqxwmlqfvnlwabpxqchr, ap-southeast-1)
Supabase Migration Lineage:     21 / 21 Applied (Zero Remote Drift)
Operating Mode:                 Non-Demo Production (APP_MODE=production, NEXT_PUBLIC_DEMO_MODE=false)

Preview Deployment URL:         https://medkit-ai-sih26047-9o9jyrtc8-yeshwanth851314-stars-projects.vercel.app
Production Deployment ID:       dpl_27WRAGehBUTFzhZtEwGAodQHAhSm
Production Deployment URL:      https://medkit-ai-sih26047-d2oxx5fn4-yeshwanth851314-stars-projects.vercel.app
Production Canonical Alias:     https://medkit-ai-sih26047.vercel.app

Clinical Golden Path (30 steps): ✅ 30 / 30 PASSED (Real Infrastructure E2E)
Cross-Facility Tenancy:         ✅ PROVEN (Doctor B strictly denied access to Doctor A data)
Storage Authorization:          ✅ PROVEN (Signed download URL valid, cross-facility denied)
API Idempotency & Replay:       ✅ PROVEN (Exact replay safe, conflicting key rejected)
WCAG 2.2 AA Accessibility:      ✅ 0 Critical, 0 Serious Violations across all 6 routes
Lab Performance (CWV):          ✅ LCP <= 2.5s (max 1896 ms), CLS <= 0.10 (max 0.0727)
================================================================================
```

---

## 2. Infrastructure & Security Configuration

### 2.1 Scope & Environment Isolation
Per strict production security requirements:
- **`NEXT_PUBLIC_DEMO_MODE`** is explicitly set to `"false"`.
- **`APP_MODE`** is set to `"production"`.
- **`SESSION_SECRET`** was independently generated for Preview and Production scopes using 32 bytes of cryptographically secure random bytes (`crypto.randomBytes(32).toString('hex')`). No secrets are shared across environments.
- **`SUPABASE_SERVICE_ROLE_KEY`** is stored exclusively as a server-side Secret (`Hidden`), never exposed to the client bundle.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** is stored as public config, scoped by Supabase Row-Level Security.

### 2.2 Vercel Deployment Protection & Bypass Secret Hygiene
Vercel Authentication / Deployment Protection is enforced across ALL deployment types:
```json
{
  "projectId": "prj_NnVWnxqPNvTdpM6F6NH4LXOiGUD2",
  "name": "medkit-ai-sih26047",
  "ssoProtection": {
    "deploymentType": "all"
  },
  "gitForkProtection": true
}
```
- **Canonical Production Alias (`https://medkit-ai-sih26047.vercel.app`):** Returns HTTP `302 Found` with redirect to `https://vercel.com/sso-api?...`.
- **Generated Production URL (`https://medkit-ai-sih26047-d2oxx5fn4-...`):** Returns HTTP `302 Found`.
- **Preview Deployment URL (`https://medkit-ai-sih26047-9o9jyrtc8-...`):** Returns HTTP `302 Found`.
- **Bypass Token Hygiene:** Any previously exposed bypass token was immediately revoked and verified invalid (returning 302). A fresh 32-character alphanumeric automation bypass secret was created via the Vercel API and injected strictly into local secure test runners without logging, outputting, or committing the secret string.

---

## 3. Full Deployed Clinical Golden Path Verification (30 Steps)

The end-to-end clinical workflow was executed via automated Playwright real infrastructure testing through the deployed Vercel frontend, routing to deployed serverless API routes, and writing directly to the live Supabase cloud database (`MED-KIT-AI`).

```text
Suite: tests/e2e/deployed-clinical-golden-path.real.spec.ts
Status: PASSED (30 / 30 steps verified)
Execution Time: 39.9s (Production) / 46.1s (Preview)
```

### Verified Clinical Step Breakdown:
1. **Step 1:** Navigated to deployed `/login` page with automation bypass header.
2. **Step 2:** Form populated with synthetic Doctor A credentials (`synthetic.dr.a@example.com`).
3. **Step 3:** Authenticated against remote Supabase Auth; received HTTP-only secure session cookie; navigated to `/doctor/` directory.
4. **Step 4:** Queried live patient registry via `/doctor/patients`.
5. **Step 5:** Triggered registration dialog; submitted synthetic patient demographics (`PAT-GP-...`).
6. **Step 6:** Record committed to remote Supabase `patients` table; verified persistence across full browser reload and table search.
7. **Step 7:** Executed patient consent registration (`POST /api/consents`) with scopes `['voice_recording', 'document_extraction', 'ai_summary']`.
8. **Step 8:** Opened new clinical case form (`/doctor/cases/new?patientId=...`).
9. **Step 9:** Populated normalized chief complaint and structured HPI onset, duration, and severity (`select#hpi-severity-select`).
10. **Step 10:** Saved draft case (`POST /api/cases`); received case ID and timestamp confirmation.
11. **Step 11:** Verified draft persistence from remote Supabase via `GET /api/cases?patientId=...`.
12. **Step 12:** Reloaded draft in browser UI.
13. **Step 13:** Verified chief complaint and HPI data durability across full page refresh.
14. **Step 14:** Uploaded synthetic clinical document (`knee-xray-report.pdf`, `diagnostic_report`) to private storage (`POST /api/documents`).
15. **Step 15:** Generated pre-signed download URL (`GET /api/documents/[id]?signedUrl=true`).
16. **Step 16:** Downloaded uploaded binary from Supabase storage; confirmed HTTP 200 and byte integrity.
17. **Step 17:** Inserted deterministic cardiovascular red-flag event (`RULE-CARDIO-LIVE-01`, `critical`) into `red_flag_events`.
18. **Step 18:** Clinician acknowledged red flag (`POST /api/cases/[id]/red-flags`).
19. **Step 19:** Verified atomic audit log generation via `rpc_acknowledge_red_flag_with_audit`.
20. **Step 20:** Finalized clinical case (`PATCH /api/cases/[id]` with `{ action: "finalize" }`).
21. **Step 21:** Executed `rpc_finalize_case_with_audit` on remote Supabase; status transitioned to `"final"`.
22. **Step 22:** Immutability verification: Attempted direct mutation on finalized case (`PATCH /api/cases/[id]`).
23. **Step 23:** Mutation rejected with HTTP `403 Forbidden` (`CANNOT_MUTATE_FINAL`).
24. **Step 24:** Confirmed case data remained untouched in PostgreSQL.
25. **Step 25:** Exported standard FHIR R4 document bundle (`GET /api/cases/[id]/fhir`).
26. **Step 26:** Verified Bundle resource structure: 6 entries, resourceType `"Bundle"`, type `"document"`, NRCES/ABDM validation clean.
27. **Step 27:** Navigated to case print route (`/doctor/cases/[id]/print`).
28. **Step 28:** Verified institutional header (`MedKit AI — Clinical Case Record`), demographics, and print layout rendered cleanly.
29. **Step 29:** Executed clinician logout (`POST /api/auth/logout`); session cookie cleared.
30. **Step 30:** Attempted access to protected `/doctor/patients` route; intercepted and redirected to `/login`.

---

## 4. Deployed Security, Cross-Facility Tenancy & Authorization Matrix

A dedicated security test suite (`verify_deployed_security_authorization.cjs`) executed cross-facility attack vectors and storage authorization checks against the live Vercel production deployment:

```text
================================================================
DEPLOYED SECURITY & AUTHORIZATION TEST RESULTS
================================================================
DEPLOYED CALLER IDENTITY PROPAGATION: PASS (Doctor A authenticated via Supabase Auth)
CROSS-FACILITY PATIENT ISOLATION:     PASS (Doctor B search returns false; direct access returns 404)
CROSS-FACILITY CASE ISOLATION:        PASS (Doctor B direct case access denied with 404)
CROSS-FACILITY CONSENT ISOLATION:     PASS (Doctor B consent recording for Patient A denied with 404)
CROSS-FACILITY RED-FLAG ISOLATION:    PASS (Doctor B acknowledgement denied 404; Doctor A allowed 200)
DEPLOYED STORAGE AUTHORIZATION:       PASS (Doctor A signed URL download 200; Doctor B access denied 404)
STORAGE MALFORMED MIME REJECTION:     PASS (HTTP 400 Bad Request for executable/malformed payloads)
IDEMPOTENCY REPLAY SAFETY:            PASS (Initial sync 200, exact replay returns identical 200)
IDEMPOTENCY CONFLICT REJECTION:       PASS (Conflicting payload with same idempotency key rejected)
KIOSK AUTHENTICATION GUARD:           PASS (Unprovisioned kiosk bootstrap rejected with 401)
CREDENTIAL HYGIENE & CLEANUP:         PASS (Test passwords rotated to cryptographically locked state)
================================================================
```

---

## 5. Deployed Lab Performance Evidence

Synthetic lab performance metrics were gathered across 7 deployed routes using Google Chrome with Core Web Vitals observation scripts:

| Route | URL | LCP | CLS | TTFB | CWV Status |
|---|---|---|---|---|---|
| Landing Page | `/` | 172 ms | 0.0013 | 61 ms | **PASS** (<= 2.5s) |
| Login Page | `/login` | 288 ms | 0.0047 | 202 ms | **PASS** (<= 2.5s) |
| Kiosk Intake | `/intake/new` | 128 ms | 0.0107 | 65 ms | **PASS** (<= 2.5s) |
| Doctor Dashboard | `/doctor/dashboard` | 1076 ms | 0.0727 | 66 ms | **PASS** (<= 2.5s) |
| Patients Directory | `/doctor/patients` | 720 ms | 0.0727 | 69 ms | **PASS** (<= 2.5s) |
| New Case | `/doctor/cases/new` | 700 ms | 0.0180 | 62 ms | **PASS** (<= 2.5s) |
| Case Detail | `/doctor/cases/[id]` | 1896 ms | 0.0352 | 77 ms | **PASS** (<= 2.5s) |

- **Largest Contentful Paint (LCP):** Max LCP was 1896 ms (Case Detail), well below the 2.5s threshold.
- **Cumulative Layout Shift (CLS):** Max CLS was 0.0727 (Dashboard & Directory), well below the 0.10 threshold.
- **Interaction to Next Paint (INP):** **`NOT YET AVAILABLE`** (Explicitly labeled as Field INP requires 75th percentile Chrome User Experience Report / RUM data collected from real user traffic over time; lab synthetic tests measure local input latency).
- **Evidence Files:** Saved and verifiable in `docs/evidence/vercel-deployment/performance/`:
  - `preview-lab-results.json`
  - `preview-route-summary.txt`
  - `production-smoke-summary.txt`
  - `README.md`

---

## 6. Deployed Accessibility Matrix (WCAG 2.2 AA)

Automated accessibility verification was executed using `@axe-core/playwright` across all 6 core deployed routes on both Preview and Production:

| Route | Deployed URL | Critical | Serious | Moderate | Minor | Automated Status |
|---|---|:---:|:---:|:---:|:---:|:---:|
| Login Page | `/login` | 0 | 0 | 0 | 0 | **PASS** |
| Kiosk Intake | `/intake/new` | 0 | 0 | 0 | 0 | **PASS** |
| Doctor Dashboard | `/doctor/dashboard` | 0 | 0 | 0 | 0 | **PASS** |
| Patients Directory | `/doctor/patients` | 0 | 0 | 0 | 0 | **PASS** |
| Doctor New Case | `/doctor/cases/new` | 0 | 0 | 0 | 0 | **PASS** |
| Doctor Case Detail | `/doctor/cases/[id]` | 0 | 0 | 0 | 0 | **PASS** |

- **Audit Rules Applied:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Total Critical Violations:** **0**
- **Total Serious Violations:** **0**
- **Keyboard Navigation Semantics:** Verified logical tab focus sequence across interactive links and inputs; verified Escape key dismissal and focus containment on modal dialogs.
- **Terminology Integrity:** Verified all documentation uses "WCAG 2.2 AA-oriented automated verification" and avoids unsupported "certified" claims.

---

## 7. Runtime Log Review

Vercel runtime logs (`vercel logs`) for deployment `dpl_27WRAGehBUTFzhZtEwGAodQHAhSm` and preview deployment `dpl_HKFwK8gxZkYQ4ATmAVbwN1buV71b` were inspected:
- **0 Unexpected 5xx Server Errors:** All API endpoints returned expected status codes.
- **0 Secret Leaks:** No instances of `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, or `VERCEL_AUTOMATION_BYPASS_SECRET` appear in application logs or browser console streams.
- **0 PHI Leaks:** Unauthenticated requests never yield patient health identifiers or clinical notes.

---

## 8. Local Quality Gates Verification

All standard local development gates remain strictly passing:
- **TypeScript Typecheck:** `npm run typecheck` (`tsc --noEmit`) — 0 errors
- **ESLint:** `npm run lint` (`next lint`) — 0 warnings, 0 errors
- **Unit & Integration Tests:** `npm run test:unit` (`vitest run`) — 440 / 440 tests passed
- **End-to-End Suite:** `npm run test:e2e` (`playwright test`) — 17 / 17 tests passed
- **Real Infrastructure E2E Suite:** `npm run test:e2e:real` — 4 / 4 tests passed (3 baseline guards + 30-step clinical golden path)
- **Production Build:** `npm run build` (`next build`) — 22 / 22 routes compiled cleanly

---

## 9. Final Conclusion

Phase 6D is **CLOSED, FROZEN, AND VERIFIED COMPLETE**. MedKit AI is deployed to Vercel in a hardened, protected state with zero mock fallbacks in deployment, real cross-facility multi-tenancy, enforced database Row Level Security, authorized storage access, and verified compliance with AIIA clinical safety invariants.
