import { IntakeGuidanceResult } from "@/types/ecosystem";
import { RedFlagAlert } from "@/types/database";

/**
 * Deterministic, safety-constrained preliminary intake guidance generator.
 * Invariant: NEVER autonomously diagnoses disease or prescribes treatment.
 * Evaluates symptoms, chief complaint, and detected red flags to suggest
 * appropriate hospital department and consultation priority.
 */
export function generatePreliminaryIntakeGuidance(params: {
  chiefComplaint: string;
  rawComplaint?: string | null;
  redFlags?: RedFlagAlert[] | null;
  caseType?: "general" | "ayush";
}): IntakeGuidanceResult {
  const text = `${params.chiefComplaint} ${params.rawComplaint || ""}`.toLowerCase();
  const redFlags = params.redFlags || [];
  const hasCriticalRedFlag = redFlags.some((rf) => rf.severity === "critical" || rf.severity === "warning");

  // Priority Assessment (Grounded in clinical safety invariants)
  let priority: "Routine" | "Priority" | "Urgent Clinical Review" = "Routine";
  if (hasCriticalRedFlag || text.includes("chest pain") || text.includes("shortness of breath") || text.includes("severe")) {
    priority = "Urgent Clinical Review";
  } else if (text.includes("fever") || text.includes("vomiting") || text.includes("dizziness")) {
    priority = "Priority";
  }

  // Department Mapping
  let recommendedDepartment = "General Medicine";
  let departmentCode = "GEN_MED";
  const matchedKeywords: string[] = [];

  if (
    params.caseType === "ayush" ||
    text.includes("ayurved") ||
    text.includes("dosha") ||
    text.includes("prakriti") ||
    text.includes("panchakarma") ||
    text.includes("detox")
  ) {
    if (
      text.includes("detox") ||
      text.includes("panchakarma") ||
      text.includes("massage") ||
      text.includes("joint stiffness") ||
      text.includes("stiffness")
    ) {
      recommendedDepartment = "Panchakarma";
      departmentCode = "PANCHA";
      matchedKeywords.push("Ayush Panchakarma / Chronic Mobility");
    } else {
      recommendedDepartment = "Kayachikitsa (Internal Medicine)";
      departmentCode = "KAYA_MED";
      matchedKeywords.push("Ayush Metabolic / Systemic Therapeutics");
    }
  } else if (text.includes("child") || text.includes("baby") || text.includes("infant") || text.includes("pediatric")) {
    recommendedDepartment = "Pediatrics (Kaumarbhritya)";
    departmentCode = "PEDIATRICS";
    matchedKeywords.push("Pediatric / Developmental");
  } else if (text.includes("wound") || text.includes("cut") || text.includes("burn") || text.includes("trauma") || text.includes("swelling") || text.includes("ulcer")) {
    recommendedDepartment = "Shalya Tantra (Surgery & Wound Care)";
    departmentCode = "SURGERY";
    matchedKeywords.push("Surgical Evaluation / Wound Care");
  } else {
    recommendedDepartment = "General Medicine";
    departmentCode = "GEN_MED";
    matchedKeywords.push("Primary Care / General Medicine");
  }

  const reasoning = priority === "Urgent Clinical Review"
    ? "Identified potential clinical red-flag indicators requiring expedited physician evaluation."
    : `Symptom profile matches standard outpatient criteria for ${recommendedDepartment}.`;

  const suggestedAction = priority === "Urgent Clinical Review"
    ? "Proceed immediately to OPD Reception or Triage Nurse for prioritized evaluation."
    : `Book a scheduled consultation slot with the ${recommendedDepartment} department.`;

  const suggestedDoctorRole = departmentCode === "KAYA_MED" || departmentCode === "PANCHA"
    ? "Ayurvedic Physician (Vaidya)"
    : departmentCode === "PEDIATRICS"
    ? "Pediatric Specialist"
    : departmentCode === "SURGERY"
    ? "General Surgeon / Shalya Specialist"
    : "General Physician / Internist";

  const disclaimer = "Non-diagnostic guidance for department routing and triage priority only. Final assessment is conducted by the examining physician.";

  return {
    recommendedDepartment,
    departmentCode,
    priority,
    reasoning,
    suggestedAction,
    matchedKeywords,
    priorityLevel: priority === "Urgent Clinical Review" ? "EMERGENCY" : priority === "Priority" ? "URGENT" : "ROUTINE",
    recommendedDepartmentName: recommendedDepartment,
    recommendedDepartmentCode: departmentCode,
    suggestedDoctorRole,
    rationale: reasoning,
    disclaimer,
  };
}
