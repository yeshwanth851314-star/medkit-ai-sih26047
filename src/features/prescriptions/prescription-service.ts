import {
  createDraftPrescriptionDb,
  finalizePrescriptionDb,
  getPrescriptionsDb,
  getPrescriptionByIdDb,
} from "@/lib/db/supabase";
import { Prescription, PrescriptionStatus } from "@/types/ecosystem";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";

export async function createDraftPrescription(
  data: {
    patientId: string;
    caseId: string;
    facilityId: string;
    prescriberId: string;
    notes?: string | null;
    items: Array<{
      medicineName: string;
      genericName?: string | null;
      strength?: string | null;
      route?: string;
      dose: string;
      frequency: string;
      duration: string;
      quantity?: number;
      instructions?: string | null;
    }>;
  },
  actorOrToken?: AuthUser | string | null
): Promise<Prescription> {
  const rx = await createDraftPrescriptionDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.prescriberId : data.prescriberId;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "PRESCRIPTION_CREATED",
    resourceType: "prescriptions",
    resourceId: rx.id,
    metadata: {
      patientId: data.patientId,
      caseId: data.caseId,
      facilityId: data.facilityId,
      itemCount: data.items.length,
      status: "DRAFT",
    },
    actorOrToken,
  });

  return rx;
}

export async function approveAndFinalizePrescription(
  id: string,
  finalizedBy: string,
  actorOrToken?: AuthUser | string | null
): Promise<Prescription> {
  const rx = await finalizePrescriptionDb(id, finalizedBy, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || finalizedBy : finalizedBy;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "PRESCRIPTION_FINALIZED",
    resourceType: "prescriptions",
    resourceId: id,
    metadata: {
      patientId: rx.patient_id,
      caseId: rx.case_id,
      facilityId: rx.facility_id,
      itemCount: rx.items?.length || 0,
      status: "FINAL",
    },
    actorOrToken,
  });

  return rx;
}

export async function listPrescriptions(
  params: {
    patientId?: string;
    caseId?: string;
    facilityId?: string;
    status?: PrescriptionStatus;
    onlyFinalOrDispensed?: boolean;
  },
  actorOrToken?: AuthUser | string | null
): Promise<Prescription[]> {
  return getPrescriptionsDb(params, actorOrToken);
}

export async function getPrescriptionDetails(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<Prescription | null> {
  return getPrescriptionByIdDb(id, actorOrToken);
}
