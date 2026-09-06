import { mockDb } from "../../lib/db/mock-adapter";
import { getSupabaseClient } from "../../lib/db/supabase";
import { env } from "@/config/env";
import { AuditAction, ClinicalAuditLog, clinicalAuditSchema } from "./types";

/**
 * Record an immutable audit log entry.
 */
export async function logAuditEvent(params: {
  actorId: string;
  actorRole?: string;
  action: AuditAction;
  resourceType: "patients" | "cases" | "documents" | "auth" | "fhir" | "consents" | "transcripts";
  resourceId: string;
  metadata?: Record<string, any>;
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

  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
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
        console.warn("Supabase audit log insert error, falling back to mockDb:", error.message);
        mockDb.recordAudit(
          validated.actor_id,
          validated.action,
          validated.resource_type,
          validated.resource_id,
          validated.metadata || undefined
        );
      }
    } catch (err) {
      console.warn("Audit persistence exception, using mockDb:", err);
      mockDb.recordAudit(
        validated.actor_id,
        validated.action,
        validated.resource_type,
        validated.resource_id,
        validated.metadata || undefined
      );
    }
  } else {
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
  resourceId: string
): Promise<ClinicalAuditLog[]> {
  const supabase = getSupabaseClient();
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
export async function getAllAuditLogs(): Promise<ClinicalAuditLog[]> {
  const supabase = getSupabaseClient();
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
