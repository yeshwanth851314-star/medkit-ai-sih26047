# MedKit AI — Intelligent Multimodal Clinical Intake & Physician Copilot

[![Live Production](https://img.shields.io/badge/Live%20Production-medkit--ai--sih26047.vercel.app-emerald?style=for-the-badge&logo=vercel)](https://medkit-ai-sih26047.vercel.app)
[![Unit Tests](https://img.shields.io/badge/Unit%20Tests-440%20Passed-emerald)](https://github.com/yeshwanth851314-star/medkit-ai-sih26047)
[![E2E Tests](https://img.shields.io/badge/E2E%20Playwright-17%20Passed-teal)](https://github.com/yeshwanth851314-star/medkit-ai-sih26047)
[![Deployed Golden Path](https://img.shields.io/badge/Deployed%20Golden%20Path-30%2F30%20Steps-success)](https://medkit-ai-sih26047.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Passed-blue)](https://github.com/yeshwanth851314-star/medkit-ai-sih26047)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.2%20AA--Oriented-purple)](https://github.com/yeshwanth851314-star/medkit-ai-sih26047)
[![Interoperability](https://img.shields.io/badge/Interoperability-FHIR%20R4%20%2F%20ABDM%20Mapped-teal)](https://github.com/yeshwanth851314-star/medkit-ai-sih26047)

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Ministry / Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Architecture:** Next.js 15 App Router Modular Monolith • Supabase (RLS & Private Storage) • Google GenAI • Provenance Tracking • Offline Resilience & Demo Reliability Architecture  

---

## 🚀 Live Production & Judge Evaluation URL

MedKit AI is deployed to production on Vercel with real remote Supabase execution and zero platform authentication friction for hackathon evaluators:

* **Canonical Production URL:** [https://medkit-ai-sih26047.vercel.app](https://medkit-ai-sih26047.vercel.app)
* **Judge Evaluation Access:** Publicly accessible in any standard or incognito browser. No Vercel login, invitation, or password required.
* **Patient Kiosk Flow:** [https://medkit-ai-sih26047.vercel.app/intake/new](https://medkit-ai-sih26047.vercel.app/intake/new) (Direct patient self-intake; voice & touch adaptive questioning).
* **Clinician Portal Login:** [https://medkit-ai-sih26047.vercel.app/login](https://medkit-ai-sih26047.vercel.app/login) (Doctor review, triage, longitudinal timeline, and finalization).
* **Real-User Performance Instrumentation:** Active via `@vercel/speed-insights` (Project ID: `R5m4rDqBVBHM8xjOaPdIjb0C5Gc`; Speed Insights production instrumentation active; field INP p75 not yet established).

---

## 1. Executive Summary

MedKit AI is an intelligent clinical intake copilot that prepares a verified, structured clinical history **before** a physician's consultation begins. It processes patient speech (English & Telugu), adaptive touch surveys, and prior medical records (prescriptions, lab tests, discharge summaries) into a standardized clinical dossier.

### Non-Autonomous Clinical Safety Mandate
- **Clinician in Full Control:** MedKit AI does not diagnose, prescribe, or initiate treatment.
- **Fail-Closed Clinical Safety:** When real patient audio or real medical documents encounter upstream AI/provider timeouts or failures, the system strictly fails closed with an informative clinical error banner, **never fabricating synthetic fallback text or phantom records**.
- **Traceable Provenance:** Every datum is tagged with its source: `patient`, `clinician`, `ocr`, `ai`, or `system/rule`.
- **Deterministic Red Flag Engine:** Immediate triage alerts for cardiovascular, stroke, respiratory, and anaphylactic emergencies, requiring explicit doctor acknowledgment.
- **Standardized Legal Disclaimers:**
  - Red flags: *"Potential red flag detected — immediate clinical assessment recommended."*
  - Summaries: *"AI-assisted summary — clinician review required."*
  - Documents: *"Extracted from uploaded document — verify before use."*
  - Interoperability: *"FHIR R4 representation with ABDM/NRCeS-oriented mapping; full profile conformance not yet independently established."*

---

## 2. Key Capabilities & Features

| Capability | Technical Implementation | Safety & Clinical Guardrails |
|---|---|---|
| **Multilingual Voice Intake** | Web Audio MediaRecorder + paired transcript normalization (English & Telugu) | Verbatim Telugu transcript preserved untouched for medical audit. Fails closed on real audio if provider fails; never fabricates speech. |
| **Adaptive Triage Graph** | Deterministic stateful questionnaire graph (`v1.0`) with chest pain & cough branches | Patient can skip questions; responses validated before advancing. |
| **Safety Red-Flag Engine** | Pure deterministic rules engine (`RF-001` through `RF-004`) | Independent of LLMs; triggers high-contrast assertive live region; requires doctor acknowledgment. |
| **Document Intelligence & Storage** | Multi-format OCR ingestion with private Supabase Storage (`clinical-documents` bucket) | Signed ephemeral URLs; strictly fails closed on real documents; side-by-side verification viewer with page references. |
| **Longitudinal Timeline** | Dual-visit delta comparator ("What changed since last visit?") | Tracks resolved vs. ongoing vs. new symptoms; highlights dosage shifts across milestones. |
| **AYUSH Specialized Mode** | Authentic Dashavidha Pariksha (10-fold examination) & Ahara-Vihara | Full Prakriti, Vikriti, Sara, Sattva, and lifestyle profiling with Vaidya verification stamp. |
| **Deterministic Summaries** | Zero-hallucination structured compiler + optional Gemini GenAI synthesis | Mandatory disclaimers; pertinent positives and pertinent negatives highlighted; persistent provenance logging. |
| **Printable Case Sheets** | Dedicated print stylesheet (`@media print`) and clean typography | Standardized hospital header, patient barcode/code, vitals table, and signature block. |
| **FHIR R4 / ABDM Ready** | Full HL7 FHIR R4 Bundle mapping with `Composition` as `entry[0]` | FHIR R4 representation with ABDM/NRCeS-oriented mapping (OPConsultRecord); full profile conformance not yet independently established; LOINC codes for vitals; ABHA identifier support. |
| **Offline Idempotency & Queue** | Client-side queue manager with server-side persistent idempotency table (`sync_mutations`) | Safe intake and draft capture in low-connectivity rural health camps with duplicate replay protection. |
| **Zero-Friction Onboarding** | Scoped clinician guided tour (keyed by doctor ID) & session-scoped kiosk intro | Lightweight, accessible, keyboard-trappable, respects `prefers-reduced-motion`, and replayable at any time. |
| **WCAG 2.2 AA Accessibility** | Verified contrast (>= 4.5:1), visible focus indicators, screen reader live alerts, skip-link | 0 critical / 0 serious violations verified via automated axe-core audits. |

---

## 3. Architecture & Tech Stack

```
                                +-----------------------------------------+
                                |               MedKit AI                 |
                                |     Next.js 15+ App Router Monolith     |
                                +-----------------------------------------+
                                                     |
         +-------------------+-----------------------+-----------------------+
         |                   |                       |                       |
+-----------------+ +-----------------+     +-----------------+     +-----------------+
|  Patient Kiosk  | |  Doctor Copilot |     |  Safety Engine  |     | Interoperability|
| (Telugu/English)| |  Case Sheet UI  |     |  (Red Flags &   |     | (FHIR R4 / ABDM |
|  Voice & Touch  | | Timeline & AYUSH|     | Deterministic)  |     |   Gateway V3)   |
+-----------------+ +-----------------+     +-----------------+     +-----------------+
         |                   |                       |                       |
         +-------------------+-----------------------+-----------------------+
                                                     |
                               +-----------------------------------------+
                               |        Data & Intelligence Layer        |
                               |  - Supabase (PostgreSQL / RLS / Storage)|
                               |  - Google GenAI (Gemini 2.5 Flash)      |
                               |  - Hermetic In-Memory Mock Adapter      |
                               |  - Client Offline Mutation Queue        |
                               |  - Vercel Speed Insights Observability  |
                               +-----------------------------------------+
```

---

## 4. Verification & Testing

The entire system is covered by **440 automated unit & integration tests** across 41 test suites and **17 Playwright E2E tests**:

```bash
# 1. Run all unit and integration tests (Hermetic, offline-reliable)
npm run test:unit

# 2. Run Playwright End-to-End test suite (Includes WCAG 2.2 AA axe audits)
npm run test:e2e

# 3. Run full 30-step clinical golden path against deployed production
npm run test:e2e:real

# 4. Run TypeScript strict typecheck
npm run typecheck

# 5. Run ESLint validation
npm run lint

# 6. Run production build
npm run build
```

---

## 5. Source Packaging & Audit Workflow

A mandatory packaging workflow validates and produces three disjoint, non-overlapping ZIP archives and a cryptographic manifest at `D:\SIH-zip-files-gpt`:

```bash
# Execute deterministic packaging and extract-validation audit
npm run package:audit

# Background continuous package watcher
npm run package:watch
npm run package:watch:status
npm run package:watch:stop
```

### Generated Distribution Artifacts:
1. `medkit-source-assets.zip` — Application source code and assets (`src/`, `public/`)
2. `medkit-tests.zip` — Unit, integration, and end-to-end test suites and synthetic fixtures (`tests/`)
3. `medkit-supabase-config.zip` — Supabase migrations, project configuration, scripts, documentation, and `package-lock.json`
4. `audit-package-manifest.json` — Complete file inventory, per-file SHA-256 hashes, archive mappings, and validation metadata.

---

## 6. Live SIH Demonstration Guide

For the complete 3-minute jury presentation and defense script, refer to:  
👉 **[`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md)**

---

## 7. Specification Pack Reference

- [`docs/FINAL_PRODUCTION_ACCEPTANCE.md`](./docs/FINAL_PRODUCTION_ACCEPTANCE.md) — Final Production Acceptance & Evidence Report
- [`docs/00_MASTER_SPEC.md`](./docs/00_MASTER_SPEC.md) — Master Controlling Specification
- [`docs/01_PRD.md`](./docs/01_PRD.md) — Product Requirements Document
- [`docs/02_TRD.md`](./docs/02_TRD.md) — Technical Requirements Document
- [`docs/03_BACKEND_SCHEMA.md`](./docs/03_BACKEND_SCHEMA.md) — Backend Database & Zod Schemas
- [`docs/04_APP_FLOW.md`](./docs/04_APP_FLOW.md) — State Flows & Error Handling
- [`docs/05_UI_UX_BRIEF.md`](./docs/05_UI_UX_BRIEF.md) — Clinical UX & Accessibility Rules
- [`docs/06_IMPLEMENTATION_PLAN.md`](./docs/06_IMPLEMENTATION_PLAN.md) — 25-Phase Roadmap
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architecture Decision Records (ADR-001 through ADR-008)

---

## 8. Synthetic Data Policy
All test data, documents, and transcripts are synthetic fixtures located in `tests/fixtures/synthetic/`. No Protected Health Information (PHI) is ever used or stored.
