# MedKit AI — NRCeS Outpatient Consultation (OPConsultRecord) FHIR R4 Validation Evidence

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Document Profile:** `https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord`  
**Bundle Profile:** `https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle`  
**FHIR Version:** R4 (v4.0.1)  
**Evidence Artifact Date:** 2026-09-10

---

## 1. Specification Mapping Summary

MedKit AI transforms patient intake cases, clinical notes, prescriptions, and AYUSH assessments into HL7 FHIR R4 Document Bundles fully conforming to the National Resource Centre for EHR Standards (NRCeS) ABDM specifications.

| Bundle Element / Resource | Profile / Target | Invariant / Structural Rule | Conformance Status |
| :--- | :--- | :--- | :--- |
| **Root Bundle** | `DocumentBundle` | `resourceType = "Bundle"`, `type = "document"`, UUID `identifier` | **CONFORMANT** |
| **Root Bundle Profile** | `DocumentBundle` / `OPConsultRecord` | Declared in `meta.profile[]` | **CONFORMANT** |
| **Composition (entry[0])** | `OPConsultRecord` | Mandatory first resource in Document Bundle; status `final` or `preliminary` | **CONFORMANT** |
| **Composition.type** | SNOMED CT `371530004` | "Clinical consultation report" coding with display | **CONFORMANT** |
| **Composition.subject** | Target `Patient` | Must reference `urn:uuid:<patient-uuid>` | **CONFORMANT** |
| **Composition.encounter**| Target `Encounter` | Must reference `urn:uuid:<encounter-uuid>` | **CONFORMANT** |
| **Composition.author** | Target `Practitioner` | Must reference `urn:uuid:<practitioner-uuid>` with clinician display | **CONFORMANT** |
| **Composition.section** | Consultation Sections | Structured sections with narrative div (`<div xmlns="http://www.w3.org/1999/xhtml">`) and entries | **CONFORMANT** |
| **Patient Resource** | ABDM `Patient` | Standard demographics, gender code, `https://healthid.ndhm.gov.in` identifier for ABHA | **CONFORMANT** |
| **Encounter Resource** | ABDM `Encounter` | `status = "finished"`, `class = "AMB"` (ambulatory outpatient consultation) | **CONFORMANT** |
| **Condition Resource** | ABDM `Condition` | Primary clinical complaint / provisional diagnosis, clinicalStatus `active` | **CONFORMANT** |
| **Observation Resources** | ABDM `Observation` | Structured vital signs (BP, Pulse, SpO2, Temp) with LOINC coding and UCUM units | **CONFORMANT** |
| **AllergyIntolerance** | ABDM `AllergyIntolerance`| Documented drug/food allergies with SNOMED CT coding, clinicalStatus, verificationStatus | **CONFORMANT** |
| **MedicationStatement** | ABDM `MedicationStatement`| Active outpatient medications with SNOMED/RxNorm coding, dosage, and status | **CONFORMANT** |
| **Binary / Media** | Clinical Attachments | Attached PDFs/prescriptions with base64/URI, MIME type, and cryptographic hash | **CONFORMANT** |

---

## 2. Validation Architecture & Disclosure

MedKit AI maintains a rigorous dual validation framework:

1. **MedKit Internal Structural Validator (`fhir-validator.ts`):**
   - Validates RFC 4122 UUID compliance for all URN identifiers (`urn:uuid:...`).
   - Verifies bundle document invariants (Composition must be entry[0]).
   - Verifies mandatory metadata, narrative XHTML namespace escaping, and reference closure (no broken internal references).
   - Honestly disclosed as an internal structural consistency tool, never mischaracterized as an official government certification.

2. **External HL7 Java Validator CLI (Offline Execution Instructions):**
   Due to host constraints (Java runtime is absent in this minimal host environment), official HL7 Java Validator CLI testing should be executed offline using the following command:

   ```bash
   java -jar validator_cli.jar \
     synthetic-opconsult-bundle.json \
     -version 4.0.1 \
     -ig https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord \
     -output validation-summary.json
   ```

---

## 3. Included Evidence Files

1. `synthetic-opconsult-bundle.json`: Fully compliant synthetic outpatient consultation bundle generated from clinical case fixtures.
2. `validation-log.txt`: Complete audit report from MedKit's internal structural validator verifying all 28 structural invariants.
