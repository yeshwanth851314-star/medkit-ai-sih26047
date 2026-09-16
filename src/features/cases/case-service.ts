import {
  createCase,
  updateCase,
  getCaseById,
  getPatientById,
  getCasesByPatientId,
  getCaseAmendments,
  createCaseAmendment,
  getAuthorizedSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/db/supabase";
import { env } from "@/config/env";
import { ClinicalCase } from "@/types/database";
import { CaseInput } from "./types";
import { AuthUser } from "@/features/auth/types";

export async function createCaseDraft(
  input: CaseInput,
  createdBy?: string | null,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase> {
  if (input.status === "final") {
    throw new Error("CANNOT_CREATE_FINAL: Cases must be created as drafts and finalized through the verified clinical workflow.");
  }

  const patientId = input.patientId || (input as any).patient_id;
  if (!patientId || typeof patientId !== "string" || patientId.trim().length === 0) {
    throw new Error("PATIENT_REQUIRED: Valid patientId is required to create a clinical case draft");
  }

  const patient = await getPatientById(patientId, actorOrToken);
  if (!patient) {
    throw new Error(`PATIENT_NOT_FOUND: Patient '${patientId}' was not found`);
  }

  const actorFacilityId =
    typeof actorOrToken === "object" && actorOrToken ? actorOrToken.facilityId : null;
  if (actorFacilityId && patient.facility_id && actorFacilityId !== patient.facility_id) {
    throw new Error(`FORBIDDEN: Clinician facility '${actorFacilityId}' does not match patient facility '${patient.facility_id}'`);
  }

  const resolvedFacilityId = patient.facility_id || actorFacilityId || "fac-delhi-01";

  const chiefComplaint = (input.chiefComplaint || (input as any).chief_complaint || "").trim();

  const newCase = await createCase({
    patient_id: patientId,
    facility_id: resolvedFacilityId,
    consent_id: input.consentId || (input as any).consent_id || null,
    created_by: createdBy || null,
    status: "draft",
    case_type: input.caseType || (input as any).case_type || "general",
    patient_language: input.patientLanguage || (input as any).patient_language || "en",
    chief_complaint: chiefComplaint,
    raw_patient_complaint: input.rawPatientComplaint || (input as any).raw_patient_complaint || null,
    hpi: (input.hpi && typeof input.hpi === "object" && Object.keys(input.hpi).length > 0) ? input.hpi : {},
    past_history: input.pastHistory || (input as any).past_history || null,
    family_history: input.familyHistory || (input as any).family_history || null,
    personal_history: input.personalHistory || (input as any).personal_history || null,
    medication_history: input.medicationHistory || (input as any).medication_history || null,
    allergy_history: input.allergyHistory || (input as any).allergy_history || null,
    examination: input.examination || null,
    assessment_plan: input.assessmentPlan || (input as any).assessment_plan || null,
    ayush_assessment: input.ayushAssessment || (input as any).ayush_assessment || null,
    red_flags: input.red_flags || (input as any).redFlags || null,
    provenance: input.provenance || {
      chief_complaint: "patient",
      hpi: "patient",
      medications: "patient",
      examination: "clinician",
      assessment_plan: "clinician",
    },
    finalized_at: null,
  }, actorOrToken);

  return newCase;
}

export async function updateCaseDraft(
  id: string,
  updates: Partial<CaseInput>,
  options?: { expectedUpdatedAt?: string; actor?: AuthUser | string | null }
): Promise<ClinicalCase> {
  const existing = await getCaseById(id, options?.actor);
  if (!existing) {
    throw new Error("Case not found");
  }

  if (existing.status === "final") {
    throw new Error("CANNOT_MUTATE_FINAL: Finalized cases cannot be directly modified. Create an addendum or revision.");
  }

  // Optimistic concurrency control
  if (options?.expectedUpdatedAt && existing.updated_at) {
    const existingTime = new Date(existing.updated_at).getTime();
    const expectedTime = new Date(options.expectedUpdatedAt).getTime();
    if (existingTime > expectedTime + 1000) {
      throw new Error(
        `CONFLICT_CONCURRENT_UPDATE: Case was modified by another clinician or session at ${existing.updated_at}. Expected ${options.expectedUpdatedAt}.`
      );
    }
  }

  const patch: Partial<ClinicalCase> = {};
  if (updates.chiefComplaint !== undefined) patch.chief_complaint = updates.chiefComplaint;
  if (updates.rawPatientComplaint !== undefined) patch.raw_patient_complaint = updates.rawPatientComplaint;
  if (updates.hpi !== undefined) patch.hpi = (updates.hpi && typeof updates.hpi === "object" && Object.keys(updates.hpi).length > 0) ? updates.hpi : {};
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
  patch.updated_at = new Date().toISOString();

  const updated = await updateCase(id, patch, options?.actor);
  if (!updated) {
    throw new Error("Failed to update case");
  }

  return updated;
}

export async function finalizeCase(
  id: string,
  clinicianId?: string | null,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase> {
  const existing = await getCaseById(id, actorOrToken);
  if (!existing) {
    throw new Error("Case not found");
  }

  if (existing.status === "final") {
    return existing; // Already final
  }

  if (!existing.chief_complaint || existing.chief_complaint.trim().length < 3) {
    throw new Error("VALIDATION_ERROR: Cannot finalize case without a valid chief complaint");
  }

  if (env.isDemoMode) {
    const finalized = await updateCase(id, {
      status: "final",
      finalized_at: new Date().toISOString(),
      finalized_by: clinicianId || null,
    }, actorOrToken);

    if (!finalized) {
      throw new Error("Failed to finalize case");
    }

    return finalized;
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.rpc("rpc_finalize_case_with_audit", {
    p_case_id: id,
  });

  if (error) {
    console.error("Supabase rpc_finalize_case_with_audit error:", error);
    throw new Error(`Database error finalizing case ${id}: ${error.message}`);
  }

  return data as ClinicalCase;
}

export async function getCaseDetails(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase | null> {
  return getCaseById(id, actorOrToken);
}

export async function getPatientCases(
  patientId: string,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase[]> {
  return getCasesByPatientId(patientId, actorOrToken);
}

export async function addCaseAmendment(
  caseId: string,
  amendment: {
    actorId: string;
    actorName: string;
    reason: string;
    notes: string;
  },
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase> {
  const existing = await getCaseById(caseId, actorOrToken);
  if (!existing) {
    throw new Error("Case not found");
  }

  if (existing.status !== "final") {
    throw new Error("CANNOT_AMEND_DRAFT: Amendments can only be appended to finalized clinical records.");
  }

  if (env.isDemoMode) {
    const existingAmendments = await getCaseAmendments(caseId, actorOrToken);
    const version = existingAmendments.length + 1;

    const newAmendmentRecord = {
      id: crypto.randomUUID(),
      case_id: caseId,
      author_id: amendment.actorId,
      author_name: amendment.actorName,
      reason: amendment.reason,
      notes: amendment.notes,
      version,
      created_at: new Date().toISOString(),
    };

    await createCaseAmendment(newAmendmentRecord, actorOrToken);

    // Note: We do NOT mutate the canonical cases row in PostgreSQL cases table!
    // Finalized clinical records are immutable at the database level.
    // We return the synthesized view with the newly appended amendment.
    const mergedAmendments = [
      ...existingAmendments.map((a: any) => ({
        id: a.id,
        version: a.version,
        actor_id: a.author_id || a.actor_id,
        actor_name: a.author_name || a.actor_name,
        timestamp: a.created_at || a.timestamp,
        reason: a.reason,
        notes: a.notes,
      })),
      {
        id: newAmendmentRecord.id,
        version: newAmendmentRecord.version,
        actor_id: newAmendmentRecord.author_id,
        actor_name: newAmendmentRecord.author_name,
        timestamp: newAmendmentRecord.created_at,
        reason: newAmendmentRecord.reason,
        notes: newAmendmentRecord.notes,
      },
    ];

    return {
      ...existing,
      amendments: mergedAmendments,
    };
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { error } = await supabase.rpc("rpc_add_amendment_with_audit", {
    p_case_id: caseId,
    p_reason: amendment.reason,
    p_notes: amendment.notes,
  });

  if (error) {
    console.error("Supabase rpc_add_amendment_with_audit error:", error);
    throw new Error(`Database error amending case ${caseId}: ${error.message}`);
  }

  const allAmendments = await getCaseAmendments(caseId, actorOrToken);
  return {
    ...existing,
    amendments: allAmendments.map((a: any) => ({
      id: a.id,
      version: a.version,
      actor_id: a.author_id || a.actor_id,
      actor_name: a.author_name || a.actor_name,
      timestamp: a.created_at || a.timestamp,
      reason: a.reason,
      notes: a.notes,
    })),
  };
}
