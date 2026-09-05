# MedKit AI — Product Requirements Document (PRD)

**Product:** MedKit AI  
**Subtitle:** Intelligent Multimodal Clinical Intake & Physician Copilot  
**Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Organization:** Ministry of Ayush / All India Institute of Ayurveda  
**Document status:** Master product requirements for Antigravity implementation  
**Version:** 1.0

---

## 1. Product Vision

MedKit AI is a clinician-controlled clinical intake platform that converts a patient's spoken/touch responses and existing medical documents into a structured, reviewable clinical history before the consultation.

> **Core promise:** MedKit AI does not replace the doctor. It removes repetitive information-capture work so the doctor can spend more time on examination, reasoning, counselling, and treatment.

The product is intentionally designed around the SIH26047 first-mile gap: a patient-facing system that can acquire clinical history, digitize prior medical documents, and prepare a physician-ready record before consultation.

## 2. Problem

Indian OPD workflows often compress history-taking into a few minutes. The resulting risks include incomplete histories, repeated questioning, poor organization of previous records, language barriers, and loss of information across visits.

SIH26047 specifically asks for a multimodal patient-facing clinical history platform with voice/touch interaction, adaptive questioning, medical-document digitization, structured physician summaries, AYUSH history support, privacy/consent, and interoperability.

## 3. Target Users

### Primary
- Doctor / authorized healthcare worker
- AYUSH physician
- Clinical staff assisting intake

### Secondary
- Patient
- Caregiver / attendant where permitted
- Hospital administrator / authorized supervisor

### Non-user
- Autonomous AI making final diagnosis or treatment decisions

## 4. Product Goals

1. Securely capture a complete structured clinical history.
2. Support voice and touchscreen input.
3. Adapt follow-up questions to the patient's answers.
4. Digitize uploaded/scanned prescriptions, lab reports, and discharge summaries.
5. Preserve provenance: every AI-extracted/generated fact must be traceable to source input.
6. Surface potential red flags for immediate clinical attention without diagnosing.
7. Support AYUSH-specific structured history, including Dashavidha Pariksha and Ahara-Vihara.
8. Generate a physician-ready summary that is easy to review and edit.
9. Maintain a longitudinal patient timeline.
10. Provide an interoperability boundary suitable for FHIR/ABDM integration.
11. Demonstrate strong privacy, consent, authorization, auditability, and safe failure behavior.
12. Be feasible to build, test, demo, and deploy as a student team.

## 5. Non-Goals

- Autonomous diagnosis.
- Autonomous prescribing.
- Autonomous treatment recommendations.
- Replacing physician examination.
- Full hospital information system replacement.
- Billing, pharmacy inventory, bed management, appointment management, or unrelated hospital modules.
- Production ABDM claims without successful sandbox/partner validation.
- Presenting AI confidence as clinical certainty.
- Using real patient data in the SIH demo.

## 6. Product Principles

### 6.1 Clinician remains in control
AI proposes; clinician reviews, edits, and confirms.

### 6.2 Provenance over plausibility
Do not silently invent, normalize, or change a clinical fact.

### 6.3 Structured first
Capture structured fields whenever possible. Free text remains available for nuance.

### 6.4 Consent first
Consent is explicit, granular where required, revocable, and recorded.

### 6.5 Accessibility first
Voice is not a novelty feature. Every important question must have a touch/text fallback.

### 6.6 Graceful degradation
If AI, OCR, speech, network, or interoperability fails, the core case-taking workflow must remain usable.

### 6.7 Minimal data exposure
Only the minimum required clinical information is sent to an AI service.

## 7. Core Patient Journey

```text
Welcome
  ↓
Language + accessibility selection
  ↓
Identity / patient lookup or registration
  ↓
Consent
  ↓
Chief complaint
  ↓
Adaptive clinical interview
  ├── Voice
  └── Touch / text
  ↓
Potential red-flag check
  ↓
Document upload / scan
  ↓
OCR + extraction + confidence review
  ↓
Patient timeline
  ↓
AI-assisted structured summary
  ↓
Doctor review / edit / confirm
  ↓
Save draft or finalize
  ↓
Printable case sheet
  ↓
FHIR/ABDM integration boundary
```

## 8. Physician Journey

```text
Login
  ↓
Dashboard
  ↓
Search/select patient
  ↓
Patient timeline
  ↓
Open current intake
  ↓
Review:
  - demographics
  - complaint
  - HPI
  - past/family/personal history
  - medications/allergies
  - extracted documents
  - red-flag notices
  - AI-assisted summary
  ↓
Edit / confirm
  ↓
Clinical examination + physician assessment
  ↓
Save final case
```

## 9. MVP

The MVP must be complete before advanced intelligence is treated as a dependency.

### MVP capabilities
- Secure login.
- Dashboard.
- Patient registration.
- Patient search.
- Patient profile.
- Complete structured case-taking form.
- Save draft.
- Finalize case.
- Reopen previous case.
- Patient history/timeline.
- Structured summary.
- Printable/PDF case sheet.
- Server-side authorization.
- Audit trail for important changes.

The tracker explicitly requires the basic workflow to work before AI/voice/multilingual features are added.

## 10. Advanced Features

### P0 — required for strong SIH demo
- Voice-to-text.
- Adaptive follow-up questions.
- Medical document OCR/extraction.
- AI-assisted summary.
- Red-flag rules.
- English + one Indian language.
- AYUSH history mode.
- Consent/audit visibility.
- Longitudinal timeline.

### P1 — strong differentiators
- Live bidirectional voice conversation.
- Source-linked extracted facts.
- Extraction confidence visualization.
- Change-since-last-visit comparison.
- FHIR resource preview.
- Offline-safe draft queue where feasible.
- Doctor feedback loop on incorrect extraction.

### P2 — future
- More Indian languages.
- Hospital-system adapters.
- ABHA/ABDM production integration after sandbox/partner validation.
- Advanced analytics.
- Population-level dashboards with strict de-identification.

## 11. Patient Digital Timeline

MedKit AI's signature UX feature is a **Clinical Timeline**, not a biological "digital twin."

For each patient, display:
- Visit date.
- Chief complaint.
- Important history changes.
- Medications/allergies.
- Uploaded documents.
- Key extracted observations.
- Previous clinician-confirmed information.
- Current visit changes.

The doctor should be able to answer:

> **"What changed since the last visit?"**

without manually opening multiple records.

## 12. AI Safety Contract

The application must distinguish:
- Patient-stated information.
- Clinician-entered information.
- OCR-extracted information.
- AI-generated summary text.
- Rule-generated alerts.

Never label an AI-generated conclusion as a confirmed diagnosis.

Use language such as:
- "Potential red flag detected — immediate clinical assessment recommended."
- "AI-assisted summary — clinician review required."
- "Extracted from uploaded document — verify before use."

Do not use:
- "Heart attack detected."
- "Patient has pneumonia."
- "AI diagnosis."

## 13. Success Metrics

### Product
- ≥95% of demo cases complete the core workflow without developer intervention.
- 0 unauthorized patient-data reads in security tests.
- Draft recovery works after refresh/navigation.
- Summary remains traceable to source fields.
- PDF remains readable for long histories.

### AI
- Transcription is always reviewable/editable.
- OCR extraction shows confidence and source location where possible.
- AI summary does not introduce unsupported clinical facts.
- AI timeout/failure leaves the original record intact.

### UX
- New clinician can understand dashboard within 30 seconds.
- Case form shows progress.
- Keyboard navigation works.
- Important alerts are not conveyed by color alone.
- Touch targets are appropriate for kiosk/tablet use.

## 14. SIH Demo Story

1. Patient chooses language.
2. Patient grants consent.
3. Patient speaks a complaint.
4. MedKit asks focused follow-up questions.
5. A potential red flag appears with clear escalation language.
6. Patient uploads a prescription/lab/discharge document.
7. OCR extracts structured information and shows confidence.
8. Timeline combines current intake and historical documents.
9. Physician opens the case.
10. Physician sees a concise structured summary and "what changed" view.
11. Physician edits/confirm.
12. AYUSH mode demonstrates structured traditional history.
13. Printable/FHIR-ready output demonstrates interoperability readiness.

## 15. Demo Data Policy

Only synthetic data may be used in demos, screenshots, test fixtures, and public repositories.

Every synthetic dataset must be labelled as synthetic/demo data.

## 16. Acceptance Gate

The product is not considered MVP-complete until:

- Login works.
- Unauthorized users cannot access patient/case data.
- A patient can be registered and found again.
- A complete case can be created.
- Draft/final state persists.
- Previous cases reopen.
- Summary is generated from the structured record.
- PDF/print works.
- End-to-end tests pass.
- AI features can fail without corrupting the clinical record.
