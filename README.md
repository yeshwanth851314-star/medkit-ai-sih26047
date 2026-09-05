# MedKit AI — Intelligent Multimodal Clinical Intake & Physician Copilot

[![CI / Build Status](https://github.com/your-org/medkit-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/medkit-ai/actions)
![Tests](https://img.shields.io/badge/Tests-73%20Passed-emerald)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Passed-blue)
![WCAG](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-purple)
![Interoperability](https://img.shields.io/badge/Interoperability-FHIR%20R4%20%2F%20ABDM%20Ready-teal)

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Ministry / Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Architecture:** Next.js 15 App Router Modular Monolith • Supabase • Google GenAI • Provenance Tracking • 100% Offline/Demo Reliable  

---

## 1. Executive Summary

MedKit AI is an intelligent clinical intake copilot that prepares a verified, structured clinical history **before** a physician's consultation begins. It processes patient speech (English & Telugu), adaptive touch surveys, and prior medical records (prescriptions, lab tests, discharge summaries) into a standardized clinical dossier.

### Non-Autonomous Clinical Safety Mandate
- **Clinician in Full Control:** MedKit AI does not diagnose, prescribe, or initiate treatment.
- **Traceable Provenance:** Every datum is tagged with its source: `patient`, `clinician`, `ocr`, `ai`, or `system/rule`.
- **Deterministic Red Flag Engine:** Immediate triage alerts for cardiovascular, stroke, respiratory, and anaphylactic emergencies, requiring explicit doctor acknowledgment.
- **Standardized Legal Disclaimers:**
  - Red flags: *"Potential red flag detected — immediate clinical assessment recommended."*
  - Summaries: *"AI-assisted summary — clinician review required."*
  - Documents: *"Extracted from uploaded document — verify before use."*
  - Interoperability: *"FHIR-compatible representation / ABDM integration-ready architecture."*

---

## 2. Key Capabilities & Features

| Capability | Technical Implementation | Safety & Clinical Guardrails |
|---|---|---|
| **Multilingual Voice Intake** | Web Audio MediaRecorder + paired transcript normalization (English & Telugu) | Verbatim Telugu transcript preserved untouched for medical audit. Low-confidence speech (<60%) marked for mandatory edit. |
| **Adaptive Triage Graph** | Deterministic stateful questionnaire graph (`v1.0`) with chest pain & cough branches | Patient can skip questions; responses validated before advancing. |
| **Safety Red-Flag Engine** | Pure deterministic rules engine (`RF-001` through `RF-004`) | Independent of LLMs; triggers high-contrast assertive live region; requires doctor acknowledgment. |
| **Document Intelligence** | Multi-format OCR ingestion (PDF, JPEG, PNG, WEBP) with bounding confidence | Candidate status on extracted medications; side-by-side verification viewer with page references. |
| **Longitudinal Timeline** | Dual-visit delta comparator ("What changed since last visit?") | Tracks resolved vs. ongoing vs. new symptoms; highlights dosage shifts. |
| **AYUSH Specialized Mode** | Authentic Dashavidha Pariksha (10-fold examination) & Ahara-Vihara | Full Prakriti, Vikriti, Sara, Sattva, and lifestyle profiling with Vaidya verification stamp. |
| **Deterministic Summaries** | Zero-hallucination structured compiler + optional Gemini GenAI synthesis | Mandatory disclaimers; pertinent positives and pertinent negatives highlighted. |
| **Printable Case Sheets** | Dedicated print stylesheet (`@media print`) and clean typography | Standardized hospital header, patient barcode/code, vitals table, and signature block. |
| **FHIR R4 / ABDM Ready** | Full HL7 FHIR R4 Bundle mapping (Patient, Encounter, Condition, Observations, Allergies, Medications) | NRCES Clinical Artifact profile compliance; LOINC codes for vitals; ABHA identifier support. |
| **Offline Resilience** | Client-side queue manager with automatic retry and batch synchronization | Safe intake and draft capture in low-connectivity rural health camps. |
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

The entire system is covered by a suite of **73 automated tests** across 17 test suites:

```bash
# Run all unit and integration tests (Hermetic, offline-reliable)
npm run test:unit

# Run TypeScript strict typecheck
npm run typecheck

# Run production build
npm run build
```

---

## 5. Live SIH Demonstration Guide

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
