# MedKit AI — Phase 6A Performance Evidence & Lab Benchmark Report

**Project:** MedKit AI — SIH26047 Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Verification Scope:** Phase 6A Production Performance Measurements & Bundle Audit  
**Status:** ALL PRODUCTION PERFORMANCE TARGETS PASSED

---

## 1. Overview & Verification Methodology

To verify that MedKit AI delivers a fast and responsive clinical application, performance was measured against an optimized local production build (`next build` followed by `next start`) using the Chrome browser channel and the Navigation and Performance Timeline APIs.

No synthetic dev-mode numbers or fabricated field percentiles are reported. Field Core Web Vitals (specifically field INP) require real-user monitoring (RUM) in live deployment and are reported transparently as **NOT YET AVAILABLE**.

---

## 2. Lab Performance Targets & Measured Results

| Route | Name | Protected | LCP (Target <= 2.5s) | CLS (Target <= 0.10) | DOM Elements | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `/` | Landing Page | No | **0.836s** | **0.0014** | 149 | **PASS** |
| `/login` | Clinician Login | No | **0.236s** | **0.0094** | 137 | **PASS** |
| `/intake/new` | Patient Kiosk Intake | No | **0.192s** | **0.0295** | 161 | **PASS** |
| `/doctor/patients` | Doctor Patient Directory | Yes (Auth) | **0.432s** | **0.0259** | 230 | **PASS** |
| `/doctor/cases/new` | Clinical Case Form | Yes (Auth) | **0.340s** | **0.0070** | 186 | **PASS** |
| `/doctor/cases/[id]` | Case Detail Record | Yes (Auth) | **0.208s** | **0.0079** | 302 | **PASS** |

### Key Metrics Summary:
- **Largest Contentful Paint (LCP):** All measured routes load their largest visible content in under **0.84s** in local production benchmarks, well below the Google Web Vitals threshold of 2.5s.
- **Cumulative Layout Shift (CLS):** All measured routes maintain layout shift below **0.03**, significantly outperforming the 0.10 threshold due to fixed aspect ratios, stable skeletons, and reserved header/status heights.
- **Field Interaction to Next Paint (INP):** **NOT YET AVAILABLE** (Pre-deployment baseline; field RUM metrics will be captured after Phase 6D production deployment).

---

## 3. Route Bundle & Code Splitting Optimization

Production bundles were compiled with Next.js 15.5.25. Dynamic import code-splitting isolates heavy, non-critical modules so they do not block initial paints:

| Route | Route Size | First Load JS | Optimization Architecture |
| :--- | :---: | :---: | :--- |
| `/` | 171 B | 106 kB | Static prerender with shared runtime cache. |
| `/login` | 2.94 kB | 106 kB | Minimal auth shell with zero sensitive PHI caching. |
| `/intake/new` | 9.38 kB | 115 kB | Multilingual kiosk with client-side state machine. |
| `/doctor/patients` | 5.59 kB | 112 kB | Real server-side bounded pagination (`getPatientsPage`, max 100, default 25). |
| `/doctor/cases/new` | 10.5 kB | 131 kB | Deconstructed into 8 modular sections; `AyushSection` loaded dynamically via `next/dynamic`. |
| `/doctor/cases/[id]` | 142 kB | 248 kB | Complete clinical case consultation record; heavy JSON/FHIR drawers lazy-loaded on demand. |

Shared runtime bundles total **103 kB** and are cached across all subsequent page transitions.

---

## 4. Associated Evidence Files

- `lab-results.json`: Raw machine-readable JSON containing timestamped route timings, LCP/CLS metrics, DOM node counts, and pass/fail evaluations.
- `route-bundle-summary.txt`: Verbatim route sizes and client chunk breakdowns from the production build trace.
