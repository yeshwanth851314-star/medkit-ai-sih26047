import { env } from "@/config/env";
import {
  getAuthorizedSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";
import { logAuditEvent } from "@/features/security/audit-service";
import { ConsentRecord, RecordConsentInput, consentRecordSchema } from "./types";
import { AuthUser } from "@/features/auth/types";

/**
 * Persist patient clinical case-taking consent.
 * Every case intake MUST be tied to an explicit consent record.
 */
export async function recordPatientConsent(input: RecordConsentInput): Promise<ConsentRecord> {
  if (!env.isDemoMode) {
    const supabase = getAuthorizedSupabaseClient(input.actorOrToken) || getServiceSupabaseClient();
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
    }
    const { data, error } = await supabase.rpc("rpc_record_consent_with_audit", {
      p_patient_id: input.patientId,
      p_purpose: input.purpose || "clinical_care_and_case_taking",
      p_scope: input.scope || ["voice_recording", "document_extraction", "ai_summary"],
      p_language: input.language || "en",
      p_method: input.consentMethod || "touch_acknowledgement",
      p_version: input.consentVersion || "v1.0",
    });
    if (error) {
      console.error("Supabase rpc_record_consent_with_audit error:", error);
      throw new Error(`Failed to persist clinical consent: ${error.message}`);
    }
    return data as ConsentRecord;
  }

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
    status: "granted",
    granted_at: now,
    actor_id: input.actorId || input.patientId,
    revocation_reason: null,
    revoked: false,
    revoked_at: null,
    created_at: now,
  };

  const validated = consentRecordSchema.parse(record);
  await mockDb.recordConsent(validated);

  // Record immutable audit event in demo mode
  try {
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
  } catch (auditErr) {
    mockDb.revokeConsent(validated.id, "Audit logging failed");
    throw auditErr;
  }

  return validated;
}

/**
 * Verify that a patient has an active, non-revoked consent record.
 */
export async function verifyPatientConsent(
  patientId: string,
  requiredScope?: "voice_recording" | "document_extraction" | "ai_summary",
  actorOrToken?: AuthUser | string | null
): Promise<{ valid: boolean; consent?: ConsentRecord; reason?: string }> {
  let consent: ConsentRecord | null = null;

  if (!env.isDemoMode) {
    const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
    }
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

  if (requiredScope && (!consent.scope || !consent.scope.includes(requiredScope))) {
    return {
      valid: false,
      consent,
      reason: `Patient clinical consent does not permit '${requiredScope}'.`,
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
  reason?: string,
  actorOrToken?: AuthUser | string | null
): Promise<ConsentRecord> {
  if (!env.isDemoMode) {
    const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
    }
    const { data, error } = await supabase.rpc("rpc_revoke_consent_with_audit", {
      p_consent_id: consentId,
      p_reason: reason || "Revoked by clinician",
    });
    if (error) {
      console.error("Supabase rpc_revoke_consent_with_audit error:", error);
      throw new Error(`Failed to revoke clinical consent: ${error.message}`);
    }
    return data as ConsentRecord;
  }

  const callerRole = typeof actorOrToken === "object" ? actorOrToken?.role : undefined;
  const callerFacility = typeof actorOrToken === "object" ? actorOrToken?.facilityId || undefined : undefined;
  const updated = (await mockDb.revokeConsent(consentId, actorId, reason, callerRole, callerFacility)) as ConsentRecord | null;
  if (!updated) {
    throw new Error(`Consent record '${consentId}' not found.`);
  }

  // Audit revocation in demo mode
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
export async function getConsentById(
  consentId: string,
  actorOrToken?: AuthUser | string | null
): Promise<ConsentRecord | null> {
  if (!env.isDemoMode) {
    const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
    }
    const { data, error } = await supabase.from("consents").select("*").eq("id", consentId).maybeSingle();
    if (error) {
      console.error("Supabase getConsentById error:", error);
      throw new Error(`Failed to fetch consent ${consentId}: ${error.message}`);
    }
    return (data || null) as ConsentRecord | null;
  }
  return (await mockDb.getConsentById(consentId)) as ConsentRecord | null;
}
