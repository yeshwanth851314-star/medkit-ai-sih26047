import {
  getCasesByPatientId,
  getDocumentsByPatientId,
  getCaseById,
  getAppointmentsDb,
  getDiagnosticOrdersDb,
  getPrescriptionsDb,
  getDispenseEventsByPatientDb,
} from "@/lib/db/supabase";
import { TimelineMilestone, VisitComparisonResult, MedicationDelta, VitalsDelta } from "./types";
import { ClinicalCase } from "@/types/database";

export async function buildPatientTimeline(
  patientId: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<TimelineMilestone[]> {
  const [cases, documents, appointments, diagOrders, prescriptions, dispenses] = await Promise.all([
    getCasesByPatientId(patientId, actorOrToken).catch(() => []),
    getDocumentsByPatientId(patientId, actorOrToken).catch(() => []),
    getAppointmentsDb({ patientId }, actorOrToken).catch(() => []),
    getDiagnosticOrdersDb({ patientId }, actorOrToken).catch(() => []),
    getPrescriptionsDb({ patientId }, actorOrToken).catch(() => []),
    getDispenseEventsByPatientDb(patientId, actorOrToken).catch(() => []),
  ]);

  const milestones: TimelineMilestone[] = [];

  // Map Clinical Cases
  for (const c of cases) {
    milestones.push({
      id: `case-${c.id}`,
      timestamp: c.created_at,
      type: "encounter",
      eventType: "encounter",
      title: c.chief_complaint,
      subtitle: `${c.case_type === "ayush" ? "AYUSH Intake" : "General Clinical Intake"} • ${c.status === "final" ? "Finalized" : "Draft"}`,
      badgeText: c.status === "final" ? "Finalized Visit" : "Draft Visit",
      badgeVariant: c.case_type === "ayush" ? "ayush" : c.status === "final" ? "success" : "warning",
      details: {
        hpi: c.hpi,
        medications: c.medication_history,
        examination: c.examination,
        assessment: c.assessment_plan,
      },
      caseId: c.id,
    });

    // Check for red flags within case
    if (c.red_flags && c.red_flags.length > 0) {
      for (const rf of c.red_flags) {
        milestones.push({
          id: `rf-${c.id}-${rf.rule_id}`,
          timestamp: rf.triggered_at || c.created_at,
          type: "red_flag",
          eventType: "red_flag",
          title: "Potential Red Flag Alert",
          subtitle: rf.message,
          badgeText: rf.severity.toUpperCase(),
          badgeVariant: "danger",
          caseId: c.id,
        });
      }
    }
  }

  // Map Digitized Documents
  for (const doc of documents) {
    milestones.push({
      id: `doc-${doc.id}`,
      timestamp: doc.created_at,
      type: "document",
      eventType: "document",
      title: `Uploaded ${doc.document_type.toUpperCase()}: ${doc.original_filename}`,
      subtitle: `Digitized with ${doc.ocr_confidence ? `${Math.round(doc.ocr_confidence * 100)}%` : "N/A"} confidence`,
      badgeText: doc.document_type.toUpperCase(),
      badgeVariant: "default",
      details: doc.extracted_data || undefined,
      documentId: doc.id,
    });
  }

  // Map Appointments & OPD Check-ins
  for (const appt of appointments) {
    milestones.push({
      id: `appt-${appt.id}`,
      timestamp: appt.created_at,
      type: "appointment",
      eventType: "appointment",
      title: `Consultation Booked: ${appt.department?.name || "General Medicine"}`,
      subtitle: `Scheduled for ${new Date(appt.scheduled_at).toLocaleString("en-IN")} • Status: ${appt.status}`,
      badgeText: appt.status,
      badgeVariant: appt.status === "CHECKED_IN" || appt.status === "COMPLETED" ? "success" : "info",
      appointmentId: appt.id,
      caseId: appt.intake_case_id || undefined,
    });

    if (appt.status === "CHECKED_IN" || appt.status === "IN_CONSULTATION" || appt.status === "COMPLETED") {
      milestones.push({
        id: `opd-checkin-${appt.id}`,
        timestamp: appt.updated_at || appt.created_at,
        type: "opd_queue",
        eventType: "opd_checkin",
        title: "OPD Check-In Confirmed",
        subtitle: `Queue token issued for ${appt.department?.name || "Outpatient Clinic"}`,
        badgeText: "CHECKED IN",
        badgeVariant: "success",
        appointmentId: appt.id,
      });
    }
  }

  // Map Diagnostic Orders & Results
  for (const order of diagOrders) {
    const testNames = (order.items || []).map((i) => i.test_name_snapshot).join(", ") || "Diagnostic Panel";
    milestones.push({
      id: `diag-order-${order.id}`,
      timestamp: order.ordered_at,
      type: "diagnostic_order",
      eventType: "diagnostic_order",
      title: `Diagnostic Investigation Ordered: ${testNames}`,
      subtitle: `Priority: ${order.priority} • Status: ${order.status}`,
      badgeText: order.status,
      badgeVariant: order.status === "REVIEWED" ? "success" : order.status === "RESULT_AVAILABLE" ? "warning" : "purple",
      orderId: order.id,
      caseId: order.case_id,
    });

    if (order.results && order.results.length > 0) {
      for (const res of order.results) {
        milestones.push({
          id: `diag-res-${res.id}`,
          timestamp: res.performed_at,
          type: "diagnostic_result",
          eventType: "diagnostic_result",
          title: `Diagnostic Result Available (${order.items?.[0]?.test_code_snapshot || "Lab Test"})`,
          subtitle: `Performed by ${res.performed_by}${res.verified_by ? ` • Verified by ${res.verified_by}` : ""}`,
          badgeText: "RESULT AVAILABLE",
          badgeVariant: "success",
          details: res.result_json,
          orderId: order.id,
          caseId: res.case_id,
          documentId: res.document_id || undefined,
        });
      }
    }
  }

  // Map Prescriptions
  for (const rx of prescriptions) {
    const medSummary = (rx.items || []).map((i) => `${i.medicine_name} (${i.dose})`).join(", ") || "Medications";
    milestones.push({
      id: `rx-${rx.id}`,
      timestamp: rx.finalized_at || rx.created_at,
      type: "prescription",
      eventType: "prescription",
      title: `Prescription ${rx.status === "FINAL" ? "Finalized & Approved" : rx.status}: ${medSummary}`,
      subtitle: `${rx.items?.length || 0} items prescribed${rx.finalized_at ? ` • Approved on ${new Date(rx.finalized_at).toLocaleDateString()}` : ""}`,
      badgeText: rx.status,
      badgeVariant: rx.status === "FINAL" || rx.status === "DISPENSED" ? "success" : "warning",
      prescriptionId: rx.id,
      caseId: rx.case_id,
    });
  }

  // Map Dispense Events
  for (const d of dispenses) {
    const count = d.items?.length || 0;
    milestones.push({
      id: `dispense-${d.id}`,
      timestamp: d.dispensed_at,
      type: "dispense",
      eventType: "dispense",
      title: `Pharmacy Dispense Confirmed: ${count} item${count === 1 ? "" : "s"} handed over`,
      subtitle: `Dispensed by ${d.dispensed_by} at In-Hospital Pharmacy`,
      badgeText: d.status === "COMPLETE" ? "DISPENSED" : "PARTIALLY DISPENSED",
      badgeVariant: "success",
      dispenseId: d.id,
      prescriptionId: d.prescription_id,
    });
  }

  // Sort strictly reverse-chronological (newest first)
  return milestones.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function compareConsecutiveVisits(
  patientId: string,
  targetCaseId?: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<VisitComparisonResult | null> {
  const cases = await getCasesByPatientId(patientId, actorOrToken);
  if (cases.length === 0) return null;

  // Identify current case and previous case
  let currentIndex = 0;
  if (targetCaseId) {
    const foundIdx = cases.findIndex((c) => c.id === targetCaseId);
    if (foundIdx !== -1) currentIndex = foundIdx;
  }

  const currentCase = cases[currentIndex];
  const previousCase: ClinicalCase | undefined = cases[currentIndex + 1];

  if (!previousCase) {
    // Single visit patient - no previous visit to compare against
    return {
      hasPreviousVisit: false,
      currentVisitDate: currentCase.created_at,
      currentComplaint: currentCase.chief_complaint,
      symptomChanges: {
        added: [currentCase.chief_complaint],
        persisting: [],
        resolved: [],
      },
      medicationChanges: (currentCase.medication_history || []).map((m) => ({
        name: m.name,
        status: "added",
        dose: m.dose,
      })),
      vitalsComparison: [],
      redFlagAlerts: currentCase.red_flags || [],
    };
  }

  // Calculate Medication Deltas
  const currentMeds = currentCase.medication_history || [];
  const prevMeds = previousCase.medication_history || [];

  const medicationChanges: MedicationDelta[] = [];

  for (const cMed of currentMeds) {
    const match = prevMeds.find((p) => p.name.toLowerCase().trim() === cMed.name.toLowerCase().trim());
    if (match) {
      medicationChanges.push({
        name: cMed.name,
        status: "continued",
        dose: cMed.dose,
        previousDose: match.dose,
      });
    } else {
      medicationChanges.push({
        name: cMed.name,
        status: "added",
        dose: cMed.dose,
      });
    }
  }

  for (const pMed of prevMeds) {
    const stillActive = currentMeds.some((c) => c.name.toLowerCase().trim() === pMed.name.toLowerCase().trim());
    if (!stillActive) {
      medicationChanges.push({
        name: pMed.name,
        status: "discontinued",
        previousDose: pMed.dose,
      });
    }
  }

  // Calculate Vitals Comparison
  const vitalsComparison: VitalsDelta[] = [];
  const cExam = currentCase.examination || {};
  const pExam = previousCase.examination || {};

  const metrics: { key: string; label: string }[] = [
    { key: "blood_pressure", label: "Blood Pressure" },
    { key: "pulse", label: "Pulse Rate" },
    { key: "temperature", label: "Temperature" },
    { key: "spo2", label: "SpO2" },
  ];

  for (const m of metrics) {
    if (cExam[m.key] || pExam[m.key]) {
      vitalsComparison.push({
        metric: m.label,
        currentValue: cExam[m.key] || "Not recorded",
        previousValue: pExam[m.key] || "Not recorded",
      });
    }
  }

  // Symptom progression summary
  const symptomAdded: string[] = [];
  const symptomPersisting: string[] = [];

  const currentAssociated = currentCase.hpi?.associated_symptoms || [];
  const prevAssociated = previousCase.hpi?.associated_symptoms || [];

  for (const s of currentAssociated) {
    if (prevAssociated.includes(s)) {
      symptomPersisting.push(s);
    } else {
      symptomAdded.push(s);
    }
  }

  return {
    hasPreviousVisit: true,
    currentVisitDate: currentCase.created_at,
    previousVisitDate: previousCase.created_at,
    currentComplaint: currentCase.chief_complaint,
    previousComplaint: previousCase.chief_complaint,
    complaintProgressionNotes: `Complaint progressed from "${previousCase.chief_complaint}" to "${currentCase.chief_complaint}"`,
    symptomChanges: {
      added: symptomAdded,
      persisting: symptomPersisting,
      resolved: prevAssociated.filter((s) => !currentAssociated.includes(s)),
    },
    medicationChanges,
    vitalsComparison,
    redFlagAlerts: currentCase.red_flags || [],
  };
}
