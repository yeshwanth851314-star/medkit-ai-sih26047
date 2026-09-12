# MedKit AI — Live SIH Demonstration & Evaluation Script

**Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Ministry / Sponsor:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Intelligence Mode:** Hybrid Live Intelligence (Gemini 2.5 Flash) with Resilient Deterministic Fallback  

---

## 1. 3-Minute Lightning Pitch (Executive Summary)

### The Hook (0:00 – 0:30)
> *"Respected Jury Members, across India, OPD doctors see 60 to 100 patients every single day. They spend 70% of that precious 4-minute consultation typing names, asking routine questions, and deciphering crumpled prescription slips.  
> **MedKit AI** turns a patient's voice, answers, and medical documents into a verified, structured clinical history—before the doctor begins the consultation.  
> Crucially: **MedKit AI is NOT an autonomous doctor.** The attending physician remains in total control at every step, with strict clinical copy, deterministic red flag guarantees, and ABDM-aligned consent."*

### The Core Demo (0:30 – 2:00)
1. **Intelligence Provider Transparency & Safety Header:**
   - Point to the header badge: Click **`● Live Intelligence`** (or **`● Demo Mode`**).
   - Show the Inspector: Explaining the decoupled architecture—Gemini 2.5 Flash for multimodal reasoning, coupled with an 8-second circuit breaker that guarantees zero venue presentation failures.
2. **Patient Registration & Kiosk Intake with Explicit Consent:**
   - Open `/intake/new`. Switch language to **Telugu** (`తెలుగు`) or English.
   - Show explicit clinical consent screen: Patient acknowledges purpose and scope. Consent is immutably persisted with audit trail.
   - Adaptive symptom questionnaire dynamically branches to the acute cardiac tree upon selecting *"Chest pain / discomfort"*.
3. **Deterministic Red Flag Safety Signal:**
   - Immediately show the high-contrast critical alert:  
     `"Potential red flag detected — immediate clinical assessment recommended."`
   - Point out rule `RF-001` (Cardiovascular Emergency). Only an authenticated doctor can acknowledge it.
4. **Prior Document Ingestion & Provenance:**
   - Upload/Open prior prescription image or PDF.
   - Show OCR extraction with confidence score and `candidate` medication status until confirmed.
5. **Doctor Copilot Review & AYUSH Dashavidha Pariksha:**
   - Doctor opens Case Sheet.
   - Generates AI-assisted clinical summary with mandatory disclaimer:  
     `"AI-assisted summary — clinician review required."`
   - For AYUSH cases: Shows 10-fold examination (Prakriti: *Pitta-Vata*, Vikriti, Sara, Sattva, Ahara-Vihara) with Vaidya verification stamp.
6. **Finalization & Interoperability:**
   - Doctor clicks **Finalize Case**. Mutations are permanently locked (immutability).
   - Click **View FHIR / ABDM Representation**:
     - Shows valid FHIR R4 Bundle (Patient, Encounter, Condition, LOINC Observations).
     - Displays badge: *"FHIR-compatible representation / ABDM integration-ready architecture"*.

### The Conclusion (2:00 – 3:00)
> *"MedKit AI solves the root bottleneck of Indian healthcare: doctor burnout and incomplete patient histories. Built with Next.js App Router, Supabase with RLS, and Google Gemini 2.5 Flash, backed by 440 automated unit & integration tests, 17 Playwright E2E tests, 30/30 deployed golden path steps, and demo-resilient fallback architecture. Thank you."*

---

## 2. Step-by-Step Screen Guide for Presenters

| Step | Screen / URL | Action | What to Say / Point Out |
|---|---|---|---|
| **1** | `/` (Landing Page) | Click Provider Badge in Header | *"Notice the 'Live Intelligence' / 'Demo Mode' indicator revealing provider health, Gemini model status, and fallback guarantees."* |
| **2** | `/doctor/dashboard` | Log in as Dr. Ananya Rao (`doctor@medkit.ai`) | *"Cryptographic HMAC-SHA256 session token with timing-safe verification and role authorization."* |
| **3** | `/doctor/patients` | Search for patient or register | *"Standardized MED-2026 codes and instant duplicate detection."* |
| **4** | `/intake/new` | Select Telugu, complete consent | *"Bilingual intake: verifiable patient consent stored before any interview data is compiled."* |
| **5** | `/doctor/cases/[id]` | Case Sheet view | *"Red flag banner requires explicit physician acknowledgment. Prior OCR medications are tagged with candidate status until confirmed."* |
| **6** | `/doctor/cases/[id]` | Toggle AYUSH tab | *"Comprehensive Dashavidha Pariksha and Ahara-Vihara tailored for Ayurvedic clinical practice."* |
| **7** | `/doctor/cases/[id]` | Click 'Finalize Case' | *"Once finalized, the case becomes tamper-evident and immutable with clinician provenance."* |
| **8** | Modal Drawer | Click 'FHIR / ABDM Preview' | *"Instant HL7 FHIR R4 bundle with LOINC vital codes, ready for NRCES ABDM sandbox ingestion."* |
| **9** | `/doctor/cases/[id]/print` | Click 'Print Clinical Sheet' | *"Print-optimized PDF case sheet with hospital header, doctor signature block, and mandatory disclaimers."* |

---

## 3. Defense Against Tough Jury Questions (Q&A FAQ)

### Q1: *"What if the AI hallucinates a symptom the patient never had?"*
> **Answer:** *"That is why MedKit AI is built on a multi-tiered safety architecture:  
> 1. Red flags are evaluated by a **deterministic, rule-based clinical engine** with zero LLM dependence.  
> 2. Every single clinical fact has an explicit provenance tag: `patient`, `clinician`, `ocr`, `ai`, or `system/rule`.  
> 3. AI outputs are visually styled with amber review borders and marked 'Candidate'. Nothing is saved to the final medical record without explicit clinician approval.  
> 4. Summaries are deterministically compiled from confirmed fields; AI assistance is strictly opt-in and prominently watermarked with 'AI-assisted summary — clinician review required.' "*

### Q2: *"Is this legally approved by ABDM / National Health Authority?"*
> **Answer:** *"We have strictly adhered to ethical representation. Our system exports standard HL7 FHIR R4 bundles conforming to the NRCES Clinical Artifact profile (`https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifact`), with ABHA identifiers and LOINC observations.  
> We prominently label this as a **'FHIR-compatible representation / ABDM integration-ready architecture'**. We do not make false claims of certified live production gateway integration during an academic hackathon."*

### Q3: *"How does this help an Ayurvedic doctor (Vaidya) compared to Western EMRs?"*
> **Answer:** *"Standard Western EMRs force Ayurvedic doctors into foreign diagnostic paradigms. MedKit AI provides native **Dashavidha Pariksha** (Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya) and holistic **Ahara-Vihara** tracking, while preserving allopathic medication and lab records in the same longitudinal timeline."*

### Q4: *"What happens if the hospital internet goes down in a rural area?"*
> **Answer:** *"MedKit AI includes an offline mutation queue manager. All kiosk entries, voice notes, and drafted cases are safely queued in client-side storage with automatic retry and synchronization upon reconnection. Furthermore, red flag rules and deterministic summaries run locally with zero network calls."*
