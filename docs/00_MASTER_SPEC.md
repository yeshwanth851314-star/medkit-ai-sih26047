# MedKit AI — Master Specification

**Product:** MedKit AI  
**Subtitle:** Intelligent Multimodal Clinical Intake & Physician Copilot  
**SIH Problem:** SIH26047 — Patient Case-Taking Software  
**Authority:** This document governs how the six supporting specifications are interpreted and implemented.  
**Version:** 1.0

---

## 1. Purpose

`00_MASTER_SPEC.md` is the controlling engineering document for the MedKit AI project.

It does not replace the six detailed specifications. It defines:
- their precedence;
- the product's non-negotiable principles;
- how Antigravity must reason about changes;
- how project resources should be selected;
- how scope is controlled;
- what must be verified before a phase is accepted.

### Source-of-truth hierarchy

```text
00_MASTER_SPEC.md
        ↓
01_PRD.md
02_TRD.md
03_BACKEND_SCHEMA.md
04_APP_FLOW.md
05_UI_UX_BRIEF.md
06_IMPLEMENTATION_PLAN.md
        ↓
Implementation
```

If two documents conflict:
1. Do not silently choose.
2. Identify the conflict.
3. Prefer the Master Spec.
4. If the Master Spec does not resolve it, prefer safety/security requirements.
5. Then prefer the PRD for product behavior.
6. Then TRD/schema/flow/UI/implementation details as appropriate.
7. Record the decision in `docs/DECISIONS.md`.

---

## 2. Product Definition

MedKit AI converts patient speech, touch/text responses, and medical documents into a structured, reviewable clinical history before physician consultation.

### Core pitch

> MedKit AI turns a patient's voice, answers, and medical documents into a verified, structured clinical history—before the doctor begins the consultation.

### Core promise

> MedKit AI does not replace the doctor. It removes repetitive information-capture work so the doctor can spend more time on examination, reasoning, counselling, and treatment.

---

## 3. Non-Negotiable Safety Boundary

MedKit AI is a **clinical documentation and intake assistant**, not an autonomous diagnostic system.

### Allowed
- capture information;
- transcribe;
- translate/normalize;
- structure;
- extract candidate information from documents;
- ask bounded follow-up questions;
- surface potential red flags;
- generate AI-assisted documentation;
- compare historical records;
- prepare FHIR-compatible representations.

### Not allowed
- autonomous diagnosis;
- autonomous prescribing;
- autonomous treatment decisions;
- presenting model output as clinical truth;
- silently modifying clinician-confirmed facts;
- claiming production ABDM integration without validated integration;
- using synthetic values as if they were official data.

### Required language

Use:
> Potential red flag detected — immediate clinical assessment recommended.

Use:
> AI-assisted summary — clinician review required.

Use:
> Extracted from uploaded document — verify before use.

Do not use:
> Heart attack detected.
> AI diagnosis.
> 100% accurate.

The physician remains the final decision-maker.

---

## 4. MVP Gate

The complete basic workflow must work before advanced intelligence becomes a dependency.

```text
Login
 ↓
Patient
 ↓
Case Taking
 ↓
Save
 ↓
Reopen / View Case
```

The minimum working clinical product must support:
- authentication;
- patient registration/search/profile;
- complete structured case;
- draft/final state;
- previous cases;
- timeline;
- deterministic structured summary;
- printable/PDF case sheet;
- server-side authorization;
- audit of important actions.

AI, voice, OCR, multilingual, AYUSH, and interoperability are layered onto this stable core.

---

## 5. Architecture Principle

### Default

**Modular monolith first.**

Use one coherent Next.js application with clear domain boundaries.

Do not introduce:
- microservices;
- message brokers;
- Kubernetes;
- unnecessary queues;
- speculative vector databases;
- multiple backend runtimes;
- unnecessary third-party platforms

unless a concrete requirement, measured bottleneck, or integration forces the decision.

### Why

The project needs:
- feasibility;
- rapid iteration;
- testability;
- easy deployment;
- reliable SIH demonstration;
- low operational complexity.

---

## 6. Canonical Architecture

```text
                  ┌──────────────────────────┐
                  │ Patient / Doctor Browser │
                  │ Desktop / Tablet / Kiosk │
                  └────────────┬─────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Next.js Application │
                    ├─────────────────────┤
                    │ UI / App Router     │
                    │ Auth                │
                    │ Validation          │
                    │ Domain Services     │
                    │ API / Server Actions│
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
        ┌─────────┐       ┌──────────┐     ┌──────────────┐
        │ Supabase│       │ AI Layer │     │ FHIR / ABDM │
        │ Auth    │       │ ASR      │     │ Integration │
        │ Postgres│       │ OCR      │     │ Boundary    │
        │ Storage │       │ Summary  │     └──────────────┘
        │ RLS     │       │ Questions│
        └─────────┘       │ Red Flags│
                          └──────────┘
```

---

## 7. Canonical Domain Boundaries

```text
auth
patients
cases
timeline
documents
interview
red-flags
summaries
ayush
audit
interoperability
```

Each domain should own its business logic.

UI components must not contain critical authorization or clinical business rules.

---

## 8. Canonical Data Principles

### Source hierarchy

```text
Raw patient input
       ↓
Captured/transcribed content
       ↓
Normalized candidate
       ↓
AI/OCR-derived candidate
       ↓
Clinician review
       ↓
Clinician-confirmed record
```

Never skip provenance.

Every derived clinical value should have a source classification:
- `patient`
- `clinician`
- `ocr`
- `ai`
- `system/rule`

---

## 9. Clinical Timeline

The Clinical Timeline is the product's major UX differentiator.

It represents a longitudinal **structured clinical record**, not a biological digital twin.

The primary question it should answer:

> What changed since the previous visit?

Timeline information must be based on confirmed/source-traceable data.

---

## 10. AI Architecture Rules

### Rule 1 — Deterministic before generative

Use deterministic logic for:
- required fields;
- validation;
- state transitions;
- red-flag triggers;
- permission checks;
- finalization;
- critical question sequencing.

Use generative AI where it creates genuine value:
- natural-language understanding;
- summarization;
- multimodal extraction;
- translation/normalization;
- conversational voice.

### Rule 2 — Schema-first

AI outputs must conform to explicit schemas.

Invalid output:
- is rejected;
- is repaired only through bounded retry;
- never directly enters clinician-confirmed data.

### Rule 3 — Minimal data

Send only the information required for the AI operation.

### Rule 4 — Human review

AI-generated or OCR-derived clinical information requires review when it could affect clinical interpretation.

### Rule 5 — Failure is normal

AI timeout/failure must not break the case.

---

## 11. Voice Rules

Voice is an input modality, not a separate source of truth.

```text
microphone
 ↓
speech recognition
 ↓
transcript
 ↓
patient/clinician correction
 ↓
structured record
```

If microphone permission is denied:
- provide touch/text fallback.

If transcription is uncertain:
- display transcript;
- permit correction;
- retain original where useful.

---

## 12. Document Intelligence Rules

```text
document
 ↓
validation
 ↓
private storage
 ↓
OCR / multimodal extraction
 ↓
candidate fields
 ↓
confidence
 ↓
source reference
 ↓
human verification
 ↓
confirmed data
```

The original document remains authoritative as the source artifact.

---

## 13. Red-Flag Rules

The red-flag engine is a safety-oriented rules subsystem.

It must be:
- deterministic where possible;
- versioned;
- unit tested;
- transparent;
- non-diagnostic.

Every rule needs:
- identifier;
- version;
- trigger;
- message;
- urgency;
- test fixtures.

Do not create clinical rules merely from model intuition. Use verified/appropriate clinical references for any rule set that moves beyond a demo-only fixture.

---

## 14. AYUSH Rules

AYUSH mode extends the general case workflow.

It must support structured clinician-verifiable fields including:
- Dashavidha Pariksha;
- Ahara-Vihara;
- associated structured assessment fields defined in the schema.

Do not silently infer constitutional/clinical findings.

---

## 15. Interoperability Rules

Internally model records so that standard FHIR concepts can be mapped cleanly.

Potential mappings include:
- Patient;
- Encounter;
- Observation;
- AllergyIntolerance;
- Medication-related resources;
- DocumentReference;
- Composition/document representation.

ABDM must initially be treated as:
- FHIR/ABDM-compatible architecture;
- integration-ready adapter;
- sandbox/demo target.

Only claim actual integration after successful validation.

---

## 16. Security Rules

Mandatory:
- server-side authorization;
- Supabase RLS;
- environment-based secrets;
- HTTPS in deployment;
- private storage;
- validated uploads;
- secure sessions;
- no provider keys in client code;
- safe error messages;
- minimal logging;
- audit events;
- rate limiting for expensive operations;
- dependency/security checks.

Never:
- commit secrets;
- put PHI in public URLs;
- log raw clinical content by default;
- trust UI-only access controls.

---

## 17. UX Rules

The application must feel like a calm clinical instrument.

### Required
- clear hierarchy;
- obvious next action;
- visible progress;
- accessible controls;
- useful empty states;
- useful errors;
- meaningful loading states;
- keyboard support;
- visible focus;
- contrast target ≥4.5:1;
- touch-friendly patient controls.

### Avoid
- generic chatbot-first UX;
- excessive gradients;
- decorative dashboards;
- excessive animation;
- fake confidence;
- unnecessary charts.

Use Impeccable to critique and harden the UX after functional stability.

---

## 18. Resource Selection Policy

Antigravity has many capabilities. They are **tools, not requirements**.

Use a resource when it improves one of:
1. correctness;
2. clinical safety;
3. security;
4. accessibility;
5. performance;
6. developer productivity;
7. demo reliability;
8. evidence/provenance.

### Resource mapping

| Resource | Use |
|---|---|
| Ponytail | smallest working implementation; avoid speculative abstractions |
| Impeccable | UX critique, dashboard polish, accessibility, visual consistency |
| Gemini API | structured output, multimodal extraction, summarization |
| Gemini Live | real-time voice after text/touch flow is stable |
| Chrome DevTools | network/performance/debugging |
| Accessibility tools | keyboard/focus/contrast/ARIA audits |
| Credentials / data-loss prevention | secrets and destructive-operation safety |
| ML/data-cleaning resources | evaluation datasets and extraction quality |
| Biomedical/ontology/literature resources | terminology and validated rule provenance |
| GitHub CLI | branches, commits, PRs, releases |
| Vercel CLI | preview/deployment verification |
| Node.js | primary application tooling |

Do not call or integrate an API solely because it is available.

---

## 19. Antigravity Execution Protocol

For every task:

```text
1. READ
2. UNDERSTAND
3. IDENTIFY CONFLICTS
4. REPORT
5. PLAN
6. IMPLEMENT
7. TEST
8. VERIFY
9. REVIEW DIFF
10. COMMIT
```

### Before coding
Antigravity must state:
- relevant requirements;
- files affected;
- dependencies needed;
- security impact;
- data impact;
- test plan;
- rollback/fallback.

### After coding
Antigravity must verify:
- typecheck;
- lint;
- tests;
- build;
- relevant E2E;
- authorization;
- accessibility;
- failure path;
- Git diff;
- secrets.

---

## 20. Scope Control

### Priority

```text
P0 — required for functioning product
P1 — strong SIH differentiator
P2 — polish/future
```

If a P2 feature threatens P0 reliability:
> Stop P2 and protect P0.

If a feature cannot be demonstrated, tested, or explained:
> Question whether it belongs in the MVP.

---

## 21. Demo Reliability Principle

Live AI is never allowed to be the only path through the SIH demo.

Every advanced AI capability must have:
- deterministic fallback;
- synthetic fixture;
- known-good demo input;
- failure recovery.

The demo must still work if:
- AI times out;
- speech recognition fails;
- OCR fails;
- internet becomes unstable.

---

## 22. Testing Pyramid

```text
              E2E
             /   \
       Integration
          /       \
        Unit      Domain rules
```

Test heavily:
- authorization;
- data validation;
- case lifecycle;
- red-flag rules;
- provenance;
- summary schema;
- OCR candidate confirmation;
- failure recovery.

---

## 23. Required Test Fixtures

Create synthetic fixtures for:
- normal patient;
- incomplete patient;
- duplicate-suspect patient;
- full case;
- draft case;
- final case;
- noisy transcript;
- mixed-language transcript;
- prescription;
- lab report;
- discharge summary;
- OCR failure;
- AI timeout;
- red-flag trigger;
- unauthorized user.

Never use real patient data.

---

## 24. Definition of Done

A feature is done only when:

- requirements are satisfied;
- UI is usable;
- validation exists;
- authorization exists;
- loading/empty/error/success states exist;
- tests pass;
- failure behavior works;
- audit/provenance is handled where relevant;
- documentation is updated;
- no secrets are present;
- diff is reviewed;
- no unnecessary dependencies are added.

---

## 25. Final SIH Quality Gate

### Functionality
- complete intake workflow;
- clinician workflow;
- patient history;
- timeline;
- documents;
- summary;
- PDF.

### Intelligence
- voice;
- adaptive questions;
- red flags;
- OCR;
- AI summary;
- multilingual;
- AYUSH.

### Trust
- consent;
- provenance;
- human review;
- authorization;
- audit;
- safe failure.

### Interoperability
- FHIR-compatible representation;
- ABDM integration boundary;
- no fake claims.

### Experience
- polished clinician dashboard;
- excellent patient/kiosk flow;
- accessibility;
- responsive design;
- visible system states.

### Demo
- synthetic data;
- rehearsed golden path;
- backup fixtures;
- no unreliable dependency can stop the demo.

---

## 26. Decision Log Requirement

Create and maintain:

`docs/DECISIONS.md`

Each significant architecture/product decision should include:

```text
Decision
Context
Options considered
Chosen option
Why
Trade-offs
Date
```

Do not bury major decisions in chat history.

---

## 27. Change Management

When requirements change:

1. Identify affected documents.
2. Update Master Spec if the principle changes.
3. Update detailed specifications.
4. Record decision.
5. Identify migration/test impact.
6. Implement.
7. Verify old behavior that must remain.

Never allow code to become the only source of truth.

---

## 28. Final Principle

> **Build the simplest trustworthy clinical workflow first, then layer intelligence on top without weakening control, provenance, privacy, or reliability.**
