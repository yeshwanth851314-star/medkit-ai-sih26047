# MedKit AI — Application Flow Specification

**Version:** 1.0  
**Purpose:** exact user journeys, states, transitions, failure paths, and AI boundaries.

---

## 1. Global Navigation

### Doctor
```text
Login
 ↓
Dashboard
 ├── Patients
 │    ├── Search
 │    ├── Register
 │    └── Patient Profile
 │         ├── Timeline
 │         ├── New Case
 │         └── Previous Cases
 ├── Current Intake
 └── Settings
```

### Patient/Kiosk
```text
Welcome
 ↓
Language
 ↓
Identity / Registration
 ↓
Consent
 ↓
Interview
 ↓
Documents
 ↓
Review
 ↓
Submit
 ↓
Completion / Queue
```

## 2. State Model

Every important asynchronous feature must expose a visible state.

```text
idle
 ↓
loading
 ↓
success
```

Failure branches:
```text
loading → retryable_error → retry
loading → recoverable_error → manual_fallback
loading → fatal_error → preserve_data + exit
```

Never use an infinite spinner.

## 3. Login Flow

```text
/login
 ↓
validate credentials
 ↓
authenticate
 ├── failure → safe error
 └── success
       ↓
     dashboard
```

Requirements:
- Do not reveal whether an account exists through overly specific errors.
- Protect server operations.
- Expired session redirects safely.
- Do not cache patient data in public browser storage.

## 4. Dashboard Flow

Dashboard priorities:
1. Start new patient/case.
2. Search patient.
3. Recent cases.
4. Intake status.
5. Red-flag review queue if role permits.

Avoid KPI decoration that does not help clinical work.

## 5. Patient Registration

Fields:
- name
- DOB/age
- gender
- phone where appropriate
- address where required
- optional blood group
- optional emergency contact

Flow:
```text
form
 ↓
client validation
 ↓
server validation
 ↓
duplicate/similarity warning where appropriate
 ↓
save
 ↓
patient profile
```

Do not auto-merge patients based on weak matching.

## 6. Patient Search

Search:
- patient code
- name
- phone where appropriate

States:
- empty search
- searching
- results
- no results
- error

Never display broad patient lists to unauthorized users.

## 7. Patient Profile

Sections:
- demographics
- current case
- timeline
- previous visits
- documents
- medications/allergies
- confirmed summaries

Primary CTA:
**Start New Case**

Secondary:
**Open Previous Case**

## 8. New Case Flow

```text
Start Case
 ↓
Select case mode
 ├── General
 └── AYUSH
 ↓
Chief Complaint
 ↓
History of Present Illness
 ↓
Past History
 ↓
Family History
 ↓
Personal History
 ↓
Medication / Allergy
 ↓
Examination
 ↓
Assessment / Plan
 ↓
Review
 ↓
Save Draft / Finalize
```

Progress should remain visible.

## 9. Patient Interview Flow

### Step A — Language
Start with English + one Indian language for MVP.

### Step B — Consent
Explain:
- why information is collected
- how it is used
- AI assistance
- document processing
- optional voice processing
- data-sharing boundary

### Step C — Chief complaint
Allow:
- speak
- tap
- type

### Step D — Adaptive questioning
Question engine chooses the next bounded question.

### Step E — Red-flag check
Rules run against structured answers.

### Step F — Review
Patient can hear/read the captured information and correct it.

## 10. Voice Flow

```text
Tap microphone
 ↓
permission
 ↓
recording
 ↓
speech recognition
 ↓
transcript displayed
 ↓
patient/clinician correction
 ↓
structured field update
```

Failure:
- microphone denied → touch/text fallback.
- poor audio → retry.
- network failure → preserve current response.
- transcription uncertain → explicitly mark for review.

## 11. Adaptive Questioning

The engine uses a clinical ontology plus bounded rules.

Example:

```text
"chest pain"
   ↓
onset
   ↓
duration
   ↓
character
   ↓
location
   ↓
radiation
   ↓
aggravating/relieving factors
   ↓
associated symptoms
   ↓
red-flag rules
```

The LLM can normalize natural language but should not freely invent a diagnostic interview.

## 12. Red-Flag UX

When a rule triggers:

```text
┌───────────────────────────────────────┐
│ POTENTIAL RED FLAG                    │
│                                       │
│ Some answers may require immediate    │
│ clinical assessment.                  │
│                                       │
│ Please alert the clinical staff now.  │
└───────────────────────────────────────┘
```

The system should:
- pause optional nonessential questioning if appropriate.
- preserve captured information.
- notify authorized staff.
- record acknowledgement.
- avoid a diagnostic label.

## 13. Document Upload Flow

```text
Select / Scan
 ↓
validate file
 ↓
upload securely
 ↓
processing
 ↓
OCR / multimodal extraction
 ↓
candidate structured fields
 ↓
confidence + source display
 ↓
verify/edit
 ↓
confirm
```

Example UI:

```text
Medication: Amoxicillin
Confidence: 94%
Source: Page 1
[Verify] [Edit]
```

## 14. Clinical Timeline Flow

Timeline cards:
- date
- encounter type
- complaint
- confirmed history
- documents
- medication changes
- important extracted observations

Comparison mode:

```text
Previous Visit       Current Visit
──────────────────────────────────
Cough: 5 days        Cough: 12 days
No fever              Fever added
Medication A          Medication B
```

The comparison is a documentation view, not a diagnostic conclusion.

## 15. Summary Generation

Input:
- minimum necessary structured data
- verified document extractions
- relevant clinician/patient information

Output schema:

```text
patient_context
chief_complaint
hpi
relevant_past_history
medications
allergies
family_history
personal_history
examination
documents_reviewed
red_flags
missing_information
source_references
ai_disclaimer
```

Summary must pass schema validation and provenance checks.

## 16. Summary Review

Every generated summary shows:
- AI-assisted badge.
- Source sections.
- Edit controls.
- Confirm action.
- Regenerate action.

Doctor can reject or edit.

## 17. AYUSH Mode

AYUSH flow extends the base case rather than creating a separate application.

```text
Base history
 ↓
AYUSH history
 ├── Dashavidha Pariksha
 └── Ahara-Vihara
 ↓
Review
 ↓
Clinician confirmation
```

Fields:
- Prakriti
- Vikriti
- Sara
- Samhanana
- Pramana
- Satmya
- Sattva
- Ahara Shakti
- Vyayama Shakti
- Vaya
- Ahara-Vihara

Do not infer these fields without an explicit validated workflow.

## 18. Save Draft

Autosave where safe.

Manual:
**Save Draft**

Requirements:
- preserve current section
- show saved timestamp
- recover after refresh
- avoid duplicate case creation
- handle conflict if another session edits the same record

## 19. Finalization

Before finalization:
- required fields checked
- AI content reviewed where applicable
- OCR candidates verified
- red flags acknowledged where required
- clinician confirms

After finalization:
- mark final
- timestamp
- audit actor
- prevent silent mutation

## 20. PDF Flow

```text
Case
 ↓
render print-safe document
 ↓
validate pagination
 ↓
download/print
```

Do not expose unnecessary sensitive fields.

## 21. FHIR Preview

Provide a developer/doctor-facing optional preview:

```text
Patient
Encounter
Observation
AllergyIntolerance
Medication-related resources
DocumentReference
Composition/summary
```

Label it:
**FHIR-compatible representation / integration preview**

Do not label it:
**ABDM synced**

unless actual integration succeeds.

## 22. Failure Matrix

| Failure | Required response |
|---|---|
| AI timeout | preserve record, retry/manual mode |
| OCR failure | keep original document, allow manual entry |
| Microphone denied | touch/text fallback |
| Poor transcription | show transcript + correction |
| Network loss | preserve local draft where safe |
| Unauthorized access | deny + audit |
| Expired session | redirect, preserve unsaved data where possible |
| Duplicate patient suspicion | warn, never silently merge |
| Invalid document | reject with explanation |
| PDF failure | preserve case, offer retry |
| Summary hallucination suspicion | block unsupported field / require review |

## 23. End-to-End Demo Flow

```text
Login
 → Patient
 → Consent
 → Telugu/English selection
 → Voice complaint
 → Smart follow-up
 → Red-flag signal
 → Upload report
 → OCR extraction
 → Timeline
 → AI summary
 → Doctor review
 → AYUSH mode
 → Finalize
 → PDF
 → FHIR preview
```

This is the primary SIH demonstration path.
