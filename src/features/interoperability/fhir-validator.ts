import { FhirR4Bundle, FhirBundleEntry } from "./types";

export interface FhirValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_COMPOSITION_STATUSES = new Set(["preliminary", "final", "amended", "entered-in-error"]);
const VALID_PATIENT_GENDERS = new Set(["male", "female", "other", "unknown"]);
const VALID_CONDITION_STATUSES = new Set(["active", "recurrence", "relapse", "inactive", "remission", "resolved"]);

/**
 * MedKit Internal Structural Validator (FHIR R4 / NRCeS Structural Alignment)
 * 
 * Validates a FHIR R4 Clinical Document Bundle against HL7 FHIR R4 core structural rules
 * and NRCeS/ABDM (Ayushman Bharat Digital Mission) profile invariants.
 * 
 * NOTE: This is MedKit's internal structural and schema consistency validator, not an official
 * external ABDM certification or sandbox validator.
 */
export function validateFhirBundle(bundle: any): FhirValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle || typeof bundle !== "object") {
    return { valid: false, errors: ["Invalid bundle: Payload must be a non-null JSON object"], warnings: [] };
  }

  // 1. Root Bundle Envelope
  if (bundle.resourceType !== "Bundle") {
    errors.push(`Root resourceType must be 'Bundle', received '${bundle.resourceType}'`);
  }

  if (bundle.type !== "document") {
    errors.push(`Bundle type for clinical record transfer must be 'document', received '${bundle.type}'`);
  }

  if (!bundle.id || typeof bundle.id !== "string") {
    errors.push("Bundle must contain a valid string 'id'");
  }

  if (!bundle.timestamp) {
    warnings.push("Bundle is missing recommended top-level 'timestamp'");
  }

  // ABDM Meta Profile & Version check
  if (!bundle.meta || typeof bundle.meta !== "object") {
    errors.push("DocumentBundle.meta is required");
  } else {
    if (
      bundle.meta.versionId === undefined ||
      bundle.meta.versionId === null ||
      typeof bundle.meta.versionId !== "string" ||
      bundle.meta.versionId.trim() === ""
    ) {
      errors.push("DocumentBundle.meta.versionId is required and must not be empty");
    }

    if (!Array.isArray(bundle.meta.profile) || bundle.meta.profile.length === 0) {
      errors.push("DocumentBundle.meta.profile is required and must not be empty");
    } else {
      const hasAbdmProfile = bundle.meta.profile.some((p: string) =>
        p.includes("nrces.in") || p.includes("ndhm") || p.includes("hl7.org/fhir")
      );
      if (!hasAbdmProfile) {
        warnings.push("Bundle meta.profile does not reference a recognized NRCES/ABDM or HL7 FHIR StructureDefinition");
      }
    }
  }

  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    errors.push("Bundle must contain a non-empty 'entry' array");
    return { valid: false, errors, warnings };
  }

  // 2. FHIR Document Composition Rule: First Entry MUST be Composition
  const firstEntry = bundle.entry[0];
  if (!firstEntry || !firstEntry.resource || firstEntry.resource.resourceType !== "Composition") {
    errors.push("FHIR R4 Document specification requires entry[0] to be a 'Composition' resource");
  }

  // Index all available resource IDs and URNs for reference integrity verification
  const availableUuids = new Set<string>();
  const availableFullUrls = new Set<string>();

  for (const entry of bundle.entry) {
    if (entry.fullUrl) availableFullUrls.add(entry.fullUrl);
    if (entry.resource?.id) {
      availableUuids.add(entry.resource.id.toLowerCase());
      availableUuids.add(`urn:uuid:${entry.resource.id.toLowerCase()}`);
      if (entry.resource.resourceType) {
        availableUuids.add(`${entry.resource.resourceType}/${entry.resource.id}`);
      }
    }
  }

  const collectedReferences: { from: string; ref: string }[] = [];

  // Helper to extract references
  function checkReference(refObj: any, source: string) {
    if (refObj && typeof refObj.reference === "string") {
      collectedReferences.push({ from: source, ref: refObj.reference });
    }
  }

  // 3. Validate each Bundle Entry
  bundle.entry.forEach((entry: FhirBundleEntry, idx: number) => {
    const r: any = entry.resource;
    if (!r || typeof r !== "object") {
      errors.push(`entry[${idx}] missing valid 'resource' object`);
      return;
    }

    if (!entry.fullUrl) {
      warnings.push(`entry[${idx}] (${r.resourceType}) missing 'fullUrl'`);
    }

    if (!r.resourceType || typeof r.resourceType !== "string") {
      errors.push(`entry[${idx}] missing 'resourceType'`);
      return;
    }

    if (!r.id || typeof r.id !== "string") {
      errors.push(`entry[${idx}] (${r.resourceType}) missing 'id'`);
    }

    // Resource-specific validation
    switch (r.resourceType) {
      case "Composition": {
        if (!VALID_COMPOSITION_STATUSES.has(r.status)) {
          errors.push(`Composition status '${r.status}' is invalid. Allowed: ${Array.from(VALID_COMPOSITION_STATUSES).join(", ")}`);
        }
        if (!r.title || typeof r.title !== "string") {
          errors.push("Composition must contain a non-empty string 'title'");
        }
        if (!r.subject?.reference) {
          errors.push("Composition must contain subject.reference pointing to Patient");
        } else {
          checkReference(r.subject, "Composition.subject");
        }
        if (!Array.isArray(r.author) || r.author.length === 0) {
          errors.push("Composition must contain at least one author reference");
        } else {
          r.author.forEach((a: any) => checkReference(a, "Composition.author"));
        }
        if (r.encounter) {
          checkReference(r.encounter, "Composition.encounter");
        }
        if (Array.isArray(r.section)) {
          r.section.forEach((sec: any, secIdx: number) => {
            if (Array.isArray(sec.entry)) {
              sec.entry.forEach((e: any) => checkReference(e, `Composition.section[${secIdx}].entry`));
            }
          });
        }
        break;
      }

      case "Patient": {
        if (!Array.isArray(r.name) || r.name.length === 0) {
          errors.push(`Patient (${r.id}) must have at least one name entry`);
        }
        if (r.gender && !VALID_PATIENT_GENDERS.has(r.gender)) {
          errors.push(`Patient (${r.id}) invalid gender '${r.gender}'`);
        }
        break;
      }

      case "Encounter": {
        if (!r.status) {
          errors.push(`Encounter (${r.id}) missing status`);
        }
        if (!r.class?.code) {
          errors.push(`Encounter (${r.id}) missing class.code`);
        }
        if (!r.subject?.reference) {
          errors.push(`Encounter (${r.id}) missing subject.reference`);
        } else {
          checkReference(r.subject, "Encounter.subject");
        }
        break;
      }

      case "Condition": {
        if (!r.subject?.reference) {
          errors.push(`Condition (${r.id}) missing subject.reference`);
        } else {
          checkReference(r.subject, "Condition.subject");
        }
        if (!r.code?.text && (!Array.isArray(r.code?.coding) || r.code.coding.length === 0)) {
          errors.push(`Condition (${r.id}) must contain code.text or code.coding`);
        }
        const statusCode = r.clinicalStatus?.coding?.[0]?.code;
        if (statusCode && !VALID_CONDITION_STATUSES.has(statusCode)) {
          warnings.push(`Condition (${r.id}) unusual clinicalStatus code: '${statusCode}'`);
        }
        break;
      }

      case "Observation": {
        if (!r.status) {
          errors.push(`Observation (${r.id}) missing status`);
        }
        if (!r.code?.text && (!Array.isArray(r.code?.coding) || r.code.coding.length === 0)) {
          errors.push(`Observation (${r.id}) missing code definition`);
        }
        if (!r.subject?.reference) {
          errors.push(`Observation (${r.id}) missing subject.reference`);
        } else {
          checkReference(r.subject, "Observation.subject");
        }
        if (r.valueQuantity === undefined && r.valueString === undefined && !r.valueCodeableConcept) {
          warnings.push(`Observation (${r.id}) has neither valueQuantity, valueString, nor valueCodeableConcept`);
        }
        break;
      }

      case "AllergyIntolerance": {
        if (!r.patient?.reference) {
          errors.push(`AllergyIntolerance (${r.id}) missing patient.reference`);
        } else {
          checkReference(r.patient, "AllergyIntolerance.patient");
        }
        if (!r.code?.text && (!Array.isArray(r.code?.coding) || r.code.coding.length === 0)) {
          errors.push(`AllergyIntolerance (${r.id}) missing allergen code/text`);
        }
        break;
      }

      case "MedicationStatement": {
        if (!r.status) {
          errors.push(`MedicationStatement (${r.id}) missing status`);
        }
        if (!r.subject?.reference) {
          errors.push(`MedicationStatement (${r.id}) missing subject.reference`);
        } else {
          checkReference(r.subject, "MedicationStatement.subject");
        }
        if (!r.medicationCodeableConcept?.text && (!Array.isArray(r.medicationCodeableConcept?.coding) || r.medicationCodeableConcept.coding.length === 0)) {
          errors.push(`MedicationStatement (${r.id}) missing medicationCodeableConcept`);
        }
        break;
      }

      default:
        // Other valid resources (Practitioner, DocumentReference, etc.)
        break;
    }
  });

  // 4. Reference Integrity Verification
  for (const item of collectedReferences) {
    const ref = item.ref;
    const isUrn = ref.startsWith("urn:uuid:");
    const normalized = isUrn ? ref.toLowerCase() : ref;

    const resolves =
      availableFullUrls.has(ref) ||
      availableUuids.has(normalized) ||
      availableUuids.has(normalized.replace("urn:uuid:", ""));

    if (!resolves) {
      errors.push(`Unresolved reference in ${item.from}: '${ref}' does not match any entry in this Bundle`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
