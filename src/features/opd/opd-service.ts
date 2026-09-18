import {
  checkInAppointmentDb,
  getOpdQueueDb,
  transitionOpdQueueDb,
  getAppointmentByIdDb,
} from "@/lib/db/supabase";
import { OpdQueueEntry, OpdQueueStatus, Appointment } from "@/types/ecosystem";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";
import { AuditAction } from "@/features/security/types";

export async function checkInPatientToOpd(
  appointmentId: string,
  actorOrToken?: AuthUser | string | null
): Promise<{ appointment: Appointment; queueEntry: OpdQueueEntry }> {
  const result = await checkInAppointmentDb(appointmentId, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || "reception" : "reception";
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "staff" : "staff";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "PATIENT_CHECKED_IN",
    resourceType: "appointments",
    resourceId: appointmentId,
    metadata: {
      patientId: result.appointment.patient_id,
      tokenNumber: result.queueEntry.token_number,
      facilityId: result.appointment.facility_id,
    },
    actorOrToken,
  });

  await logAuditEvent({
    actorId,
    actorRole,
    action: "QUEUE_ENTRY_CREATED",
    resourceType: "opd_queues",
    resourceId: result.queueEntry.id,
    metadata: {
      tokenNumber: result.queueEntry.token_number,
      appointmentId,
      facilityId: result.queueEntry.facility_id,
    },
    actorOrToken,
  });

  return result;
}

export async function fetchOpdQueue(
  facilityId: string,
  status?: OpdQueueStatus,
  actorOrToken?: AuthUser | string | null
): Promise<OpdQueueEntry[]> {
  return getOpdQueueDb(facilityId, status, actorOrToken);
}

export async function transitionQueueStatus(
  id: string,
  targetStatus: OpdQueueStatus,
  actorOrToken?: AuthUser | string | null
): Promise<OpdQueueEntry> {
  const entry = await transitionOpdQueueDb(id, targetStatus, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || "clinician" : "clinician";
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor";

  let auditAction: AuditAction = "QUEUE_STATUS_UPDATED";
  if (targetStatus === "CALLED") auditAction = "QUEUE_CALLED";
  if (targetStatus === "IN_CONSULTATION") auditAction = "CONSULTATION_STARTED";
  if (targetStatus === "DONE") auditAction = "CONSULTATION_COMPLETED";

  await logAuditEvent({
    actorId,
    actorRole,
    action: auditAction,
    resourceType: "opd_queues",
    resourceId: id,
    metadata: {
      tokenNumber: entry.token_number,
      targetStatus,
      patientId: entry.patient_id,
      facilityId: entry.facility_id,
    },
    actorOrToken,
  });

  return entry;
}
