# MedKit AI — Backend Schema & Data Model

**Version:** 1.0  
**Database:** PostgreSQL / Supabase  
**Principle:** normalized source-of-truth data + immutable-ish provenance + derived read models

---

## 1. Schema Overview

```text
auth.users
    │
    ▼
profiles ───────────────┐
    │                   │
    ▼                   │
cases ◄──── patients    │
 │   │                   │
 │   ├── case_sections   │
 │   ├── observations    │
 │   ├── documents ──────┤
 │   ├── ai_generations  │
 │   ├── red_flag_events  │
 │   └── audit_logs ◄────┘
 │
 └── encounters/timeline read model
```

Use Supabase Auth's user identity rather than storing a second password system.

## 2. Core Tables

### 2.1 profiles

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | references auth.users.id |
| full_name | text | required |
| role | enum | doctor, clinician, admin, staff |
| facility_id | uuid nullable | future multi-facility boundary |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.2 patients

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | internal identifier |
| patient_code | text UNIQUE | human-facing identifier |
| full_name | text | required |
| date_of_birth | date nullable | prefer DOB over derived age |
| gender | text/enum nullable | configurable |
| phone | text nullable | sensitive |
| address | text nullable | sensitive |
| blood_group | text nullable | optional |
| emergency_contact | jsonb nullable | optional |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.3 cases

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| patient_id | uuid FK | required |
| created_by | uuid FK | auth user |
| status | enum | draft, final |
| case_type | enum | general, ayush |
| chief_complaint | text | |
| hpi | jsonb | structured HPI |
| past_history | jsonb | |
| family_history | jsonb | |
| personal_history | jsonb | |
| medication_history | jsonb | |
| allergy_history | jsonb | |
| examination | jsonb | |
| assessment_plan | jsonb | clinician-owned |
| patient_language | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| finalized_at | timestamptz nullable | |

Do not put the entire clinical record into one unstructured JSON field. Use JSONB only where the schema is intentionally extensible.

## 3. case_sections

Optional structured sections for future evolution.

| Field | Type |
|---|---|
| id | uuid PK |
| case_id | uuid FK |
| section_key | text |
| data | jsonb |
| source | enum: patient, clinician, ai, ocr |
| version | integer |
| created_at | timestamptz |
| updated_at | timestamptz |

Use this only where it simplifies evolution. Do not duplicate canonical fields without a reason.

## 4. documents

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| patient_id | uuid FK | |
| case_id | uuid FK nullable | |
| uploaded_by | uuid FK | |
| storage_path | text | private storage only |
| original_filename | text | sanitized |
| mime_type | text | allowlist |
| file_size | bigint | max enforced |
| document_type | enum | prescription, lab, discharge, other |
| processing_status | enum | uploaded, processing, extracted, review, confirmed, failed |
| created_at | timestamptz | |

Never expose storage paths as public URLs.

## 5. document_extractions

| Field | Type |
|---|---|
| id | uuid PK |
| document_id | uuid FK |
| extraction_version | text |
| raw_text | text nullable |
| structured_data | jsonb |
| confidence | numeric |
| page_refs | jsonb |
| model_provider | text |
| model_name | text |
| created_at | timestamptz |

Keep original document separate from derived extraction.

## 6. medications

Use a normalized table if the feature grows beyond simple MVP JSON.

| Field | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK |
| case_id | uuid FK nullable |
| name | text |
| dose | text nullable |
| frequency | text nullable |
| route | text nullable |
| source | enum |
| verified_by | uuid nullable |
| created_at | timestamptz |

## 7. allergies

| Field | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK |
| substance | text |
| reaction | text nullable |
| severity | text nullable |
| source | enum |
| verified_by | uuid nullable |
| created_at | timestamptz |

## 8. interview_sessions

| Field | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK |
| case_id | uuid FK |
| language | text |
| mode | enum: voice, touch, mixed |
| status | enum: active, submitted, abandoned |
| consent_id | uuid FK |
| started_at | timestamptz |
| ended_at | timestamptz nullable |

Temporary session artifacts must have explicit retention rules.

## 9. interview_questions

| Field | Type |
|---|---|
| id | uuid PK |
| session_id | uuid FK |
| question_key | text |
| question_text | text |
| answer_type | text |
| sequence | integer |
| rule_version | text |
| asked_at | timestamptz |

## 10. interview_answers

| Field | Type |
|---|---|
| id | uuid PK |
| question_id | uuid FK |
| raw_answer | text |
| normalized_answer | jsonb nullable |
| input_mode | enum: voice, touch, text |
| transcription_confidence | numeric nullable |
| created_at | timestamptz |

Never overwrite raw patient wording with normalized data.

## 11. red_flag_events

| Field | Type |
|---|---|
| id | uuid PK |
| case_id | uuid FK |
| rule_id | text |
| rule_version | text |
| severity | enum |
| trigger_data | jsonb |
| message | text |
| acknowledged_by | uuid nullable |
| acknowledged_at | timestamptz nullable |
| created_at | timestamptz |

This is a safety signal, not a diagnosis table.

## 12. ai_generations

| Field | Type |
|---|---|
| id | uuid PK |
| case_id | uuid FK |
| operation | enum |
| provider | text |
| model | text |
| prompt_version | text |
| input_hash | text |
| output_json | jsonb |
| confidence | numeric nullable |
| status | enum |
| reviewed_by | uuid nullable |
| reviewed_at | timestamptz nullable |
| created_at | timestamptz |

Do not store unnecessary raw prompts containing full PHI.

## 13. summaries

| Field | Type |
|---|---|
| id | uuid PK |
| case_id | uuid FK |
| summary_type | text |
| content | jsonb |
| generated_from_generation_id | uuid nullable |
| status | enum: draft, reviewed, confirmed |
| confirmed_by | uuid nullable |
| confirmed_at | timestamptz nullable |
| created_at | timestamptz |

## 14. ayush_assessments

```text
case_id
prakriti
vikriti
sara
samhanana
pramana
satmya
sattva
ahara_shakti
vyayama_shakti
vaya
ahara_vihara
source
verified_by
```

Keep this structured and clinician-verifiable. Do not automatically infer constitutional findings unless the clinical workflow explicitly permits a validated rule and clinician confirmation.

## 15. consents

| Field | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK |
| purpose | text |
| scope | jsonb |
| language | text |
| consented | boolean |
| consent_method | enum: touch, voice, assisted |
| consent_version | text |
| granted_at | timestamptz |
| revoked_at | timestamptz nullable |

## 16. audit_logs

| Field | Type |
|---|---|
| id | uuid PK |
| actor_id | uuid nullable |
| action | text |
| resource_type | text |
| resource_id | uuid |
| metadata | jsonb |
| created_at | timestamptz |

Do not store full clinical content in metadata.

## 17. Relationships

```text
Profile 1 ─── N Case
Patient 1 ─── N Case
Patient 1 ─── N Document
Case 1 ─── N Document
Case 1 ─── N InterviewSession
InterviewSession 1 ─── N Question
Question 1 ─── N Answer
Case 1 ─── N RedFlagEvent
Case 1 ─── N AIGeneration
Case 1 ─── N Summary
Patient 1 ─── N Consent
```

## 18. Row Level Security

Minimum policy:
- Authenticated users only.
- Users can access only facilities/roles they are authorized for.
- Patient/case records cannot be accessed solely by knowing UUIDs.
- Server-side authorization remains mandatory even with UI restrictions.
- Storage objects use equivalent access control.

## 19. Indexes

Initial:
- patients(patient_code)
- patients(full_name)
- patients(phone) where appropriate
- cases(patient_id, created_at desc)
- cases(created_by, created_at desc)
- documents(patient_id, created_at desc)
- audit_logs(resource_type, resource_id, created_at desc)

## 20. API Contract

```text
POST   /api/patients
GET    /api/patients?search=
GET    /api/patients/:id

POST   /api/cases
PATCH  /api/cases/:id
GET    /api/cases/:id
GET    /api/patients/:id/cases

POST   /api/cases/:id/summary
GET    /api/cases/:id/pdf

POST   /api/documents
POST   /api/documents/:id/extract
POST   /api/interviews
POST   /api/interviews/:id/answer
POST   /api/interviews/:id/submit

GET    /api/timeline/:patientId
GET    /api/cases/:id/red-flags
```

The exact transport may be Server Actions or Route Handlers; the domain contract must remain stable.

## 21. Data Integrity Rules

- Every case references an existing patient.
- Finalized cases cannot be silently mutated.
- Changes to finalized clinical content create an audit event.
- AI output cannot silently replace clinician-confirmed data.
- OCR candidates remain candidates until verified.
- Raw patient language is preserved where clinically useful.
- Deletion requires explicit policy; never casually hard-delete health records.
