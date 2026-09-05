import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";
import { logAuditEvent } from "@/features/security/audit-service";
import { ConsentRecord, RecordConsentInput, consentRecordSchema } from "./types";

/**
 * Persist patient clinical case-taking consent.
 * Every case intake MUST be tied to an explicit consent record.
 */
export async function recordPatientConsent(input: RecordConsentInput): Promise<ConsentRecord> {
  const consentId = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: ConsentRecord = {
    id: consentId,
    patient_id: input.patientId,
    case_id: input.caseId || null,
    purpose: input.purpose || "clinical_care_and_case_taking",
    scope: input.scope || ["voice_recording", "document_extraction", "ai_summary"],
    language: input.language || "en",
    consent_method: input.consentMethod || "touch_acknowledgement",
    consent_version: input.consentVersion || "v1.0",
    consent_timestamp: now,
    revoked: false,
    revoked_at: null,
    created_at: now,
  };

  const validated = consentRecordSchema.parse(record);

  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("consents").insert([validated]).select().single();
    if (error) {
      console.error("Supabase recordPatientConsent error:", error);
      throw new Error(`Failed to persist clinical consent: ${error.message}`);
    }
  } else {
    await mockDb.recordConsent(validated);
  }

  // Record immutable audit event
  await logAuditEvent({
    actorId: input.actorId || input.patientId,
    actorRole: input.actorRole || "patient",
    action: "CONSENT_RECORDED",
    resourceType: "patients",
    resourceId: input.patientId,
    metadata: {
      consentId: validated.id,
      purpose: validated.purpose,
      scope: validated.scope,
      method: validated.consent_method,
      language: validated.language,
    },
  });

  return validated;
}

/**
 * Verify that a patient has an active, non-revoked consent record.
 */
export async function verifyPatientConsent(
  patientId: string
): Promise<{ valid: boolean; consent?: ConsentRecord; reason?: string }> {
  const supabase = getSupabaseClient();
  let consent: ConsentRecord | null = null;

  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase
      .from("consents")
      .select("*")
      .eq("patient_id", patientId)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase verifyPatientConsent error:", error);
      throw new Error(`Failed to verify patient consent: ${error.message}`);
    }
    consent = data as ConsentRecord | null;
  } else {
    consent = (await mockDb.getConsentByPatientId(patientId)) as ConsentRecord | null;
  }

  if (!consent) {
    return {
      valid: false,
      reason: "No clinical consent record exists for this patient.",
    };
  }

  if (consent.revoked) {
    return {
      valid: false,
      consent,
      reason: "Patient clinical consent was revoked.",
    };
  }

  return {
    valid: true,
    consent,
  };
}

/**
 * Revoke patient clinical consent.
 * Once revoked, AI processing and data aggregation are halted.
 */
export async function revokePatientConsent(
  consentId: string,
  actorId?: string,
  reason?: string
): Promise<ConsentRecord> {
  const now = new Date().toISOString();
  let updated: ConsentRecord | null = null;

  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase
      .from("consents")
      .update({ revoked: true, revoked_at: now })
      .eq("id", consentId)
      .select()
      .single();

    if (error) {
      console.error("Supabase revokePatientConsent error:", error);
      throw new Error(`Failed to revoke clinical consent: ${error.message}`);
    }
    updated = data as ConsentRecord;
  } else {
    updated = (await mockDb.revokeConsent(consentId)) as ConsentRecord | null;
  }

  if (!updated) {
    throw new Error(`Consent record '${consentId}' not found.`);
  }

  // Audit revocation
  await logAuditEvent({
    actorId: actorId || updated.patient_id,
    action: "UPDATE_PATIENT",
    resourceType: "patients",
    resourceId: updated.patient_id,
    metadata: {
      action: "revoke_consent",
      consentId: updated.id,
      reason: reason || "Patient requested revocation",
    },
  });

  return updated;
}

/**
 * Retrieve consent record by ID.
 */
export async function getConsentById(consentId: string): Promise<ConsentRecord | null> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("consents").select("*").eq("id", consentId).maybeSingle();
    if (error) {
      console.error("Supabase getConsentById error:", error);
      throw new Error(`Failed to fetch consent ${consentId}: ${error.message}`);
    }
    return (data || null) as ConsentRecord | null;
  }
  return (await mockDb.getConsentById(consentId)) as ConsentRecord | null;
}
