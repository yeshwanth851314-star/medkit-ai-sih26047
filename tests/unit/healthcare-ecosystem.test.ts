import { describe, it, expect, beforeEach } from "vitest";
import { generatePreliminaryIntakeGuidance } from "@/features/guidance/intake-guidance-service";
import {
  bookAppointmentDb,
  getAppointmentsDb,
  checkInOpdQueueDb,
  getOpdQueueDb,
  transitionOpdQueueDb,
  createDiagnosticOrderDb,
  getDiagnosticOrdersDb,
  transitionDiagnosticOrderDb,
  submitDiagnosticResultDb,
  reviewDiagnosticOrderDb,
  createPrescriptionDb,
  getPrescriptionsDb,
  finalizePrescriptionDb,
  getPharmacyInventoryDb,
  dispenseMedicationDb,
} from "@/lib/db/supabase";
import { getPharmacyPrescriptionQueue } from "@/features/pharmacy/pharmacy-service";
import { resetEcosystemMockStore } from "@/lib/db/ecosystem-mock-store";
import { compareDiagnosticResults } from "@/features/diagnostics/diagnostic-service";
import { buildPatientTimeline } from "@/features/timeline/timeline-service";
import { DEMO_PATIENT_ID } from "@/lib/auth/demo-users";
import { AuthUser } from "@/features/auth/types";

describe("Healthcare Ecosystem Expansion — Unit & Invariant Test Suite", () => {
  const clinicianUser: AuthUser = {
    id: "doc-ananya",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Sharma",
    role: "doctor",
    facilityId: "fac-hyd-01",
    aal: "aal2",
  };

  const pharmacistUser: AuthUser = {
    id: "pharm-venkatesh",
    email: "pharmacy@medkit.ai",
    fullName: "Venkatesh Iyer",
    role: "pharmacist",
    facilityId: "fac-hyd-01",
    aal: "aal2",
  };

  const labTechUser: AuthUser = {
    id: "lab-ramesh",
    email: "diagnostics@medkit.ai",
    fullName: "Ramesh V",
    role: "diagnostic_staff",
    facilityId: "fac-hyd-01",
    aal: "aal2",
  };

  beforeEach(() => {
    resetEcosystemMockStore();
  });

  describe("1. Preliminary Intake Guidance Service", () => {
    it("assigns General Medicine for routine adult primary complaints", () => {
      const guidance = generatePreliminaryIntakeGuidance({
        chiefComplaint: "Mild headache and fatigue for 2 days",
      });
      expect(guidance.departmentCode).toBe("GEN_MED");
      expect(guidance.priority).toBe("Routine");
      expect(guidance.priorityLevel).toBe("ROUTINE");
    });

    it("assigns Kayachikitsa for Ayurvedic systemic cases", () => {
      const guidance = generatePreliminaryIntakeGuidance({
        chiefComplaint: "Digestive sluggishness (Agnimandya) and bloating",
        caseType: "ayush",
      });
      expect(guidance.departmentCode).toBe("KAYA_MED");
      expect(guidance.suggestedDoctorRole).toContain("Ayurvedic");
    });

    it("assigns Panchakarma for chronic stiffness and detoxification requests", () => {
      const guidance = generatePreliminaryIntakeGuidance({
        chiefComplaint: "Chronic back stiffness, seeking panchakarma detox",
      });
      expect(guidance.departmentCode).toBe("PANCHA");
    });

    it("elevates priority to Urgent Clinical Review when red flags or chest pain are present", () => {
      const guidance = generatePreliminaryIntakeGuidance({
        chiefComplaint: "Severe sudden chest pain radiating to left arm",
      });
      expect(guidance.priority).toBe("Urgent Clinical Review");
      expect(guidance.priorityLevel).toBe("EMERGENCY");
    });

    it("preserves non-autonomous safety boundary with explicit disclaimer", () => {
      const guidance = generatePreliminaryIntakeGuidance({
        chiefComplaint: "High grade fever",
      });
      expect(guidance.disclaimer).toBeDefined();
      expect(guidance.disclaimer).toContain("Non-diagnostic guidance");
    });
  });

  describe("2. Appointments & OPD Queue Workflow", () => {
    it("books appointment and retrieves by patient ID", async () => {
      const appt = await bookAppointmentDb({
        patientId: DEMO_PATIENT_ID,
        facilityId: "fac-hyd-01",
        departmentId: "dept-gen-01",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "General Consultation follow-up",
      });

      expect(appt.id).toBeDefined();
      expect(appt.status).toBe("BOOKED");

      const list = await getAppointmentsDb({ patientId: DEMO_PATIENT_ID });
      expect(list.some((a) => a.id === appt.id)).toBe(true);
    });

    it("issues sequential OPD queue token upon check-in", async () => {
      const appt = await bookAppointmentDb({
        patientId: DEMO_PATIENT_ID,
        facilityId: "fac-hyd-01",
        departmentId: "dept-gen-01",
        scheduledAt: new Date().toISOString(),
      });

      const queueEntry = await checkInOpdQueueDb(appt.id);
      expect(queueEntry.token_number).toBeGreaterThanOrEqual(101);
      expect(queueEntry.status).toBe("WAITING");

      // Verify appointment transitioned to CHECKED_IN
      const appts = await getAppointmentsDb({ patientId: DEMO_PATIENT_ID });
      const updatedAppt = appts.find((a) => a.id === appt.id);
      expect(updatedAppt?.status).toBe("CHECKED_IN");
    });

    it("transitions queue entry through WAITING -> CALLED -> IN_CONSULTATION -> DONE", async () => {
      const appt = await bookAppointmentDb({
        patientId: DEMO_PATIENT_ID,
        facilityId: "fac-hyd-01",
        departmentId: "dept-gen-01",
        scheduledAt: new Date().toISOString(),
      });
      const q = await checkInOpdQueueDb(appt.id);

      const called = await transitionOpdQueueDb(q.id, "CALLED");
      expect(called.status).toBe("CALLED");
      expect(called.called_at).toBeDefined();

      const inConsult = await transitionOpdQueueDb(q.id, "IN_CONSULTATION");
      expect(inConsult.status).toBe("IN_CONSULTATION");
      expect(inConsult.consultation_started_at).toBeDefined();

      const done = await transitionOpdQueueDb(q.id, "DONE");
      expect(done.status).toBe("DONE");
      expect(done.completed_at).toBeDefined();
    });
  });

  describe("3. Diagnostics Ordering, Results & Comparison", () => {
    it("creates a diagnostic order with catalog items and priority", async () => {
      const order = await createDiagnosticOrderDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        orderingClinicianId: clinicianUser.id,
        priority: "STAT",
        clinicalContext: "Patient presents with persistent fever and joint discomfort",
        items: [
          { testName: "Complete Blood Count (CBC)", testCode: "CBC", category: "pathology" },
          { testName: "Liver Function Test (LFT)", testCode: "LFT", category: "pathology" },
        ],
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe("ORDERED");
      expect(order.priority).toBe("STAT");
      expect(order.items).toHaveLength(2);
    });

    it("transitions diagnostic order through specimen accessioning to RESULT_AVAILABLE", async () => {
      const order = await createDiagnosticOrderDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        orderingClinicianId: clinicianUser.id,
        priority: "URGENT",
        items: [{ testName: "Complete Blood Count", testCode: "CBC" }],
      });

      const sampled = await transitionDiagnosticOrderDb(order.id, "SAMPLE_COLLECTED");
      expect(sampled.status).toBe("SAMPLE_COLLECTED");

      const inProg = await transitionDiagnosticOrderDb(order.id, "IN_PROGRESS");
      expect(inProg.status).toBe("IN_PROGRESS");

      // Submit result
      const result = await submitDiagnosticResultDb({
        orderItemId: order.items![0].id,
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        performedBy: "Ramesh V, Lab Tech",
        resultJson: {
          parameterName: "Hemoglobin",
          numericValue: 10.5,
          unit: "g/dL",
          referenceRangeLow: 12.0,
          referenceRangeHigh: 16.0,
          abnormalFlag: "LOW",
          finding: "Mild microcytic anemia pattern",
        },
      });

      expect(result.id).toBeDefined();

      // Order should automatically transition to RESULT_AVAILABLE
      const orders = await getDiagnosticOrdersDb({ patientId: DEMO_PATIENT_ID });
      const updatedOrder = orders.find((o) => o.id === order.id);
      expect(updatedOrder?.status).toBe("RESULT_AVAILABLE");
    });

    it("allows doctor to acknowledge and review lab result", async () => {
      const order = await createDiagnosticOrderDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        orderingClinicianId: clinicianUser.id,
        items: [{ testName: "Serum Creatinine", testCode: "KFT" }],
      });
      await submitDiagnosticResultDb({
        orderItemId: order.items![0].id,
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        performedBy: "Lab Tech",
        resultJson: { parameterName: "Creatinine", numericValue: 0.9 },
      });

      const reviewed = await reviewDiagnosticOrderDb(order.id, clinicianUser.id);
      expect(reviewed.status).toBe("REVIEWED");
      expect(reviewed.reviewed_at).toBeDefined();
      expect(reviewed.reviewed_by).toBe(clinicianUser.id);
    });

    it("objectively compares consecutive diagnostic results and computes numeric delta", () => {
      const delta = compareDiagnosticResults(
        {
          id: "res-curr",
          diagnostic_order_item_id: "item-1",
          patient_id: DEMO_PATIENT_ID,
          case_id: "case-2",
          result_json: { parameterName: "Hemoglobin", numericValue: 12.8, unit: "g/dL" },
          performed_by: "Tech A",
          performed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "res-prev",
          diagnostic_order_item_id: "item-1",
          patient_id: DEMO_PATIENT_ID,
          case_id: "case-1",
          result_json: { parameterName: "Hemoglobin", numericValue: 10.2, unit: "g/dL" },
          performed_by: "Tech B",
          performed_at: new Date(Date.now() - 604800000).toISOString(),
          created_at: new Date(Date.now() - 604800000).toISOString(),
          updated_at: new Date(Date.now() - 604800000).toISOString(),
        }
      );

      expect(delta.parameterName).toBe("Hemoglobin");
      expect(delta.previousValue).toBe(10.2);
      expect(delta.currentValue).toBe(12.8);
      expect(delta.deltaNumeric).toBeCloseTo(2.6);
      expect(delta.trend).toBe("INCREASED");
    });
  });

  describe("4. Prescriptions & Pharmacy Dispense Workflow (Strict Invariant)", () => {
    it("preserves strict pharmacy boundary: DRAFT prescriptions are NOT visible in pharmacy queue", async () => {
      // 1. Doctor authors DRAFT prescription
      const draftRx = await createPrescriptionDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        prescriberId: clinicianUser.id,
        notes: "Trial therapy for 5 days",
        items: [
          { medicineName: "Paracetamol 500mg", dose: "500mg", route: "Oral", frequency: "1-0-1", duration: "5 days", quantity: 10 },
        ],
      });

      expect(draftRx.status).toBe("DRAFT");

      // 2. Query pharmacy queue — DRAFT must NOT be returned!
      const pharmacyRxList = await getPharmacyPrescriptionQueue("fac-hyd-01");
      const foundInPharmacy = pharmacyRxList.some((p) => p.id === draftRx.id);
      expect(foundInPharmacy).toBe(false);

      // 3. Doctor finalizes prescription
      const finalRx = await finalizePrescriptionDb(draftRx.id, clinicianUser.id);
      expect(finalRx.status).toBe("FINAL");

      // 4. Query pharmacy queue again — now it MUST appear!
      const updatedPharmacyList = await getPharmacyPrescriptionQueue("fac-hyd-01");
      const foundAfterFinalize = updatedPharmacyList.some((p) => p.id === draftRx.id);
      expect(foundAfterFinalize).toBe(true);
    });

    it("dispenses medication, decrements inventory stock, and emits dispense records", async () => {
      // 1. Check initial inventory stock
      const initialInventory = await getPharmacyInventoryDb("fac-hyd-01");
      const paracetamolStock = initialInventory.find((i) => i.medicine_key === "paracetamol-650");
      expect(paracetamolStock).toBeDefined();
      const initialQty = paracetamolStock!.stock_quantity;

      // 2. Create and finalize prescription for 10 tablets of Paracetamol
      const rx = await createPrescriptionDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        prescriberId: clinicianUser.id,
        items: [
          { medicineName: "Paracetamol 500mg", dose: "500mg", route: "Oral", frequency: "TDS", duration: "3 days", quantity: 10 },
        ],
      });
      await finalizePrescriptionDb(rx.id, clinicianUser.id);

      // 3. Pharmacist dispenses 10 tablets
      const { dispenseEvent } = await dispenseMedicationDb({
        prescriptionId: rx.id,
        facilityId: "fac-hyd-01",
        dispensedBy: pharmacistUser.fullName,
        notes: "Dispensed with water intake advice",
        items: [
          {
            prescriptionItemId: rx.items![0].id,
            quantityDispensed: 10,
            batchNumber: "B-2026-99",
            expiryDate: "2027-10-31",
          },
        ],
      });

      expect(dispenseEvent.status).toBe("COMPLETE");
      expect(dispenseEvent.items).toHaveLength(1);

      // 4. Verify inventory stock was decremented
      const updatedInventory = await getPharmacyInventoryDb("fac-hyd-01");
      const updatedStock = updatedInventory.find((i) => i.medicine_key === "paracetamol-650");
      expect(updatedStock!.stock_quantity).toBe(initialQty - 10);

      // 5. Verify prescription status is now DISPENSED
      const rxs = await getPrescriptionsDb({ patientId: DEMO_PATIENT_ID });
      const updatedRx = rxs.find((p) => p.id === rx.id);
      expect(updatedRx?.status).toBe("DISPENSED");
    });
  });

  describe("5. Unified Patient Timeline Projection", () => {
    it("aggregates appointments, diagnostic orders, lab results, prescriptions, and dispense events into a unified timeline", async () => {
      // Seed a complete patient trajectory
      const appt = await bookAppointmentDb({
        patientId: DEMO_PATIENT_ID,
        facilityId: "fac-hyd-01",
        scheduledAt: new Date().toISOString(),
      });
      await checkInOpdQueueDb(appt.id);

      const order = await createDiagnosticOrderDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        orderingClinicianId: clinicianUser.id,
        items: [{ testName: "CBC", testCode: "CBC" }],
      });
      await submitDiagnosticResultDb({
        orderItemId: order.items![0].id,
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        performedBy: "Lab Tech",
        resultJson: { parameterName: "WBC", numericValue: 6500 },
      });

      const rx = await createPrescriptionDb({
        patientId: DEMO_PATIENT_ID,
        caseId: "case-2026-001",
        facilityId: "fac-hyd-01",
        prescriberId: clinicianUser.id,
        items: [{ medicineName: "Amoxicillin", dose: "500mg", route: "Oral", frequency: "TDS", duration: "5 days", quantity: 15 }],
      });
      await finalizePrescriptionDb(rx.id, clinicianUser.id);
      await dispenseMedicationDb({
        prescriptionId: rx.id,
        facilityId: "fac-hyd-01",
        dispensedBy: pharmacistUser.fullName,
        items: [{ prescriptionItemId: rx.items![0].id, quantityDispensed: 15 }],
      });

      // Build unified timeline
      const timeline = await buildPatientTimeline(DEMO_PATIENT_ID, clinicianUser);

      expect(timeline.length).toBeGreaterThanOrEqual(4);

      const eventTypes = timeline.map((m) => m.eventType);
      expect(eventTypes).toContain("appointment");
      expect(eventTypes).toContain("opd_checkin");
      expect(eventTypes).toContain("diagnostic_order");
      expect(eventTypes).toContain("diagnostic_result");
      expect(eventTypes).toContain("prescription");
      expect(eventTypes).toContain("dispense");
    });
  });
});
