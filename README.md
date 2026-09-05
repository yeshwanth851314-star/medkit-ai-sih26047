# MedKit AI — Intelligent Multimodal Clinical Intake & Physician Copilot

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda  
**Engineering Paradigm:** Next.js App Router Modular Monolith • Supabase • Google GenAI • Provenance Tracking

---

## 1. Product Summary

MedKit AI converts a patient's spoken/touch responses, questionnaire answers, and uploaded prior medical documents (prescriptions, lab reports, discharge summaries) into a verified, structured clinical history **before** the physician consultation begins.

> **Core Promise:** MedKit AI does not replace the doctor. It removes repetitive information-capture work so the doctor can spend more time on examination, reasoning, counselling, and treatment.

### Strict Clinical Safety Boundary
- **Never an autonomous diagnostic system:** MedKit AI does not diagnose, prescribe, or make unilateral treatment decisions.
- **Clinician in Control:** AI proposes; clinician reviews, edits, and confirms.
- **Traceable Provenance:** Every derived clinical fact is stamped with its source: `patient`, `clinician`, `ocr`, `ai`, or `system/rule`.

---

## 2. Architecture Overview

- **Frontend & App Layer:** Next.js 15+ App Router, React 19, TypeScript, Tailwind CSS, accessible semantic UI.
- **Data & Auth:** Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Storage) with deterministic offline fallback mode for demo reliability.
- **AI Boundary:** Decoupled service layer supporting Google GenAI (Gemini) with synthetic test fixtures.
- **Interoperability:** FHIR-compatible internal data representation and ABDM integration-ready boundary.

---

## 3. Specification Pack Reference

The canonical engineering specifications are located in [`docs/`](./docs):
1. [`docs/00_MASTER_SPEC.md`](./docs/00_MASTER_SPEC.md) — Controlling master engineering specification
2. [`docs/01_PRD.md`](./docs/01_PRD.md) — Product requirements document
3. [`docs/02_TRD.md`](./docs/02_TRD.md) — Technical requirements document
4. [`docs/03_BACKEND_SCHEMA.md`](./docs/03_BACKEND_SCHEMA.md) — Backend schema and data contracts
5. [`docs/04_APP_FLOW.md`](./docs/04_APP_FLOW.md) — User flows, states, and error handling
6. [`docs/05_UI_UX_BRIEF.md`](./docs/05_UI_UX_BRIEF.md) — Clinical UI/UX design guidelines
7. [`docs/06_IMPLEMENTATION_PLAN.md`](./docs/06_IMPLEMENTATION_PLAN.md) — 25-phase execution plan
8. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architecture decision records (ADRs)

---

## 4. Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Setup
```bash
# 1. Clone the repository
git clone https://github.com/your-org/medkit-ai.git
cd medkit-ai

# 2. Configure environment variables
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Run development server
npm run dev
```

### Running Tests
```bash
# Unit & domain logic tests
npm run test:unit

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## 5. Synthetic Data Policy
All test data and demonstration scenarios in this repository use completely synthetic fixtures located in `tests/fixtures/synthetic/`. No real patient information or Protected Health Information (PHI) is ever used.
