import { createCase, updateCase, getCaseById, getCasesByPatientId } from "@/lib/db/supabase";
import { ClinicalCase } from "@/types/database";
import { CaseInput } from "./types";

export async function createCaseDraft(
  input: CaseInput,
  createdBy?: string | null
): Promise<ClinicalCase> {
  const newCase = await createCase({
    patient_id: input.patientId,
    consent_id: input.consentId || null,
    created_by: createdBy || null,
    status: "draft",
    case_type: input.caseType,
    patient_language: input.patientLanguage,
    chief_complaint: input.chiefComplaint.trim(),
    raw_patient_complaint: input.rawPatientComplaint || null,
    hpi: input.hpi || null,
    past_history: input.pastHistory || null,
    family_history: input.familyHistory || null,
    personal_history: input.personalHistory || null,
    medication_history: input.medicationHistory || null,
    allergy_history: input.allergyHistory || null,
    examination: input.examination || null,
    assessment_plan: input.assessmentPlan || null,
    ayush_assessment: input.ayushAssessment || null,
    provenance: input.provenance || {
      chief_complaint: "patient",
      hpi: "patient",
      medications: "patient",
      examination: "clinician",
      assessment_plan: "clinician",
    },
    finalized_at: null,
  });

  return newCase;
}

export async function updateCaseDraft(
  id: string,
  updates: Partial<CaseInput>
): Promise<ClinicalCase> {
  const existing = await getCaseById(id);
  if (!existing) {
    throw new Error("Case not found");
  }

  if (existing.status === "final") {
    throw new Error("CANNOT_MUTATE_FINAL: Finalized cases cannot be directly modified. Create an addendum or revision.");
  }

  const patch: Partial<ClinicalCase> = {};
  if (updates.chiefComplaint !== undefined) patch.chief_complaint = updates.chiefComplaint;
  if (updates.rawPatientComplaint !== undefined) patch.raw_patient_complaint = updates.rawPatientComplaint;
  if (updates.hpi !== undefined) patch.hpi = updates.hpi;
  if (updates.pastHistory !== undefined) patch.past_history = updates.pastHistory;
  if (updates.familyHistory !== undefined) patch.family_history = updates.familyHistory;
  if (updates.personalHistory !== undefined) patch.personal_history = updates.personalHistory;
  if (updates.medicationHistory !== undefined) patch.medication_history = updates.medicationHistory;
  if ((updates as any).medication_history !== undefined) patch.medication_history = (updates as any).medication_history;
  if (updates.allergyHistory !== undefined) patch.allergy_history = updates.allergyHistory;
  if ((updates as any).allergy_history !== undefined) patch.allergy_history = (updates as any).allergy_history;
  if (updates.examination !== undefined) patch.examination = updates.examination;
  if (updates.assessmentPlan !== undefined) patch.assessment_plan = updates.assessmentPlan;
  if ((updates as any).assessment_plan !== undefined) patch.assessment_plan = (updates as any).assessment_plan;
  if (updates.ayushAssessment !== undefined) patch.ayush_assessment = updates.ayushAssessment;
  if ((updates as any).ayush_assessment !== undefined) patch.ayush_assessment = (updates as any).ayush_assessment;
  if ((updates as any).red_flags !== undefined) patch.red_flags = (updates as any).red_flags;
  if ((updates as any).redFlags !== undefined) patch.red_flags = (updates as any).redFlags;
  if (updates.provenance !== undefined) patch.provenance = updates.provenance;

  const updated = await updateCase(id, patch);
  if (!updated) {
    throw new Error("Failed to update case");
  }

  return updated;
}

export async function finalizeCase(
  id: string,
  clinicianId?: string | null
): Promise<ClinicalCase> {
  const existing = await getCaseById(id);
  if (!existing) {
    throw new Error("Case not found");
  }

  if (existing.status === "final") {
    return existing; // Already final
  }

  if (!existing.chief_complaint || existing.chief_complaint.trim().length < 3) {
    throw new Error("VALIDATION_ERROR: Cannot finalize case without a valid chief complaint");
  }

  const finalized = await updateCase(id, {
    status: "final",
    finalized_at: new Date().toISOString(),
  });

  if (!finalized) {
    throw new Error("Failed to finalize case");
  }

  return finalized;
}

export async function getCaseDetails(id: string): Promise<ClinicalCase | null> {
  return getCaseById(id);
}

export async function getPatientCases(patientId: string): Promise<ClinicalCase[]> {
  return getCasesByPatientId(patientId);
}
