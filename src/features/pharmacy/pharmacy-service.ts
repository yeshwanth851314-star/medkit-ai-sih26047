import {
  getPrescriptionsDb,
  getPharmacyInventoryDb,
  updatePharmacyStockDb,
  dispenseMedicationDb,
  raisePrescriptionClarificationDb,
  resolvePrescriptionClarificationDb,
  getDispenseEventsByPatientDb,
} from "@/lib/db/supabase";
import {
  Prescription,
  PharmacyInventoryItem,
  DispenseEvent,
  PrescriptionClarification,
} from "@/types/ecosystem";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";

export async function getPharmacyPrescriptionQueue(
  facilityId: string,
  actorOrToken?: AuthUser | string | null
): Promise<Prescription[]> {
  // Pharmacy can strictly inspect ONLY FINAL or PARTIALLY_DISPENSED prescriptions
  return getPrescriptionsDb(
    { facilityId, onlyFinalOrDispensed: true },
    actorOrToken
  );
}

export async function fetchPharmacyInventory(
  facilityId: string,
  actorOrToken?: AuthUser | string | null
): Promise<PharmacyInventoryItem[]> {
  return getPharmacyInventoryDb(facilityId, actorOrToken);
}

export async function dispensePrescription(
  data: {
    prescriptionId: string;
    facilityId: string;
    dispensedBy: string;
    notes?: string | null;
    items: Array<{
      prescriptionItemId: string;
      quantityDispensed: number;
      batchNumber?: string | null;
      expiryDate?: string | null;
    }>;
  },
  actorOrToken?: AuthUser | string | null
): Promise<{ dispenseEvent: DispenseEvent; prescription: Prescription }> {
  const result = await dispenseMedicationDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.dispensedBy : data.dispensedBy;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "pharmacist" : "pharmacist";

  const isPartial = result.dispenseEvent.status === "PARTIAL";
  const actionName = isPartial ? "MEDICINE_PARTIALLY_DISPENSED" : "MEDICINE_DISPENSED";

  await logAuditEvent({
    actorId,
    actorRole,
    action: actionName,
    resourceType: "dispenses",
    resourceId: result.dispenseEvent.id,
    metadata: {
      prescriptionId: data.prescriptionId,
      facilityId: data.facilityId,
      itemCount: data.items.length,
      status: result.dispenseEvent.status,
    },
    actorOrToken,
  });

  await logAuditEvent({
    actorId,
    actorRole,
    action: "DISPENSE_CONFIRMED",
    resourceType: "prescriptions",
    resourceId: data.prescriptionId,
    metadata: {
      dispenseEventId: result.dispenseEvent.id,
      patientId: result.dispenseEvent.patient_id,
    },
    actorOrToken,
  });

  return result;
}

export async function raiseClarification(
  data: {
    prescriptionId: string;
    raisedBy: string;
    reason: string;
  },
  actorOrToken?: AuthUser | string | null
): Promise<PrescriptionClarification> {
  const clarification = await raisePrescriptionClarificationDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.raisedBy : data.raisedBy;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "pharmacist" : "pharmacist";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "PHARMACY_CLARIFICATION_RAISED",
    resourceType: "prescriptions",
    resourceId: data.prescriptionId,
    metadata: {
      clarificationId: clarification.id,
      reason: data.reason,
    },
    actorOrToken,
  });

  return clarification;
}

export async function resolveClarification(
  data: {
    clarificationId: string;
    responseBy: string;
    responseText: string;
  },
  actorOrToken?: AuthUser | string | null
): Promise<PrescriptionClarification> {
  const clarification = await resolvePrescriptionClarificationDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.responseBy : data.responseBy;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "PHARMACY_CLARIFICATION_RESOLVED",
    resourceType: "prescriptions",
    resourceId: clarification.prescription_id,
    metadata: {
      clarificationId: clarification.id,
      response: data.responseText,
    },
    actorOrToken,
  });

  return clarification;
}

export async function getPatientDispenseHistory(
  patientId: string,
  actorOrToken?: AuthUser | string | null
): Promise<DispenseEvent[]> {
  return getDispenseEventsByPatientDb(patientId, actorOrToken);
}

export async function updatePharmacyInventoryStock(
  itemId: string,
  stockQuantity: number,
  actorOrToken?: AuthUser | string | null
): Promise<PharmacyInventoryItem | null> {
  return updatePharmacyStockDb(itemId, stockQuantity, actorOrToken);
}
