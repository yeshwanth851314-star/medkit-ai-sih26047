# MedKit AI — Technical Requirements Document (TRD)

**Version:** 1.0  
**Architecture target:** Antigravity-managed Next.js application with Supabase/Postgres  
**Deployment target:** Vercel + Supabase  
**AI boundary:** provider-agnostic service interfaces, with Gemini-capable implementation  
**Interoperability:** FHIR-compatible internal model + ABDM integration boundary

---

## 1. Architecture Decision

### Default architecture

```text
Browser / Tablet / Kiosk
        │
        ▼
Next.js App Router
        │
        ├── Server Components / Server Actions / Route Handlers
        ├── Domain services
        ├── Validation
        └── Authorization
        │
        ▼
Supabase
  ├── Auth
  ├── Postgres
  ├── Storage
  └── Row Level Security
        │
        ├───────────────┐
        ▼               ▼
AI Services        Interoperability
  ├── ASR              ├── FHIR mapper
  ├── OCR              └── ABDM adapter boundary
  ├── extraction
  ├── question engine
  ├── red-flag rules
  └── summary
```

Start as a modular monolith. Do not create microservices until measured workload or deployment constraints justify them.

## 2. Technology Baseline

### Frontend
- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui where it improves consistency.
- Web Audio APIs / MediaRecorder for browser capture.
- Accessible semantic HTML.

### Backend
- Next.js server-side data access.
- Route Handlers / Server Actions for application operations.
- Zod for input validation.
- `server-only` data access modules.
- Domain services separated from UI.

### Database
- PostgreSQL through Supabase.
- Supabase Auth.
- Supabase Storage for documents/audio where required.
- Row Level Security.

### Testing
- Vitest for unit/integration-level domain tests.
- Playwright for end-to-end workflows.
- Accessibility checks.
- Browser/network testing for degraded AI scenarios.

### CI/CD
- GitHub Actions.
- Lint.
- Typecheck.
- Unit tests.
- E2E smoke tests where practical.
- Production build.

### Deployment
- Vercel for Next.js.
- Supabase for database/auth/storage.
- Secrets via environment variables.
- Preview deployments for pull requests.

## 3. Why This Architecture

The project tracker explicitly prioritizes a complete basic workflow before intelligence. A modular monolith reduces infrastructure and debugging overhead while keeping boundaries clean.

Supabase officially supports Next.js with cookie-based authentication, TypeScript and Tailwind, and recommends reviewing RLS and keeping secrets in environment variables before production.

Next.js is directly supported on Vercel.

## 4. Repository Architecture

```text
medkit-ai/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── 01_PRD.md
│   ├── 02_TRD.md
│   ├── 03_BACKEND_SCHEMA.md
│   ├── 04_APP_FLOW.md
│   ├── 05_UI_UX_BRIEF.md
│   └── 06_IMPLEMENTATION_PLAN.md
├── public/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── login/
│   │   ├── doctor/
│   │   │   ├── dashboard/
│   │   │   ├── patients/
│   │   │   ├── cases/
│   │   │   └── settings/
│   │   ├── intake/
│   │   └── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── patient/
│   │   ├── doctor/
│   │   └── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── patients/
│   │   ├── cases/
│   │   ├── timeline/
│   │   ├── documents/
│   │   ├── interview/
│   │   ├── red-flags/
│   │   ├── summaries/
│   │   ├── ayush/
│   │   └── audit/
│   ├── services/
│   │   ├── speech/
│   │   ├── questions/
│   │   ├── documents/
│   │   ├── extraction/
│   │   ├── red-flags/
│   │   ├── summarization/
│   │   └── interoperability/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── validation/
│   │   ├── security/
│   │   └── utils/
│   ├── types/
│   └── config/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── functions/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

Do not create directories or abstractions that have no current purpose.

## 5. Domain Boundaries

### Auth
Owns authentication/session identity, not patient business logic.

### Patients
Owns demographics and patient lookup.

### Cases
Owns clinical case lifecycle and structured history.

### Documents
Owns upload metadata, OCR/extraction state, source provenance.

### Interview
Owns question state and response capture.

### Red Flags
Owns deterministic clinical safety rules and escalation UI.

### Summaries
Owns AI-assisted documentation generation and provenance.

### Timeline
Builds a longitudinal read model from confirmed patient data.

### AYUSH
Owns structured AYUSH-specific fields.

### Audit
Records security-sensitive and clinically meaningful actions.

## 6. AI Architecture

```text
Structured Case Data
        │
        ▼
Minimal-data selector
        │
        ├──► Question Engine
        ├──► Summary Engine
        ├──► Document Extraction
        └──► Translation / normalization
                 │
                 ▼
           Schema validation
                 │
                 ▼
          Provenance validation
                 │
                 ▼
         Clinician review/edit
                 │
                 ▼
             Final save
```

AI output must never directly overwrite clinician-confirmed fields.

## 7. Gemini Integration Boundary

Use official Google GenAI SDKs when Gemini is selected.

Potential uses:
- Structured-output summarization.
- Multimodal document understanding.
- Audio understanding where appropriate.
- Live bidirectional voice for the patient interview.

Gemini Live must be treated as a transport/conversation capability, not as the source of clinical truth.

All provider calls go through a local service interface so the application does not become provider-locked.

## 8. Adaptive Question Engine

Prefer deterministic rules for the first layer.

Example:

```text
chief complaint = chest pain
      ↓
onset?
      ↓
sudden / gradual
      ↓
duration?
      ↓
character?
      ↓
location?
      ↓
radiation?
      ↓
aggravating/relieving?
      ↓
associated symptoms?
      ↓
red-flag rule evaluation
```

The LLM may help with language understanding and normalization, but critical question sequencing must remain bounded and testable.

## 9. Red-Flag Engine

Red flags are rule-based safety signals.

Each rule has:
- id
- trigger condition
- clinical rationale text
- urgency level
- display message
- source/version
- false-positive test cases

Output:

> Potential red flag detected — immediate clinical assessment recommended.

Never output an autonomous diagnosis.

## 10. Document Intelligence

Pipeline:

```text
Upload
 ↓
File validation
 ↓
Virus/security checks
 ↓
OCR / multimodal extraction
 ↓
Structured candidate fields
 ↓
Confidence score
 ↓
Source location / page reference
 ↓
Human verification
 ↓
Confirmed record
```

No extraction is considered clinician-confirmed until reviewed when confidence is insufficient.

## 11. Interoperability

Internal records should be mapped toward standard FHIR concepts.

Potential mappings:
- Patient → Patient
- Encounter/Case → Encounter
- Symptoms/history → Observation / Condition-like representation where appropriate
- Medication history → MedicationStatement / Medication-related resources
- Allergy → AllergyIntolerance
- Document → DocumentReference
- Clinical summary → Composition / document representation where appropriate

FHIR mapping must be versioned and tested.

ABDM should initially be an **integration-ready boundary / sandbox target**, not a fake production integration.

## 12. Security Requirements

- HTTPS in deployment.
- Secrets only in environment variables.
- Never commit credentials.
- Server-side authorization for every protected operation.
- Supabase RLS.
- Validate all user input.
- Parameterized database operations.
- File type/size restrictions.
- Secure document storage.
- Short-lived signed URLs where applicable.
- Avoid sensitive data in logs.
- Audit security-sensitive actions.
- Rate-limit expensive AI operations.
- Do not expose provider API keys to the browser.
- Do not send unnecessary patient fields to AI.

## 13. Privacy / Consent

Consent record should capture:
- patient/session identifier
- purpose
- scope
- timestamp
- consent state
- language/mode
- revocation if supported
- actor/source

Audio explanation may be offered for low-literacy users.

The application should be designed around consent-based health-data exchange and should not imply ABDM production compliance without actual validation.

## 14. Reliability

AI failure must never destroy the source record.

Required behavior:
- Retry bounded number of times.
- Show clear status.
- Preserve input.
- Allow manual completion.
- Allow summary generation later.
- Log technical error without leaking clinical content.

## 15. Observability

Track:
- request ID
- latency
- operation name
- success/failure
- AI provider/model version
- token/cost metadata where available
- document processing duration
- red-flag rule version

Do not log raw patient health content by default.

## 16. Performance Targets

Initial targets for a prototype:
- Dashboard first meaningful interaction: <2.5 s on a normal broadband connection.
- Patient search response: <500 ms for demo-scale data.
- Save operation: <1 s excluding network failure.
- AI operations: show progress and never block the UI indefinitely.
- Document extraction: asynchronous UX for large files.

## 17. Quality Gates

Every feature must pass:
1. Typecheck.
2. Lint.
3. Unit tests.
4. Relevant integration tests.
5. E2E flow where applicable.
6. Accessibility check.
7. Security/authorization check.
8. Failure-path test.
9. Visual QA.

## 18. Antigravity Resource Usage Policy

Use the available Antigravity capabilities selectively:
- Ponytail/minimalism: smallest working implementation first.
- Impeccable: critique, polish, harden, accessibility, dashboard UX.
- Gemini API skills: structured output and multimodal implementation.
- Gemini Live: real-time voice only after stable text/touch workflow.
- Chrome DevTools: browser/network/performance debugging.
- Accessibility debugging: keyboard/focus/contrast/ARIA.
- Credentials/data-loss prevention: mandatory for secrets and destructive operations.
- Biomedical literature/ontology skills: use only for validated clinical terminology/rule references, not to manufacture diagnoses.

Do not use every tool merely because it exists. Use a resource when it materially improves quality, correctness, safety, or feasibility.
