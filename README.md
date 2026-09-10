# MedKit AI — Intelligent Multimodal Clinical Intake & Physician Copilot

[![CI / Build Status](https://github.com/your-org/medkit-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/medkit-ai/actions)
![Tests](https://img.shields.io/badge/Unit%20Tests-206%20Passed-emerald)
![E2E Tests](https://img.shields.io/badge/E2E%20Playwright-11%20Passed-teal)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Passed-blue)
![WCAG](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-purple)
![Interoperability](https://img.shields.io/badge/Interoperability-FHIR%20R4%20%2F%20ABDM%20Ready-teal)

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Ministry / Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Architecture:** Next.js 15 App Router Modular Monolith • Supabase (RLS & Encrypted Storage) • Google GenAI • Provenance Tracking • 100% Offline/Demo Reliable  

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
  - Interoperability: *"FHIR R4-compatible representation / ABDM integration-ready architecture."*

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
| **FHIR R4 / ABDM Ready** | Full HL7 FHIR R4 Bundle mapping with `Composition` as `entry[0]` | NRCES Clinical Artifact profile compliance; LOINC codes for vitals; ABHA identifier support. |
| **Offline Idempotency & Queue** | Client-side queue manager with server-side persistent idempotency table (`sync_mutations`) | Safe intake and draft capture in low-connectivity rural health camps with duplicate replay protection. |
| **Zero-Friction Onboarding** | Scoped clinician guided tour (keyed by doctor ID) & session-scoped kiosk intro | Lightweight, accessible, keyboard-trappable, respects `prefers-reduced-motion`, and replayable at any time. |
| **WCAG 2.1 AA Accessibility** | Verified contrast ($\ge 4.5:1$), visible focus indicators, screen reader live alerts, skip-link | Accessible on clinical kiosks, tablets, and desktops. |

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
|  Voice & Touch  | | Timeline & AYUSH|     | Deterministic)  |     |   Representation|
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
                               +-----------------------------------------+
```

---

## 4. Verification & Testing

The entire system is covered by a suite of **206 automated unit tests** across 27 test suites and **11 Playwright E2E tests**:

```bash
# Run all unit and integration tests (Hermetic, offline-reliable)
npm run test:unit

# Run Playwright End-to-End test suite
npx playwright test

# Run TypeScript strict typecheck
npm run typecheck

# Run ESLint validation
npm run lint

# Run production build
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

## 6. Specification Pack Reference

- [`docs/00_MASTER_SPEC.md`](./docs/00_MASTER_SPEC.md) — Master Controlling Specification
- [`docs/01_PRD.md`](./docs/01_PRD.md) — Product Requirements Document
- [`docs/02_TRD.md`](./docs/02_TRD.md) — Technical Requirements Document
- [`docs/03_BACKEND_SCHEMA.md`](./docs/03_BACKEND_SCHEMA.md) — Backend Database & Zod Schemas
- [`docs/04_APP_FLOW.md`](./docs/04_APP_FLOW.md) — State Flows & Error Handling
- [`docs/05_UI_UX_BRIEF.md`](./docs/05_UI_UX_BRIEF.md) — Clinical UX & Accessibility Rules
- [`docs/06_IMPLEMENTATION_PLAN.md`](./docs/06_IMPLEMENTATION_PLAN.md) — 25-Phase Roadmap
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architecture Decision Records (ADR-001 through ADR-008)

---

## 7. Synthetic Data Policy
All test data, documents, and transcripts are synthetic fixtures located in `tests/fixtures/synthetic/`. No Protected Health Information (PHI) is ever used or stored.
