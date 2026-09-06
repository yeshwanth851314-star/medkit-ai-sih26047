# MedKit AI — Clinical Evidence & Academic Defensibility Dossier
**SIH Problem Statement: SIH26047 — Patient Case-Taking Software**

---

## 1. Executive Problem Grounding

Across Indian outpatient departments (OPDs), clinicians regularly consult 60 to 100+ patients in a single 4-to-5-hour shift. This translates to an average direct encounter duration of **2.5 to 4.5 minutes per patient**.

Under this extreme throughput pressure, documentation and manual history-taking consume an estimated **50% to 70% of consultation time**, precipitating clinical burnout, fragmented longitudinal records, and missed adverse drug interactions.

MedKit AI's architectural choices—multimodal patient self-intake, deterministic red-flag safety rules, structured Dashavidha Pariksha, and physician-supervised copilot summarization—are grounded in peer-reviewed clinical informatics literature.

---

## 2. Evidence Base by Clinical Dimension

### 2.1 Clinical Documentation Burden & Physician Burnout
- **Literature Finding**: A landmark time-motion study published in the *Annals of Internal Medicine* (Sinsky et al., 2016) demonstrated that ambulatory physicians spend **49.2% of their working hours** on electronic health records (EHR) and administrative desk work, and only **27.0% of their total time on direct patient face-to-face interaction**.
- **Impact in Indian OPDs**: In high-density tertiary and government hospitals in India (e.g. AIIMS, AIIA), rapid patient turnover compounds this challenge. Physicians must balance clinical examination with immediate paper or terminal documentation.
- **MedKit AI Architecture Solution**: Pre-consultation patient-assisted intake transforms conversational responses into structured History of Present Illness (HPI) before the doctor examines the patient, restoring face-to-face physician attention.

### 2.2 Medication Reconciliation & Transcription Errors
- **Literature Finding**: According to the World Health Organization (WHO) Global Patient Safety Challenge: *Medication Without Harm* (2017), medication discrepancies occur in **up to 67% of patient admissions and clinic visits**, primarily due to inaccurate recall of prior prescriptions, illegible handwriting, or lost physical records.
- **MedKit AI Architecture Solution**: Multimodal OCR ingests physical prescription slips and lab reports, extracts candidate medication names, strengths, and dosages, and tags them with an explicit `candidate` status until verified by the attending physician.

### 2.3 Language Barriers & Regional Health Equity
- **Literature Finding**: Research in healthcare communication (Flores et al., *New England Journal of Medicine*, 2006) confirms that language discordance between patient and clinician significantly elevates the risk of diagnostic errors, non-adherence, and emergency department revisits.
- **Indian Regional Context**: In Andhra Pradesh and Telangana, millions of rural patients describe complex symptomatology in Telugu (e.g. *"ఛాతీలో తీవ్రమైన నొప్పి, ఎడమ చేయి లాగుతోంది"*), which junior hospital staff often abbreviate or mistranslate.
- **MedKit AI Architecture Solution**: Native bilingual intake engine (English and Telugu) records verbatim native-script speech, maintains bilingual paired entities, and preserves the original patient phrasing for medico-legal auditability.

### 2.4 Longitudinal Care & "What Changed Since Last Visit?"
- **Literature Finding**: The American College of Physicians (ACP) policy guidelines emphasize that chronic disease management (e.g. Type 2 Diabetes, Hypertension) requires comparative trajectory analysis rather than isolated point-in-time assessments.
- **MedKit AI Architecture Solution**: The Longitudinal Clinical Timeline and automated visit-to-visit delta comparator explicitly computes symptom evolution (new vs resolved vs persisting), medication continuation/discontinuation, and vitals trendlines across sequential encounters.

### 2.5 Non-Autonomous AI Safety & Clinician Control
- **Regulatory Framework**: The National Medical Commission (NMC) Code of Medical Ethics and the Ministry of Health and Family Welfare (MoHFW) guidelines strictly establish that **clinical diagnosis and prescribing authority reside exclusively with licensed registered medical practitioners (RMPs)**.
- **MedKit AI Architecture Solution**:
  1. No autonomous diagnostic statements (`"AI diagnosed X"` is strictly prohibited in code and copy).
  2. Mandatory disclaimer on all outputs: *"AI-assisted summary — clinician review required"*.
  3. Deterministic rules engine for red flags (Acute Coronary Syndrome, Stroke, Respiratory Distress, Anaphylaxis) completely isolated from LLM probabilistic hallucinations.

---

## 3. Regulatory Compliance Alignment

| Authority / Standard | Specification | MedKit AI Implementation |
| :--- | :--- | :--- |
| **Ayushman Bharat Digital Mission (ABDM)** | Chapter IV — Consent Management & Data Privacy | Explicit digital consent capture with grant/verify/revoke lifecycle; audit logging for all PHI access. |
| **HL7 International** | Fast Healthcare Interoperability Resources (FHIR) Release 4 | Native bundle serialization (Patient, Encounter, Condition, LOINC Observations, MedicationStatement, DocumentReference). |
| **NRCES India** | National Release Centre for Electronic Standards (SNOMED-CT & LOINC) | Interoperability mapper uses standard LOINC and SNOMED-CT clinical coding for vitals and conditions. |
| **Ministry of Ayush / AIIA** | National Commission for Indian System of Medicine (NCISM) Standards | Authentic Dashavidha Pariksha (10-fold examination: Prakriti, Vikriti, Sara, etc.) and Ahara-Vihara lifestyle analysis. |

---

## 4. Key Academic References

1. **Sinsky, C., et al.** (2016). *Allocation of Physician Time in Ambulatory Practice: A Time and Motion Study in 4 Specialties.* Annals of Internal Medicine, 165(11), 753–760. DOI: [10.7326/M16-0961](https://doi.org/10.7326/M16-0961).
2. **World Health Organization.** (2017). *Medication Without Harm: WHO Global Patient Safety Challenge.* Geneva: World Health Organization. Document WHO/HIS/SDS/2017.6.
3. **Flores, G.** (2006). *Language Barriers to Health Care in the United States.* New England Journal of Medicine, 355(3), 229–231. DOI: [10.1056/NEJMp058316](https://doi.org/10.1056/NEJMp058316).
4. **Rajkomar, A., Dean, J., & Kohane, I.** (2019). *Machine Learning in Medicine.* New England Journal of Medicine, 380(14), 1347–1358. DOI: [10.1056/NEJMra1814259](https://doi.org/10.1056/NEJMra1814259).
5. **Ministry of Health and Family Welfare (MoHFW), Government of India.** (2020). *National Digital Health Blueprint (NDHB) & Ayushman Bharat Digital Mission (ABDM) Architecture Strategy.*
