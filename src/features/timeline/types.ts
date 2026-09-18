import { ClinicalCase, MedicalDocument, RedFlagAlert } from "@/types/database";

export interface TimelineMilestone {
  id: string;
  timestamp: string;
  type:
    | "encounter"
    | "document"
    | "red_flag"
    | "appointment"
    | "opd_queue"
    | "diagnostic_order"
    | "diagnostic_result"
    | "prescription"
    | "dispense";
  eventType?: string;
  title: string;
  subtitle?: string;
  badgeText: string;
  badgeVariant: "default" | "success" | "warning" | "danger" | "ayush" | "clinical" | "purple" | "info";
  details?: Record<string, any>;
  caseId?: string;
  documentId?: string;
  appointmentId?: string;
  orderId?: string;
  prescriptionId?: string;
  dispenseId?: string;
}

export interface MedicationDelta {
  name: string;
  status: "added" | "continued" | "discontinued";
  dose?: string | null;
  previousDose?: string | null;
}

export interface VitalsDelta {
  metric: string;
  previousValue?: string | null;
  currentValue?: string | null;
  changeDescription?: string;
}

export interface VisitComparisonResult {
  hasPreviousVisit: boolean;
  currentVisitDate: string;
  previousVisitDate?: string;
  currentComplaint: string;
  previousComplaint?: string;
  complaintProgressionNotes?: string;
  symptomChanges: {
    added: string[];
    persisting: string[];
    resolved: string[];
  };
  medicationChanges: MedicationDelta[];
  vitalsComparison: VitalsDelta[];
  redFlagAlerts: RedFlagAlert[];
}
