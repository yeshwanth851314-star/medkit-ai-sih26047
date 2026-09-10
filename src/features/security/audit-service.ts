import { mockDb } from "../../lib/db/mock-adapter";
import { getAuthorizedSupabaseClient, getServiceSupabaseClient } from "../../lib/db/supabase";
import { env } from "@/config/env";
import { AuthUser } from "../auth/types";
import { AuditAction, ClinicalAuditLog, clinicalAuditSchema } from "./types";

/**
 * Critical clinical and legal audit actions that MUST be durably persisted
 * in production. If the durable storage write fails, these actions fail closed
 * and throw an error rather than silently degrading to transient memory.
 */
export const CRITICAL_AUDIT_ACTIONS = new Set<AuditAction>([
  "CONSENT_RECORDED",
  "CONSENT_REVOKED",
  "FINALIZE_CASE",
  "AMEND_CASE",
  "CONFIRM_DOCUMENT_OCR",
  "CONFIRM_SUMMARY",
  "ACKNOWLEDGE_RED_FLAG",
]);

/**
 * Record an immutable audit log entry.
 */
export async function logAuditEvent(params: {
  actorId: string;
  actorRole?: string;
  action: AuditAction;
  resourceType: "patients" | "cases" | "documents" | "auth" | "fhir" | "consents" | "transcripts" | "kiosk_instances" | "intake_sessions";
  resourceId: string;
  metadata?: Record<string, any>;
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null;
}): Promise<ClinicalAuditLog> {
  const entry: ClinicalAuditLog = {
    id: crypto.randomUUID(),
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    metadata: params.metadata || null,
    created_at: new Date().toISOString(),
  };

  const validated = clinicalAuditSchema.parse(entry);
  const isCritical = CRITICAL_AUDIT_ACTIONS.has(validated.action as AuditAction);

  if (!env.isDemoMode) {
    const supabase = getServiceSupabaseClient() || getAuthorizedSupabaseClient(params.actorOrToken);
    if (!supabase) {
      if (isCritical) {
        throw new Error(
          `CRITICAL_AUDIT_FAILURE: Durable audit store is unavailable in production for mandatory action '${validated.action}'. Refusing operation to preserve legal audit trail.`
        );
      }
      console.warn("Audit store unavailable in production for non-critical action, recording to fallback:", validated.action);
      mockDb.recordAudit(
        validated.actor_id,
        validated.action,
        validated.resource_type,
        validated.resource_id,
        validated.metadata || undefined
      );
      return validated as ClinicalAuditLog;
    }

    try {
      const { error } = await supabase.from("audit_logs").insert([
        {
          id: validated.id,
          actor_id: validated.actor_id,
          actor_role: validated.actor_role,
          action: validated.action,
          resource_type: validated.resource_type,
          resource_id: validated.resource_id,
          metadata: validated.metadata,
          created_at: validated.created_at,
        },
      ]);
      if (error) {
        console.error("Supabase audit log insert error:", error.message);
        if (isCritical) {
          throw new Error(
            `CRITICAL_AUDIT_FAILURE: Failed to persist mandatory clinical audit action '${validated.action}' to durable storage: ${error.message}`
          );
        }
        mockDb.recordAudit(
          validated.actor_id,
          validated.action,
          validated.resource_type,
          validated.resource_id,
          validated.metadata || undefined
        );
      }
    } catch (err: any) {
      if (isCritical) {
        throw err instanceof Error
          ? err
          : new Error(`CRITICAL_AUDIT_FAILURE: Exception persisting mandatory audit action '${validated.action}'.`);
      }
      console.warn("Audit persistence exception, using fallback for non-critical action:", err);
      mockDb.recordAudit(
        validated.actor_id,
        validated.action,
        validated.resource_type,
        validated.resource_id,
        validated.metadata || undefined
      );
    }
  } else {
    // In demo mode, in-memory mockDb provides an isolated mock audit trail
    mockDb.recordAudit(
      validated.actor_id,
      validated.action,
      validated.resource_type,
      validated.resource_id,
      validated.metadata || undefined
    );
  }

  return validated as ClinicalAuditLog;
}

/**
 * Query audit trail for a specific clinical resource
 */
export async function getAuditTrailForResource(
  resourceType: string,
  resourceId: string,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalAuditLog[]> {
  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (supabase && !env.isDemoMode) {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as ClinicalAuditLog[];
      }
    } catch (err) {
      console.warn("Failed to fetch audit logs from Supabase, falling back to mockDb:", err);
    }
  }

  const all = mockDb.getAuditLogs();
  return all
    .filter((log) => log.resource_type === resourceType && log.resource_id === resourceId)
    .map((log) => ({
      id: log.id,
      actor_id: log.actor_id || "system",
      action: log.action as AuditAction,
      resource_type: log.resource_type as any,
      resource_id: log.resource_id,
      metadata: log.metadata,
      created_at: log.created_at,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Query entire audit trail (for hospital compliance / administrators)
 */
export async function getAllAuditLogs(
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalAuditLog[]> {
  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (supabase && !env.isDemoMode) {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as ClinicalAuditLog[];
      }
    } catch (err) {
      console.warn("Failed to fetch all audit logs from Supabase, falling back to mockDb:", err);
    }
  }

  const all = mockDb.getAuditLogs();
  return all
    .map((log) => ({
      id: log.id,
      actor_id: log.actor_id || "system",
      action: log.action as AuditAction,
      resource_type: log.resource_type as any,
      resource_id: log.resource_id,
      metadata: log.metadata,
      created_at: log.created_at,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
