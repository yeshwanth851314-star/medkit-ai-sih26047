import { mockDb } from "../../lib/db/mock-adapter";
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

  // Store in database
  mockDb.recordAudit(
    validated.actor_id,
    validated.action,
    validated.resource_type,
    validated.resource_id,
    validated.metadata || undefined
  );

  return validated as ClinicalAuditLog;
}

/**
 * Query audit trail for a specific clinical resource
 */
export async function getAuditTrailForResource(
  resourceType: string,
  resourceId: string
): Promise<ClinicalAuditLog[]> {
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
