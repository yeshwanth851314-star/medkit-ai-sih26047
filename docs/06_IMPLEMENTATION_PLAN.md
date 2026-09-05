# MedKit AI — Implementation Plan

**Version:** 1.0  
**Execution environment:** Google Antigravity  
**Source control:** GitHub  
**Database/auth/storage:** Supabase  
**Deployment:** Vercel  
**Execution philosophy:** Read → Plan → Implement → Test → Verify → Commit

---

## 0. Master Rule

Build the complete basic workflow first.

The project tracker explicitly states that AI, voice, and multilingual capabilities come after the core workflow is working.

Do not allow an AI feature to become a dependency for patient registration, case saving, reopening, or clinician review.

## 1. Phase 0 — Specification & Guardrails

### Deliverables
- Six specification documents.
- README.
- Architecture decision record.
- `.env.example`.
- Git repository.
- CI baseline.
- security/AI safety rules.

### Antigravity must
- read all six documents.
- identify conflicts.
- report assumptions.
- propose a plan.
- not silently rewrite requirements.

### Done when
- app can start.
- typecheck/lint/test/build baseline passes.
- no secrets committed.
- repository structure is clean.

## 2. Phase 1 — Foundation

### Build
- Next.js App Router.
- TypeScript.
- Tailwind.
- shadcn/ui selectively.
- Supabase client/server setup.
- environment validation.
- base layout.
- error/loading/not-found boundaries.
- logging utilities.

### Tests
- environment validation.
- basic page smoke test.
- database connection test.

## 3. Phase 2 — Auth & Authorization

### Build
- login.
- session handling.
- protected routes.
- role model.
- server-side authorization.
- RLS.

### Tests
- valid login.
- invalid login.
- expired session.
- unauthorized patient access.
- direct API access without permission.

## 4. Phase 3 — Patient Management

### Build
- register patient.
- unique patient code.
- search.
- profile.
- validation.
- duplicate warning.

### Tests
- create.
- retrieve.
- search.
- empty result.
- invalid data.
- authorization.

## 5. Phase 4 — Case-Taking MVP

### Build
- chief complaint.
- HPI.
- past history.
- family history.
- personal history.
- medications.
- allergies.
- examination.
- assessment/plan.

### UX
- section navigation.
- progress.
- Save Draft.
- Finalize.
- autosave where safe.

### Tests
- full case creation.
- partial draft.
- refresh/reopen.
- validation.
- duplicate submission.

## 6. Phase 5 — Records & Timeline

### Build
- previous visits.
- case status.
- timestamps.
- patient timeline.
- "compare with previous visit."

### Tests
- ordering.
- permissions.
- draft/final visibility.
- comparison correctness.

## 7. Phase 6 — Summary & PDF

### First implementation
Generate a deterministic structured summary from database fields.

Do this before connecting an LLM.

### Then
- AI-assisted summary behind a feature flag.
- schema validation.
- provenance.
- clinician review.

### PDF
- professional case sheet.
- pagination.
- long-text testing.
- no unnecessary sensitive information.

## 8. Phase 7 — Voice

### First
- browser microphone permission.
- recording state.
- transcription adapter.
- transcript review.

### Then
- Indian language support.
- medical terminology evaluation.
- Gemini Live or another real-time provider if it materially improves the demo.

Voice must never bypass review.

## 9. Phase 8 — Adaptive Question Engine

### Layer 1
Deterministic question graph.

### Layer 2
Natural-language normalization.

### Layer 3
Optional LLM assistance for ambiguous phrasing.

### Required
- versioned question rules.
- test fixtures.
- no unbounded autonomous questioning.

## 10. Phase 9 — Red-Flag Engine

Implement deterministic rules first.

Each rule:
- versioned
- unit tested
- clinically sourced/validated
- transparent in UI
- non-diagnostic

Build a demo rule set around high-salience symptom patterns, but do not present it as a clinical diagnostic system.

## 11. Phase 10 — Document Intelligence

### Pipeline
1. Upload.
2. Validate.
3. Secure storage.
4. OCR.
5. Extraction.
6. Confidence.
7. Source reference.
8. Human verification.
9. Confirm.

### Evaluation set
Create synthetic documents:
- clean printed prescription
- poor scan
- lab report
- discharge summary
- mixed-language document
- intentionally noisy document

Measure:
- extraction correctness
- field completeness
- false extraction
- processing latency

## 12. Phase 11 — AYUSH Mode

Implement:
- case mode switch.
- Dashavidha Pariksha.
- Ahara-Vihara.
- structured review.
- clinician confirmation.

Keep the base workflow shared.

## 13. Phase 12 — Multilingual

MVP:
- English.
- one Indian language selected for strongest demo reliability.

Architecture:
```text
input language
 ↓
ASR / text
 ↓
normalization
 ↓
structured field
 ↓
original wording preserved
 ↓
clinician summary language
```

Never discard the original response solely because it was translated.

## 14. Phase 13 — Interoperability

### Internal
- FHIR-compatible mapping.
- resource validation.
- export/preview.

### ABDM
- sandbox/integration-ready adapter.
- consent-aware exchange.
- no fake production claims.

Only label "ABDM integrated" after actual validated integration.

## 15. Phase 14 — Security Hardening

Run:
- authorization tests.
- RLS review.
- secret scan.
- dependency audit.
- file upload security.
- XSS/HTML sanitization review.
- CSRF/session review as applicable.
- rate limiting.
- logging review.
- data retention review.

Use credential and accidental-data-loss-prevention resources before destructive or secret-handling operations.

## 16. Phase 15 — Accessibility & UX Hardening

Run:
- keyboard audit.
- focus audit.
- contrast audit.
- responsive audit.
- screen-reader smoke checks.
- reduced-motion check.
- kiosk touch audit.

Use Impeccable + accessibility tooling.

## 17. Phase 16 — Performance

Measure:
- page load.
- patient search.
- case save.
- timeline render.
- document upload.
- OCR/extraction latency.
- AI summary latency.

Use Chrome DevTools for:
- network waterfalls.
- performance traces.
- console errors.
- memory problems.

## 18. Phase 17 — E2E & Demo Reliability

Primary Playwright flow:

```text
login
 → register patient
 → open patient
 → create case
 → save draft
 → reopen
 → complete
 → generate summary
 → review
 → finalize
 → open timeline
 → export PDF
```

Secondary AI flow:

```text
voice/transcript
 → adaptive questions
 → red flag
 → document extraction
 → timeline
 → AI summary
 → review
```

Every AI dependency needs a fallback fixture for offline/demo reliability.

## 19. Phase 18 — Deployment

### Production
- Vercel.
- Supabase.
- environment variables.
- HTTPS.
- database backups.
- recovery documentation.

### Preview
Every meaningful PR should be previewable.

## 20. Phase 19 — SIH Demo

### 3-minute narrative
**0:00–0:20** Problem.

**0:20–0:55** Patient chooses language, consents, speaks complaint.

**0:55–1:15** Adaptive questioning + potential red flag.

**1:15–1:40** Upload report → OCR/extraction → confidence.

**1:40–2:10** Clinical Timeline + "what changed?"

**2:10–2:35** Physician Copilot summary → edit/confirm.

**2:35–2:50** AYUSH mode.

**2:50–3:00** FHIR/ABDM readiness + safety statement.

Closing:
> MedKit AI doesn't replace the doctor. It gives the doctor back the time to be a doctor.

## 21. Git Strategy

Branches:
```text
main
develop (optional if team needs it)
feature/*
fix/*
```

Commits:
- small
- descriptive
- buildable

Examples:
```text
feat(auth): add protected clinician routes
feat(patients): add patient registration
feat(cases): add draft persistence
feat(timeline): add longitudinal patient view
feat(ai): add schema-validated summary service
fix(auth): enforce server-side case authorization
test(cases): cover draft recovery
```

## 22. Antigravity Operating Protocol

For every phase:

```text
READ
 ↓
UNDERSTAND
 ↓
IDENTIFY CONFLICTS
 ↓
REPORT
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
VERIFY
 ↓
COMMIT
```

### Resource policy
Use:
- Ponytail for minimal implementation and avoiding speculative abstractions.
- Impeccable for UX critique/polish/hardening.
- Gemini API skills for multimodal/structured outputs.
- Gemini Live for real-time voice.
- Chrome DevTools for browser/performance/network debugging.
- Accessibility skills for a11y.
- Credentials + data-loss prevention for secrets/destructive actions.
- Biomedical/ontology/literature resources only where they improve terminology/rule provenance and can be verified.

## 23. Definition of Done

A phase is done only when:
- code works.
- tests pass.
- failure path works.
- authorization is verified.
- UX states exist.
- no secrets are present.
- docs are updated.
- Git diff is reviewed.
- demo path remains intact.

## 24. Final Release Gate

### Functional
- secure login
- patient registration/search/profile
- full case
- draft/final
- history
- summary
- PDF
- timeline

### Intelligence
- voice
- adaptive questions
- red flags
- OCR/extraction
- AI summary
- AYUSH

### Safety
- consent
- provenance
- clinician review
- authorization
- audit
- secure storage
- safe failure

### Demo
- synthetic data only
- backup path
- rehearsed flow
- no dependency on an unreliable live service
- every team member understands the architecture
