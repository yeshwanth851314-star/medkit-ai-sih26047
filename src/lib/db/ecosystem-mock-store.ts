import crypto from "node:crypto";
import {
  FacilityDepartment,
  AppointmentSlot,
  Appointment,
  OpdQueueEntry,
  DiagnosticCatalogItem,
  DiagnosticOrder,
  DiagnosticOrderItem,
  DiagnosticResult,
  Prescription,
  PrescriptionItem,
  PrescriptionClarification,
  PharmacyInventoryItem,
  DispenseEvent,
  DispenseItem,
  AppointmentStatus,
  OpdQueueStatus,
  DiagnosticOrderStatus,
  PrescriptionStatus,
} from "@/types/ecosystem";

class EcosystemMockStore {
  private departments: Map<string, FacilityDepartment> = new Map();
  private slots: Map<string, AppointmentSlot> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private opdQueue: Map<string, OpdQueueEntry> = new Map();
  private diagnosticCatalog: Map<string, DiagnosticCatalogItem> = new Map();
  private diagnosticOrders: Map<string, DiagnosticOrder> = new Map();
  private diagnosticOrderItems: Map<string, DiagnosticOrderItem> = new Map();
  private diagnosticResults: Map<string, DiagnosticResult> = new Map();
  private prescriptions: Map<string, Prescription> = new Map();
  private prescriptionItems: Map<string, PrescriptionItem> = new Map();
  private prescriptionClarifications: Map<string, PrescriptionClarification> = new Map();
  private pharmacyInventory: Map<string, PharmacyInventoryItem> = new Map();
  private dispenseEvents: Map<string, DispenseEvent> = new Map();
  private dispenseItems: Map<string, DispenseItem> = new Map();

  private nextTokenNumber = 101;
  private isInitialized = false;

  constructor() {
    this.seedFixtures();
  }

  public seedFixtures() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const now = new Date().toISOString();
    const facilityId = "fac-hyd-01";

    // 1. Seed Departments
    const deptList: Array<Omit<FacilityDepartment, "id" | "created_at" | "updated_at">> = [
      {
        facility_id: facilityId,
        name: "General Medicine",
        code: "GEN_MED",
        description: "Primary clinical intake and general outpatient consultations",
        active: true,
      },
      {
        facility_id: facilityId,
        name: "Kayachikitsa (Internal Medicine)",
        code: "KAYA_MED",
        description: "Holistic Ayurvedic systemic therapeutics and metabolic care",
        active: true,
      },
      {
        facility_id: facilityId,
        name: "Panchakarma",
        code: "PANCHA",
        description: "Purificatory and rejuvenative bio-cleansing therapies",
        active: true,
      },
      {
        facility_id: facilityId,
        name: "Pediatrics (Kaumarbhritya)",
        code: "PEDIATRICS",
        description: "Child health, growth monitoring, and developmental care",
        active: true,
      },
      {
        facility_id: facilityId,
        name: "Shalya Tantra (Surgery & Wound Care)",
        code: "SURGERY",
        description: "Surgical evaluation, kshara sutra, and wound healing management",
        active: true,
      },
    ];

    const seededDepts: FacilityDepartment[] = [];
    for (const d of deptList) {
      const id = `dept-${d.code.toLowerCase()}`;
      const dept: FacilityDepartment = {
        ...d,
        id,
        created_at: now,
        updated_at: now,
      };
      this.departments.set(id, dept);
      seededDepts.push(dept);
    }

    // 2. Seed Appointment Slots (Available slots for today and tomorrow)
    const baseDate = new Date();
    for (const dept of seededDepts) {
      for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
        for (let hour = 9; hour < 17; hour += 2) {
          const slotStart = new Date(baseDate);
          slotStart.setDate(slotStart.getDate() + dayOffset);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setHours(hour + 1, 30, 0, 0);

          const slotId = `slot-${dept.code.toLowerCase()}-d${dayOffset}-h${hour}`;
          this.slots.set(slotId, {
            id: slotId,
            facility_id: facilityId,
            department_id: dept.id,
            clinician_id: "usr-doc-0001",
            starts_at: slotStart.toISOString(),
            ends_at: slotEnd.toISOString(),
            capacity: 5,
            booked_count: 0,
            status: "available",
            created_at: now,
          });
        }
      }
    }

    // 3. Seed Diagnostic Catalog
    const catalogList: Array<Omit<DiagnosticCatalogItem, "id" | "created_at">> = [
      {
        facility_id: null, // National standard
        code: "CBC",
        name: "Complete Blood Count (CBC) with Automated Differential",
        category: "pathology",
        description: "Hemoglobin, TLC, DLC, Platelet count, RBC indices and peripheral smear",
        turnaround_hours: 4,
        active: true,
      },
      {
        facility_id: null,
        code: "LFT",
        name: "Liver Function Test (LFT)",
        category: "pathology",
        description: "Bilirubin (Total/Direct), SGOT, SGPT, ALP, Total Protein, Albumin",
        turnaround_hours: 8,
        active: true,
      },
      {
        facility_id: null,
        code: "KFT",
        name: "Kidney Function Test (KFT / RFT)",
        category: "pathology",
        description: "Blood Urea Nitrogen (BUN), Serum Creatinine, Uric Acid, Electrolytes",
        turnaround_hours: 8,
        active: true,
      },
      {
        facility_id: null,
        code: "LIPID",
        name: "Lipid Profile Panel",
        category: "pathology",
        description: "Total Cholesterol, Triglycerides, HDL, LDL, VLDL",
        turnaround_hours: 8,
        active: true,
      },
      {
        facility_id: null,
        code: "URINE_RE",
        name: "Urine Routine & Microscopic Examination",
        category: "pathology",
        description: "Physical, chemical (sugar, albumin), and microscopic examination",
        turnaround_hours: 2,
        active: true,
      },
      {
        facility_id: null,
        code: "XRAY_CHEST",
        name: "Chest X-Ray (PA View)",
        category: "radiology",
        description: "Digital radiograph of the chest for lung fields and cardiac silhouette",
        turnaround_hours: 2,
        active: true,
      },
      {
        facility_id: null,
        code: "ECG",
        name: "12-Lead Electrocardiogram",
        category: "cardiology",
        description: "Standard 12-lead resting electrocardiogram with rhythm analysis",
        turnaround_hours: 1,
        active: true,
      },
      {
        facility_id: null,
        code: "PRAKRITI_PARIKSHA",
        name: "Comprehensive Ayush Doshic & Agni Assessment",
        category: "ayush_pariksha",
        description: "Standardized evaluation of Prakriti, Vikriti, Agni, and Koshtha",
        turnaround_hours: 2,
        active: true,
      },
    ];

    for (const c of catalogList) {
      const id = `diag-${c.code.toLowerCase()}`;
      this.diagnosticCatalog.set(id, {
        ...c,
        id,
        created_at: now,
      });
    }

    // 4. Seed Pharmacy Inventory
    const inventoryList: Array<Omit<PharmacyInventoryItem, "id" | "created_at" | "updated_at">> = [
      {
        facility_id: facilityId,
        medicine_key: "paracetamol-650",
        medicine_name: "Paracetamol Tablet IP",
        generic_name: "Paracetamol",
        strength: "650 mg",
        stock_quantity: 350,
        batch_number: "PCM-2026-B01",
        expiry_date: "2028-06-30",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "amoxicillin-500",
        medicine_name: "Amoxicillin Trihydrate Capsule",
        generic_name: "Amoxicillin",
        strength: "500 mg",
        stock_quantity: 180,
        batch_number: "AMX-2026-B08",
        expiry_date: "2027-12-31",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "metformin-500",
        medicine_name: "Metformin Hydrochloride Tablet",
        generic_name: "Metformin",
        strength: "500 mg",
        stock_quantity: 240,
        batch_number: "MET-2026-B04",
        expiry_date: "2027-11-30",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "cetirizine-10",
        medicine_name: "Cetirizine Hydrochloride Tablet",
        generic_name: "Cetirizine",
        strength: "10 mg",
        stock_quantity: 140,
        batch_number: "CTZ-2026-B03",
        expiry_date: "2027-09-30",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "pantoprazole-40",
        medicine_name: "Pantoprazole Gastro-Resistant Tablet",
        generic_name: "Pantoprazole",
        strength: "40 mg",
        stock_quantity: 200,
        batch_number: "PAN-2026-B05",
        expiry_date: "2027-10-31",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "ashwagandha-churna",
        medicine_name: "Ashwagandha Churna (Withania Somnifera)",
        generic_name: "Ashwagandha Powder",
        strength: "100 g",
        stock_quantity: 85,
        batch_number: "ASH-2026-B11",
        expiry_date: "2028-01-31",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "triphala-tablets",
        medicine_name: "Triphala Ghanvati Tablets",
        generic_name: "Triphala Extract",
        strength: "500 mg",
        stock_quantity: 110,
        batch_number: "TRP-2026-B02",
        expiry_date: "2028-03-31",
        active: true,
      },
      {
        facility_id: facilityId,
        medicine_key: "sudarshana-ghanvati",
        medicine_name: "Maha Sudarshana Ghanvati",
        generic_name: "Polyherbal Antipyretic",
        strength: "250 mg",
        stock_quantity: 95,
        batch_number: "SUD-2026-B07",
        expiry_date: "2028-05-31",
        active: true,
      },
    ];

    for (const inv of inventoryList) {
      const id = `inv-${inv.medicine_key}`;
      this.pharmacyInventory.set(id, {
        ...inv,
        id,
        created_at: now,
        updated_at: now,
      });
    }

    // 5. Seed initial appointment & OPD Queue entry for demo patient
    const demoPatientId = "11111111-1111-4111-8111-111111111111";
    const demoApptId = "appt-demo-1001";
    const apptScheduled = new Date(Date.now() + 3600000).toISOString();
    const demoDept = this.departments.get("dept-gen_med") || seededDepts[0];

    const demoAppt: Appointment = {
      id: demoApptId,
      patient_id: demoPatientId,
      facility_id: facilityId,
      department_id: demoDept ? demoDept.id : "dept-gen_med",
      clinician_id: "usr-doc-0001",
      scheduled_at: apptScheduled,
      status: "CHECKED_IN",
      reason: "Chronic cough, evening fatigue and seasonal joint stiffness",
      created_by: "patient",
      created_at: now,
      updated_at: now,
      department: demoDept,
    };
    this.appointments.set(demoApptId, demoAppt);

    const demoQueueId = "queue-demo-101";
    const demoQueueEntry: OpdQueueEntry = {
      id: demoQueueId,
      appointment_id: demoApptId,
      patient_id: demoPatientId,
      facility_id: facilityId,
      department_id: demoDept ? demoDept.id : "dept-gen_med",
      clinician_id: "usr-doc-0001",
      token_number: 101,
      status: "WAITING",
      checked_in_at: now,
      created_at: now,
      updated_at: now,
      department_name: demoDept ? demoDept.name : "General Medicine",
    };
    this.opdQueue.set(demoQueueId, demoQueueEntry);

    // 6. Seed initial 1-time verified prescription with QR code metadata
    const demoRxId = "rx-demo-7741";
    const demoRx: Prescription = {
      id: demoRxId,
      facility_id: facilityId,
      patient_id: demoPatientId,
      case_id: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
      prescriber_id: "usr-doc-0001",
      prescriber_name: "Dr. Ananya Rao, MD",
      prescription_number: "RX-AIIA-2026-9042",
      status: "FINAL",
      notes: "Take Maha Sudarshana with lukewarm water after food. Avoid cold and heavy sour foods.",
      ayush_dietary_advice: "Warm water (Ushnodaka) and light nutritious diet.",
      finalized_at: now,
      finalized_by: "Dr. Ananya Rao, MD",
      created_at: now,
      updated_at: now,
      items: [],
      clarifications: [],
    };

    const item1: PrescriptionItem = {
      id: "rx-item-1",
      prescription_id: demoRxId,
      medicine_name: "Maha Sudarshana Ghanvati",
      generic_name: "Polyherbal Antipyretic",
      strength: "250 mg",
      dose: "1 Tablet",
      frequency: "Twice daily (BD)",
      duration: "7 days",
      instructions: "After food with lukewarm water",
      route: "oral",
      anupana: "Ushnodaka (Lukewarm water)",
      quantity: 14,
      dispensed_quantity: 0,
      created_at: now,
    };
    const item2: PrescriptionItem = {
      id: "rx-item-2",
      prescription_id: demoRxId,
      medicine_name: "Ashwagandha Churna",
      generic_name: "Withania Somnifera Powder",
      strength: "100 g",
      dose: "3 grams (1/2 tsp)",
      frequency: "Once daily at bedtime (HS)",
      duration: "14 days",
      instructions: "Mix with warm milk before sleep",
      route: "oral",
      anupana: "Warm milk / Ksheera",
      quantity: 1,
      dispensed_quantity: 0,
      created_at: now,
    };
    const item3: PrescriptionItem = {
      id: "rx-item-3",
      prescription_id: demoRxId,
      medicine_name: "Paracetamol Tablet IP",
      generic_name: "Paracetamol",
      strength: "650 mg",
      dose: "1 Tablet (SOS)",
      frequency: "As needed, minimum 6 hrs apart",
      duration: "3 days",
      instructions: "Only in case of temperature > 100°F",
      route: "oral",
      quantity: 6,
      dispensed_quantity: 0,
      created_at: now,
    };
    demoRx.items = [item1, item2, item3];
    this.prescriptionItems.set(item1.id, item1);
    this.prescriptionItems.set(item2.id, item2);
    this.prescriptionItems.set(item3.id, item3);
    this.prescriptions.set(demoRxId, demoRx);

    // 7. Seed initial diagnostic orders and reports (CBC, Chest X-Ray)
    const demoDiagId = "diag-demo-4092";
    const demoDiagOrder: DiagnosticOrder = {
      id: demoDiagId,
      patient_id: demoPatientId,
      case_id: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
      facility_id: facilityId,
      ordering_clinician_id: "usr-doc-0001",
      priority: "ROUTINE",
      clinical_context: "Evaluate persistent dry cough and post-febrile fatigue.",
      status: "RESULT_AVAILABLE",
      ordered_at: now,
      created_at: now,
      updated_at: now,
      items: [
        {
          id: "diag-item-cbc",
          diagnostic_order_id: demoDiagId,
          diagnostic_catalog_id: "diag-cbc",
          test_name_snapshot: "Complete Blood Count (CBC) with Automated Differential",
          test_code_snapshot: "CBC",
          status: "RESULT_AVAILABLE",
          created_at: now,
        },
        {
          id: "diag-item-xray",
          diagnostic_order_id: demoDiagId,
          diagnostic_catalog_id: "diag-xray_chest",
          test_name_snapshot: "Chest X-Ray (PA View)",
          test_code_snapshot: "XRAY_CHEST",
          status: "RESULT_AVAILABLE",
          created_at: now,
        },
      ],
      results: [
        {
          id: "res-demo-cbc",
          diagnostic_order_item_id: "diag-item-cbc",
          patient_id: demoPatientId,
          case_id: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
          result_json: {
            hemoglobin: { label: "Hemoglobin (Hb)", value: "13.8", unit: "g/dL", ref_low: "12.0", ref_high: "16.0", flag: "NORMAL" },
            wbc: { label: "Total Leukocyte Count (TLC)", value: "7,400", unit: "/mcL", ref_low: "4,000", ref_high: "11,000", flag: "NORMAL" },
            platelets: { label: "Platelet Count", value: "2.4", unit: "Lakhs/mcL", ref_low: "1.5", ref_high: "4.5", flag: "NORMAL" },
            esr: { label: "Erythrocyte Sedimentation Rate", value: "14", unit: "mm/hr", ref_low: "0", ref_high: "20", flag: "NORMAL" },
          },
          finding: "Hemogram parameters within healthy physiological limits. No evidence of active leukocytosis.",
          performed_by: "Ramesh V., Senior MLT",
          verified_by: "Vikram Das, Chief Lab Technologist (NABL)",
          performed_at: now,
          verified_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          id: "res-demo-xray",
          diagnostic_order_item_id: "diag-item-xray",
          patient_id: demoPatientId,
          case_id: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
          result_json: {
            lung_fields: { label: "Bilateral Lung Fields", value: "Clear", unit: "", flag: "NORMAL" },
            cardiac_silhouette: { label: "Cardiothoracic Ratio", value: "< 0.50", unit: "", flag: "NORMAL" },
            costophrenic_angles: { label: "CP Angles", value: "Sharp & Clear", unit: "", flag: "NORMAL" },
            impression: { label: "Radiological Impression", value: "Normal Chest Radiograph", unit: "", flag: "NORMAL" },
          },
          finding: "No focal consolidation, pneumothorax, or pleural effusion visualized. Normal cardiac apex.",
          performed_by: "Ramesh V., Radiographer",
          verified_by: "Dr. Sandeep Verma, Consultant Radiologist",
          performed_at: now,
          verified_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    };
    this.diagnosticOrders.set(demoDiagId, demoDiagOrder);
    for (const item of demoDiagOrder.items!) {
      this.diagnosticOrderItems.set(item.id, item);
    }
    for (const res of demoDiagOrder.results!) {
      this.diagnosticResults.set(res.id, res);
    }
  }

  public reset(): void {
    this.departments.clear();
    this.slots.clear();
    this.appointments.clear();
    this.opdQueue.clear();
    this.diagnosticCatalog.clear();
    this.diagnosticOrders.clear();
    this.diagnosticOrderItems.clear();
    this.diagnosticResults.clear();
    this.prescriptions.clear();
    this.prescriptionItems.clear();
    this.prescriptionClarifications.clear();
    this.pharmacyInventory.clear();
    this.dispenseEvents.clear();
    this.dispenseItems.clear();
    this.nextTokenNumber = 101;
    this.isInitialized = false;
    this.seedFixtures();
  }

  // ─── Departments & Slots ──────────────────────────────────────────────────
  getDepartments(facilityId?: string): FacilityDepartment[] {
    const list = Array.from(this.departments.values());
    if (!facilityId) return list;
    return list.filter((d) => d.facility_id === facilityId && d.active);
  }

  getDepartmentById(id: string): FacilityDepartment | null {
    return this.departments.get(id) || null;
  }

  getSlots(facilityId: string, departmentId?: string): AppointmentSlot[] {
    let list = Array.from(this.slots.values()).filter(
      (s) => s.facility_id === facilityId && s.status === "available"
    );
    if (departmentId) {
      list = list.filter((s) => s.department_id === departmentId);
    }
    return list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  // ─── Appointments ─────────────────────────────────────────────────────────
  bookAppointment(data: {
    patientId: string;
    facilityId: string;
    departmentId?: string | null;
    clinicianId?: string | null;
    slotId?: string | null;
    intakeCaseId?: string | null;
    scheduledAt: string;
    reason?: string | null;
    createdBy?: string | null;
  }): Appointment {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    let dept = data.departmentId ? this.departments.get(data.departmentId) || null : null;

    // Increment slot booked count if slotId specified
    if (data.slotId) {
      const slot = this.slots.get(data.slotId);
      if (slot) {
        slot.booked_count += 1;
        if (slot.booked_count >= slot.capacity) {
          slot.status = "booked";
        }
      }
    }

    const appointment: Appointment = {
      id,
      patient_id: data.patientId,
      facility_id: data.facilityId,
      department_id: data.departmentId || null,
      clinician_id: data.clinicianId || null,
      slot_id: data.slotId || null,
      intake_case_id: data.intakeCaseId || null,
      scheduled_at: data.scheduledAt,
      status: "BOOKED",
      reason: data.reason || null,
      created_by: data.createdBy || "patient",
      created_at: now,
      updated_at: now,
      department: dept,
    };

    this.appointments.set(id, appointment);
    return appointment;
  }

  getAppointments(params: {
    patientId?: string;
    facilityId?: string;
    status?: AppointmentStatus;
  }): Appointment[] {
    let list = Array.from(this.appointments.values());
    if (params.patientId) {
      list = list.filter((a) => a.patient_id === params.patientId);
    }
    if (params.facilityId) {
      list = list.filter((a) => a.facility_id === params.facilityId);
    }
    if (params.status) {
      list = list.filter((a) => a.status === params.status);
    }
    return list.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }

  getAppointmentById(id: string): Appointment | null {
    const appt = this.appointments.get(id);
    if (!appt) return null;
    if (appt.department_id && !appt.department) {
      appt.department = this.departments.get(appt.department_id) || null;
    }
    return appt;
  }

  // ─── OPD Queue ────────────────────────────────────────────────────────────
  checkInAppointment(appointmentId: string): { appointment: Appointment; queueEntry: OpdQueueEntry } {
    const appt = this.appointments.get(appointmentId);
    if (!appt) {
      throw new Error("APPOINTMENT_NOT_FOUND: Appointment does not exist");
    }

    const now = new Date().toISOString();
    appt.status = "CHECKED_IN";
    appt.updated_at = now;

    // Check if queue entry already exists for this appointment
    for (const q of this.opdQueue.values()) {
      if (q.appointment_id === appointmentId) {
        return { appointment: appt, queueEntry: q };
      }
    }

    const tokenNumber = this.nextTokenNumber++;
    const queueId = crypto.randomUUID();

    const queueEntry: OpdQueueEntry = {
      id: queueId,
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      facility_id: appt.facility_id,
      department_id: appt.department_id,
      clinician_id: appt.clinician_id,
      token_number: tokenNumber,
      status: "WAITING",
      checked_in_at: now,
      created_at: now,
      updated_at: now,
      case_id: appt.intake_case_id,
      department_name: appt.department?.name || "General Medicine",
    };

    this.opdQueue.set(queueId, queueEntry);
    return { appointment: appt, queueEntry };
  }

  getOpdQueue(facilityId: string, status?: OpdQueueStatus): OpdQueueEntry[] {
    let list = Array.from(this.opdQueue.values()).filter((q) => q.facility_id === facilityId);
    if (status) {
      list = list.filter((q) => q.status === status);
    }
    return list.sort((a, b) => a.token_number - b.token_number);
  }

  getOpdQueueEntryById(id: string): OpdQueueEntry | null {
    return this.opdQueue.get(id) || null;
  }

  getOpdQueueEntryByAppointment(appointmentId: string): OpdQueueEntry | null {
    for (const q of this.opdQueue.values()) {
      if (q.appointment_id === appointmentId) return q;
    }
    return null;
  }

  transitionOpdQueue(
    id: string,
    targetStatus: OpdQueueStatus
  ): OpdQueueEntry {
    const entry = this.opdQueue.get(id);
    if (!entry) {
      throw new Error("QUEUE_ENTRY_NOT_FOUND: OPD queue entry does not exist");
    }

    const now = new Date().toISOString();
    entry.status = targetStatus;
    entry.updated_at = now;

    if (targetStatus === "CALLED") {
      entry.called_at = now;
    } else if (targetStatus === "IN_CONSULTATION") {
      entry.consultation_started_at = now;
      const appt = this.appointments.get(entry.appointment_id);
      if (appt) {
        appt.status = "IN_CONSULTATION";
        appt.updated_at = now;
      }
    } else if (targetStatus === "DONE") {
      entry.completed_at = now;
      const appt = this.appointments.get(entry.appointment_id);
      if (appt) {
        appt.status = "COMPLETED";
        appt.updated_at = now;
      }
    }

    return entry;
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────
  getDiagnosticCatalog(): DiagnosticCatalogItem[] {
    return Array.from(this.diagnosticCatalog.values()).filter((c) => c.active);
  }

  createDiagnosticOrder(data: {
    patientId: string;
    caseId: string;
    facilityId: string;
    orderingClinicianId: string;
    priority?: "ROUTINE" | "URGENT" | "STAT";
    clinicalContext?: string | null;
    items: Array<{
      catalogId?: string;
      testName: string;
      testCode: string;
      category?: string | null;
      instructions?: string | null;
    }>;
  }): DiagnosticOrder {
    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();

    const order: DiagnosticOrder = {
      id: orderId,
      patient_id: data.patientId,
      case_id: data.caseId,
      facility_id: data.facilityId,
      ordering_clinician_id: data.orderingClinicianId,
      priority: data.priority || "ROUTINE",
      clinical_context: data.clinicalContext || null,
      status: "ORDERED",
      ordered_at: now,
      created_at: now,
      updated_at: now,
      items: [],
      results: [],
    };

    for (const it of data.items) {
      const itemId = crypto.randomUUID();
      const orderItem: DiagnosticOrderItem = {
        id: itemId,
        diagnostic_order_id: orderId,
        diagnostic_catalog_id: it.catalogId || null,
        test_name_snapshot: it.testName,
        test_code_snapshot: it.testCode,
        instructions: it.instructions || null,
        status: "ORDERED",
        created_at: now,
      };
      this.diagnosticOrderItems.set(itemId, orderItem);
      order.items!.push(orderItem);
    }

    this.diagnosticOrders.set(orderId, order);
    return order;
  }

  getDiagnosticOrders(params: {
    facilityId?: string;
    patientId?: string;
    caseId?: string;
    status?: DiagnosticOrderStatus;
  }): DiagnosticOrder[] {
    let list = Array.from(this.diagnosticOrders.values());
    if (params.facilityId) list = list.filter((o) => o.facility_id === params.facilityId);
    if (params.patientId) list = list.filter((o) => o.patient_id === params.patientId);
    if (params.caseId) list = list.filter((o) => o.case_id === params.caseId);
    if (params.status) list = list.filter((o) => o.status === params.status);

    for (const o of list) {
      o.items = Array.from(this.diagnosticOrderItems.values()).filter(
        (it) => it.diagnostic_order_id === o.id
      );
      o.results = Array.from(this.diagnosticResults.values()).filter(
        (r) => r.case_id === o.case_id
      );
    }

    return list.sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());
  }

  getDiagnosticOrderById(id: string): DiagnosticOrder | null {
    const order = this.diagnosticOrders.get(id);
    if (!order) return null;
    order.items = Array.from(this.diagnosticOrderItems.values()).filter(
      (it) => it.diagnostic_order_id === order.id
    );
    order.results = Array.from(this.diagnosticResults.values()).filter(
      (r) => r.case_id === order.case_id
    );
    return order;
  }

  transitionDiagnosticOrder(
    id: string,
    targetStatus: DiagnosticOrderStatus
  ): DiagnosticOrder {
    const order = this.getDiagnosticOrderById(id);
    if (!order) {
      throw new Error("ORDER_NOT_FOUND: Diagnostic order does not exist");
    }

    const now = new Date().toISOString();
    order.status = targetStatus;
    order.updated_at = now;

    if (targetStatus === "ACCEPTED") {
      order.accepted_at = now;
    } else if (targetStatus === "RESULT_AVAILABLE") {
      order.completed_at = now;
    }

    if (order.items) {
      for (const item of order.items) {
        item.status = targetStatus;
        this.diagnosticOrderItems.set(item.id, item);
      }
    }

    this.diagnosticOrders.set(order.id, order);
    return order;
  }

  submitDiagnosticResult(data: {
    orderItemId: string;
    patientId: string;
    caseId: string;
    resultJson: Record<string, any>;
    resultText?: string | null;
    documentId?: string | null;
    performedBy: string;
    verifiedBy?: string | null;
  }): DiagnosticResult {
    const now = new Date().toISOString();
    const resultId = crypto.randomUUID();

    const result: DiagnosticResult = {
      id: resultId,
      diagnostic_order_item_id: data.orderItemId,
      patient_id: data.patientId,
      case_id: data.caseId,
      result_json: data.resultJson,
      result_text: data.resultText || null,
      document_id: data.documentId || null,
      performed_by: data.performedBy,
      verified_by: data.verifiedBy || null,
      performed_at: now,
      verified_at: data.verifiedBy ? now : null,
      created_at: now,
      updated_at: now,
    };

    this.diagnosticResults.set(resultId, result);

    // Update order item & order status to RESULT_AVAILABLE
    const item = this.diagnosticOrderItems.get(data.orderItemId);
    if (item) {
      item.status = "RESULT_AVAILABLE";
      const order = this.diagnosticOrders.get(item.diagnostic_order_id);
      if (order) {
        order.status = "RESULT_AVAILABLE";
        order.completed_at = now;
        order.updated_at = now;
      }
    }

    return result;
  }

  reviewDiagnosticResult(orderId: string, reviewedBy: string): DiagnosticOrder {
    const order = this.getDiagnosticOrderById(orderId);
    if (!order) {
      throw new Error("ORDER_NOT_FOUND: Diagnostic order does not exist");
    }

    const now = new Date().toISOString();
    order.status = "REVIEWED";
    order.reviewed_at = now;
    order.reviewed_by = reviewedBy;
    order.updated_at = now;

    if (order.items) {
      for (const item of order.items) {
        item.status = "REVIEWED";
        this.diagnosticOrderItems.set(item.id, item);
      }
    }

    this.diagnosticOrders.set(order.id, order);
    return order;
  }

  getDiagnosticResultsByCase(caseId: string): DiagnosticResult[] {
    return Array.from(this.diagnosticResults.values()).filter((r) => r.case_id === caseId);
  }

  // ─── Prescriptions ────────────────────────────────────────────────────────
  createDraftPrescription(data: {
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
  }): Prescription {
    const now = new Date().toISOString();
    const prescriptionId = crypto.randomUUID();

    const prescription: Prescription = {
      id: prescriptionId,
      patient_id: data.patientId,
      case_id: data.caseId,
      facility_id: data.facilityId,
      prescriber_id: data.prescriberId,
      status: "DRAFT",
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
      items: [],
      clarifications: [],
    };

    for (const it of data.items) {
      const itemId = crypto.randomUUID();
      const pItem: PrescriptionItem = {
        id: itemId,
        prescription_id: prescriptionId,
        medicine_name: it.medicineName,
        generic_name: it.genericName || null,
        strength: it.strength || null,
        route: it.route || "oral",
        dose: it.dose,
        frequency: it.frequency,
        duration: it.duration,
        quantity: it.quantity || 1,
        instructions: it.instructions || null,
        created_at: now,
        dispensed_quantity: 0,
      };
      this.prescriptionItems.set(itemId, pItem);
      prescription.items!.push(pItem);
    }

    this.prescriptions.set(prescriptionId, prescription);
    return prescription;
  }

  finalizePrescription(id: string, finalizedBy: string): Prescription {
    const rx = this.getPrescriptionById(id);
    if (!rx) {
      throw new Error("PRESCRIPTION_NOT_FOUND: Prescription does not exist");
    }

    if (rx.status !== "DRAFT") {
      throw new Error(`INVALID_TRANSITION: Cannot finalize prescription in status ${rx.status}`);
    }

    const now = new Date().toISOString();
    rx.status = "FINAL";
    rx.finalized_at = now;
    rx.finalized_by = finalizedBy;
    rx.updated_at = now;

    this.prescriptions.set(rx.id, rx);
    return rx;
  }

  getPrescriptions(params: {
    patientId?: string;
    caseId?: string;
    facilityId?: string;
    status?: PrescriptionStatus;
    onlyFinalOrDispensed?: boolean;
  }): Prescription[] {
    let list = Array.from(this.prescriptions.values());
    if (params.patientId) list = list.filter((p) => p.patient_id === params.patientId);
    if (params.caseId) list = list.filter((p) => p.case_id === params.caseId);
    if (params.facilityId) list = list.filter((p) => p.facility_id === params.facilityId);
    if (params.status) list = list.filter((p) => p.status === params.status);
    if (params.onlyFinalOrDispensed) {
      list = list.filter((p) => ["FINAL", "PARTIALLY_DISPENSED", "DISPENSED"].includes(p.status));
    }

    for (const p of list) {
      p.items = Array.from(this.prescriptionItems.values()).filter((it) => it.prescription_id === p.id);
      p.clarifications = Array.from(this.prescriptionClarifications.values()).filter(
        (c) => c.prescription_id === p.id
      );
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getPrescriptionById(id: string): Prescription | null {
    const p = this.prescriptions.get(id);
    if (!p) return null;
    p.items = Array.from(this.prescriptionItems.values()).filter((it) => it.prescription_id === p.id);
    p.clarifications = Array.from(this.prescriptionClarifications.values()).filter(
      (c) => c.prescription_id === p.id
    );
    return p;
  }

  // ─── Pharmacy & Dispensing ────────────────────────────────────────────────
  getPharmacyInventory(facilityId: string): PharmacyInventoryItem[] {
    return Array.from(this.pharmacyInventory.values())
      .filter((i) => i.facility_id === facilityId && i.active)
      .sort((a, b) => a.medicine_name.localeCompare(b.medicine_name));
  }

  dispenseMedication(data: {
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
  }): { dispenseEvent: DispenseEvent; prescription: Prescription } {
    const rx = this.getPrescriptionById(data.prescriptionId);
    if (!rx) {
      throw new Error("PRESCRIPTION_NOT_FOUND: Prescription does not exist");
    }

    if (rx.status !== "FINAL" && rx.status !== "PARTIALLY_DISPENSED") {
      throw new Error("FORBIDDEN: Only FINAL or PARTIALLY_DISPENSED prescriptions can be dispensed");
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    const dispenseEvent: DispenseEvent = {
      id: eventId,
      prescription_id: rx.id,
      patient_id: rx.patient_id,
      facility_id: data.facilityId,
      dispensed_by: data.dispensedBy,
      status: "COMPLETE",
      notes: data.notes || null,
      dispensed_at: now,
      confirmed_at: now,
      items: [],
    };

    let allItemsFullyDispensed = true;

    for (const it of data.items) {
      const pItem = this.prescriptionItems.get(it.prescriptionItemId);
      if (!pItem) continue;

      const currentDispensed = (pItem.dispensed_quantity || 0) + it.quantityDispensed;
      if (currentDispensed > pItem.quantity) {
        throw new Error(
          `DISPENSE_OVERFLOW: Cannot dispense ${it.quantityDispensed}. Total would be ${currentDispensed} which exceeds prescribed quantity of ${pItem.quantity}`
        );
      }

      pItem.dispensed_quantity = currentDispensed;
      this.prescriptionItems.set(pItem.id, pItem);

      if (currentDispensed < pItem.quantity) {
        allItemsFullyDispensed = false;
      }

      // Decrement inventory stock if matching medicine
      for (const inv of this.pharmacyInventory.values()) {
        if (inv.facility_id === data.facilityId) {
          const medName = pItem.medicine_name.toLowerCase();
          const invName = inv.medicine_name.toLowerCase();
          const invGen = (inv.generic_name || "").toLowerCase();
          const firstWord = medName.split(" ")[0];

          if (
            invName.includes(medName) ||
            medName.includes(invName) ||
            (invGen && (medName.includes(invGen) || invGen.includes(firstWord))) ||
            inv.medicine_key.includes(firstWord)
          ) {
            inv.stock_quantity = Math.max(0, inv.stock_quantity - it.quantityDispensed);
            break;
          }
        }
      }

      const dItemId = crypto.randomUUID();
      const dItem: DispenseItem = {
        id: dItemId,
        dispense_event_id: eventId,
        prescription_item_id: pItem.id,
        quantity_dispensed: it.quantityDispensed,
        batch_number: it.batchNumber || null,
        expiry_date: it.expiryDate || null,
        created_at: now,
        medicine_name: pItem.medicine_name,
      };

      this.dispenseItems.set(dItemId, dItem);
      dispenseEvent.items!.push(dItem);
    }

    // Check overall prescription items
    for (const it of rx.items || []) {
      const stored = this.prescriptionItems.get(it.id);
      if (stored && (stored.dispensed_quantity || 0) < stored.quantity) {
        allItemsFullyDispensed = false;
      }
    }

    rx.status = allItemsFullyDispensed ? "DISPENSED" : "PARTIALLY_DISPENSED";
    rx.updated_at = now;
    dispenseEvent.status = allItemsFullyDispensed ? "COMPLETE" : "PARTIAL";

    this.prescriptions.set(rx.id, rx);
    this.dispenseEvents.set(eventId, dispenseEvent);

    return { dispenseEvent, prescription: rx };
  }

  raisePrescriptionClarification(data: {
    prescriptionId: string;
    raisedBy: string;
    reason: string;
  }): PrescriptionClarification {
    const rx = this.prescriptions.get(data.prescriptionId);
    if (!rx) {
      throw new Error("PRESCRIPTION_NOT_FOUND: Prescription does not exist");
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const clarification: PrescriptionClarification = {
      id,
      prescription_id: rx.id,
      raised_by: data.raisedBy,
      reason: data.reason,
      status: "OPEN",
      created_at: now,
    };

    this.prescriptionClarifications.set(id, clarification);
    return clarification;
  }

  resolvePrescriptionClarification(data: {
    clarificationId: string;
    responseBy: string;
    responseText: string;
  }): PrescriptionClarification {
    const c = this.prescriptionClarifications.get(data.clarificationId);
    if (!c) {
      throw new Error("CLARIFICATION_NOT_FOUND: Clarification does not exist");
    }

    const now = new Date().toISOString();
    c.status = "RESOLVED";
    c.response_by = data.responseBy;
    c.response_text = data.responseText;
    c.resolved_at = now;

    this.prescriptionClarifications.set(c.id, c);
    return c;
  }

  getDispenseEventsByPatient(patientId: string): DispenseEvent[] {
    const list = Array.from(this.dispenseEvents.values()).filter((e) => e.patient_id === patientId);
    for (const e of list) {
      e.items = Array.from(this.dispenseItems.values()).filter((it) => it.dispense_event_id === e.id);
    }
    return list.sort((a, b) => new Date(b.dispensed_at).getTime() - new Date(a.dispensed_at).getTime());
  }

  updatePharmacyStock(itemId: string, newQuantity: number): PharmacyInventoryItem | null {
    const item = this.pharmacyInventory.get(itemId);
    if (!item) return null;
    item.stock_quantity = Math.max(0, newQuantity);
    item.updated_at = new Date().toISOString();
    this.pharmacyInventory.set(itemId, item);
    return item;
  }
}

const globalForEcosystem = globalThis as unknown as {
  __medkit_ecosystem_store?: EcosystemMockStore;
};

if (!globalForEcosystem.__medkit_ecosystem_store) {
  globalForEcosystem.__medkit_ecosystem_store = new EcosystemMockStore();
}

export const ecosystemMockStore = globalForEcosystem.__medkit_ecosystem_store;

export function resetEcosystemMockStore(): void {
  ecosystemMockStore.reset();
}
