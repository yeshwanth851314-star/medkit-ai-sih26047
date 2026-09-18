import {
  getDepartmentsDb,
  getAppointmentSlotsDb,
  bookAppointmentDb,
  getAppointmentsDb,
  getAppointmentByIdDb,
} from "@/lib/db/supabase";
import { FacilityDepartment, AppointmentSlot, Appointment, AppointmentStatus } from "@/types/ecosystem";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";

export async function listFacilityDepartments(
  facilityId?: string,
  actorOrToken?: AuthUser | string | null
): Promise<FacilityDepartment[]> {
  return getDepartmentsDb(facilityId, actorOrToken);
}

export async function listAvailableSlots(
  facilityId: string,
  departmentId?: string,
  actorOrToken?: AuthUser | string | null
): Promise<AppointmentSlot[]> {
  return getAppointmentSlotsDb(facilityId, departmentId, actorOrToken);
}

export async function bookPatientAppointment(
  data: {
    patientId: string;
    facilityId: string;
    departmentId?: string | null;
    clinicianId?: string | null;
    slotId?: string | null;
    intakeCaseId?: string | null;
    scheduledAt: string;
    reason?: string | null;
    createdBy?: string | null;
  },
  actorOrToken?: AuthUser | string | null
): Promise<Appointment> {
  const appointment = await bookAppointmentDb(data, actorOrToken);

  await logAuditEvent({
    actorId: typeof actorOrToken === "object" ? actorOrToken?.id || "patient" : "patient",
    actorRole: typeof actorOrToken === "object" ? actorOrToken?.role || "patient" : "patient",
    action: "APPOINTMENT_BOOKED",
    resourceType: "appointments",
    resourceId: appointment.id,
    metadata: {
      patientId: data.patientId,
      facilityId: data.facilityId,
      departmentId: data.departmentId,
      scheduledAt: data.scheduledAt,
      intakeCaseId: data.intakeCaseId,
    },
    actorOrToken,
  });

  return appointment;
}

export async function listAppointments(
  params: { patientId?: string; facilityId?: string; status?: AppointmentStatus },
  actorOrToken?: AuthUser | string | null
): Promise<Appointment[]> {
  return getAppointmentsDb(params, actorOrToken);
}

export async function getAppointmentDetails(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<Appointment | null> {
  return getAppointmentByIdDb(id, actorOrToken);
}
