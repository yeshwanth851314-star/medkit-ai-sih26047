"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  UserCircle,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  FlaskConical,
  Pill,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Building2,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Share2,
  FileText,
  Activity,
  Printer,
  QrCode as QrIcon,
  Bell,
  Eye,
  AlertTriangle,
  HeartPulse,
} from "lucide-react";
import { DEMO_PATIENT_ID, DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";
import {
  Appointment,
  OpdQueueEntry,
  Prescription,
  DiagnosticOrder,
  FacilityDepartment,
} from "@/types/ecosystem";
import { TimelineMilestone } from "@/features/timeline/types";
import { QrCode } from "@/components/shared/qr-code";
import {
  ShareProfileModal,
  ProfileShareData,
} from "@/components/shared/share-profile-modal";

const PATIENT_PROFILE: ProfileShareData = {
  role: "patient",
  roleTitle: "Verified Citizen Patient Record",
  uniqueId: "MED-2026-1001",
  name: "Ramesh Kumar Varma",
  secondaryIdLabel: "ABHA Health ID",
  secondaryIdValue: "91-2026-4047-1001",
  facility: "AIIA Central Hospital (fac-hyd-01)",
  departmentOrScope: "General Medicine & Kayachikitsa",
  contactOrMeta: "+91 98765 43210 • Blood Group: B+",
  validity: "Active / Verified",
};

const DEFAULT_DEPARTMENTS: FacilityDepartment[] = [
  { id: "dept-gen-01", facility_id: "fac-hyd-01", name: "General Medicine", code: "GEN_MED", active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
  { id: "dept-kaya-01", facility_id: "fac-hyd-01", name: "Kayachikitsa (Ayurveda Internal Medicine)", code: "KAYA", active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
  { id: "dept-panch-01", facility_id: "fac-hyd-01", name: "Panchakarma Department", code: "PANCH", active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
  { id: "dept-shalya-01", facility_id: "fac-hyd-01", name: "Shalya Tantra (Surgical OPD)", code: "SHALYA", active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
];

export default function PatientPortalPage() {
  const [patientId] = useState(DEMO_PATIENT_ID);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueEntry, setQueueEntry] = useState<OpdQueueEntry | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [diagnosticOrders, setDiagnosticOrders] = useState<DiagnosticOrder[]>([]);
  const [timeline, setTimeline] = useState<TimelineMilestone[]>([]);
  const [departments, setDepartments] = useState<FacilityDepartment[]>(DEFAULT_DEPARTMENTS);

  // Navigation tabs: 'appointments' | 'history' | 'reports' | 'prescriptions'
  const [activeTab, setActiveTab] = useState<
    "appointments" | "history" | "reports" | "prescriptions"
  >("appointments");

  const [isLoading, setIsLoading] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("dept-gen-01");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bookingReason, setBookingReason] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [activeDoctorAlert, setActiveDoctorAlert] = useState<string | null>(null);

  // Selected scan for viewing
  const [viewingScan, setViewingScan] = useState<string | null>(null);

  const loadPatientData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Appointments
      const apptRes = await fetch(`/api/appointments?patientId=${patientId}`);
      const apptData = await apptRes.json();
      if (apptRes.ok && apptData.appointments) {
        setAppointments(apptData.appointments);

        // Find active checked-in or called appointment
        const activeAppt = apptData.appointments.find(
          (a: Appointment) =>
            a.status === "CHECKED_IN" ||
            a.status === "IN_CONSULTATION" ||
            a.status === "BOOKED"
        );
        if (activeAppt) {
          const qRes = await fetch(`/api/opd/queue?facilityId=${activeAppt.facility_id}`);
          const qData = await qRes.json();
          if (qRes.ok && qData.queue) {
            const myQueue = qData.queue.find(
              (q: OpdQueueEntry) =>
                q.appointment_id === activeAppt.id || q.patient_id === patientId
            );
            if (myQueue) {
              setQueueEntry(myQueue);
              if (myQueue.status === "CALLED") {
                setActiveDoctorAlert(
                  `Doctor has accepted your appointment! Token #${myQueue.token_number} is now CALLED. Please proceed to Consultation Room 4.`
                );
              }
            }
          }
        }
      }

      // 2. Fetch Prescriptions
      const rxRes = await fetch(`/api/prescriptions?patientId=${patientId}`);
      const rxData = await rxRes.json();
      if (rxRes.ok && rxData.prescriptions) {
        setPrescriptions(rxData.prescriptions);
      }

      // 3. Fetch Diagnostics
      const diagRes = await fetch(`/api/diagnostics/orders?patientId=${patientId}`);
      const diagData = await diagRes.json();
      if (diagRes.ok && diagData.orders) {
        setDiagnosticOrders(diagData.orders);
      }

      // 4. Fetch Timeline
      const tlRes = await fetch(`/api/timeline/${patientId}`);
      const tlData = await tlRes.json();
      if (tlRes.ok && tlData.milestones) {
        setTimeline(tlData.milestones);
      }

      // 5. Fetch Departments for booking
      const deptRes = await fetch(`/api/facilities/fac-hyd-01/departments`);
      const deptData = await deptRes.json();
      if (deptRes.ok && deptData.departments) {
        setDepartments(deptData.departments);
        if (deptData.departments.length > 0 && !selectedDept) {
          setSelectedDept(deptData.departments[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load patient data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, selectedDept]);

  useEffect(() => {
    loadPatientData();
    if (typeof window !== "undefined") {
      if (window.location.search.includes("book=true")) {
        setIsBookingOpen(true);
      }
      const handleHash = () => {
        const hash = window.location.hash.replace("#", "");
        if (hash === "history" || hash === "reports" || hash === "prescriptions" || hash === "appointments") {
          setActiveTab(hash as any);
        }
      };
      handleHash();
      window.addEventListener("hashchange", handleHash);

      const handleOpenBooking = () => setIsBookingOpen(true);
      window.addEventListener("medkit:open-booking", handleOpenBooking);

      return () => {
        window.removeEventListener("hashchange", handleHash);
        window.removeEventListener("medkit:open-booking", handleOpenBooking);
      };
    }
  }, [loadPatientData]);

  // Handle OPD Check-In
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await fetch("/api/opd/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json();
      if (res.ok && data.queueEntry) {
        setQueueEntry(data.queueEntry);
        setActionSuccessMessage(
          `Successfully checked in! Your OPD Token is #${data.queueEntry.token_number}. It is now visible in the Doctor's OPD waiting queue.`
        );
        loadPatientData();
      }
    } catch (err) {
      console.error("Failed to check in:", err);
    }
  };

  // Handle Book Appointment
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || isSubmittingBooking) return;

    setIsSubmittingBooking(true);
    try {
      const scheduledTime = selectedDate
        ? new Date(selectedDate).toISOString()
        : new Date(Date.now() + 3600000).toISOString();

      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          facilityId: "fac-hyd-01",
          departmentId: selectedDept,
          scheduledAt: scheduledTime,
          reason: bookingReason || "Outpatient Clinical Consultation",
        }),
      });

      const data = await res.json();
      if (res.ok && data.appointment) {
        setIsBookingOpen(false);
        setBookingReason("");
        setActionSuccessMessage(
          "Consultation appointment successfully applied! Your application is now visible to the doctor in their Doctor Dashboard queue."
        );
        loadPatientData();
      }
    } catch (err) {
      console.error("Failed to book appointment:", err);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ─── Share Profile Modal ─── */}
      <ShareProfileModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        profile={PATIENT_PROFILE}
      />

      {/* ─── Patient Identity & Welcome Banner ─── */}
      <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/60 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-sm shrink-0">
              <UserCircle className="h-10 w-10" aria-hidden="true" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                <span>Verified Citizen Patient Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                {PATIENT_PROFILE.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                <span>
                  Unique Patient ID:{" "}
                  <strong className="text-slate-900 font-mono">
                    {PATIENT_PROFILE.uniqueId}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  ABHA Number:{" "}
                  <strong className="text-slate-900 font-mono">
                    {PATIENT_PROFILE.secondaryIdValue}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Facility:{" "}
                  <strong className="text-slate-900">{PATIENT_PROFILE.facility}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs sm:text-sm font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition-colors"
            >
              <Share2 className="h-4 w-4 text-amber-700" />
              <span>Share Profile &amp; QR</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-amber-800 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Apply for Appointment</span>
            </button>

            <Link
              href="/intake/new"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-clinical-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Voice Intake &rarr;</span>
            </Link>

            <button
              type="button"
              onClick={loadPatientData}
              title="Refresh Records"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-white text-slate-600 hover:bg-surface-100"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin text-clinical-600" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Real-Time Doctor Notification Alert Banner ─── */}
      {activeDoctorAlert && (
        <div className="rounded-2xl border-2 border-clinical-400 bg-clinical-50 p-4 text-clinical-900 shadow-md flex items-center justify-between gap-4 animate-scaleUp">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-600 text-white animate-bounce shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-clinical-800">
                Doctor OPD Response Alert
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                {activeDoctorAlert}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveDoctorAlert(null)}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-clinical-700 border border-clinical-200 hover:bg-clinical-100"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Active OPD Token Banner (When Checked-In) ─── */}
      {queueEntry && queueEntry.status !== "DONE" && (
        <div className="rounded-2xl border-2 border-clinical-300 bg-clinical-50/70 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-clinical-600 text-white font-extrabold text-2xl shadow">
              #{queueEntry.token_number}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-clinical-800">
                Active Hospital OPD Queue Token
              </div>
              <div className="text-lg font-bold text-slate-900">
                Token #{queueEntry.token_number} • {queueEntry.department_name || "General Medicine"}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Status: <strong className="text-clinical-700 uppercase">{queueEntry.status}</strong> •
                Room #4 • Arrived at{" "}
                {new Date(queueEntry.checked_in_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
          <Link
            href="/opd/queue"
            className="rounded-xl bg-white border border-clinical-200 px-4 py-2.5 text-xs font-semibold text-clinical-700 hover:bg-clinical-50 shadow-sm"
          >
            View Live Hospital OPD Display &rarr;
          </Link>
        </div>
      )}

      {/* ─── Navigation Tabs for Patient Services ─── */}
      <div className="border-b border-surface-200 flex flex-wrap gap-2 text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all ${
            activeTab === "appointments"
              ? "border-amber-600 text-amber-900 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Appointments &amp; OPD Token ({appointments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all ${
            activeTab === "history"
              ? "border-amber-600 text-amber-900 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>My Medical History</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all ${
            activeTab === "reports"
              ? "border-amber-600 text-amber-900 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          <span>Reports &amp; Scans ({diagnosticOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prescriptions")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all ${
            activeTab === "prescriptions"
              ? "border-amber-600 text-amber-900 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Pill className="h-4 w-4" />
          <span>1-Time Prescriptions &amp; QR ({prescriptions.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: APPOINTMENTS & OPD QUEUE ─── */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Applied Consultation Appointments
                </h2>
                <p className="text-xs text-slate-500">
                  When you apply here, your consultation request immediately appears in the Doctor&apos;s OPD workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-bold text-white hover:bg-clinical-700 shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Apply New Appointment</span>
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No appointments currently applied. Click &quot;Apply New Appointment&quot; above to book a doctor consultation.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-surface-200 p-4 gap-4 hover:border-surface-300 transition-all bg-surface-50/30"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {appt.department?.name || "General Medicine & Kayachikitsa"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            appt.status === "CHECKED_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : appt.status === "IN_CONSULTATION"
                              ? "bg-blue-100 text-blue-800"
                              : appt.status === "COMPLETED"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {appt.status === "BOOKED" ? "Applied & Pending Call" : appt.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(appt.scheduled_at).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </span>
                        <span>•</span>
                        <span>Chief Complaint: <strong>{appt.reason || "Consultation"}</strong></span>
                        <span>•</span>
                        <span>Doctor: Dr. Ananya Rao (AIIA)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {appt.status === "BOOKED" && (
                        <button
                          type="button"
                          onClick={() => handleCheckIn(appt.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Check In at Kiosk &amp; Get Token</span>
                        </button>
                      )}
                      {appt.status === "CHECKED_IN" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>In Doctor OPD Waiting List</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: MY MEDICAL HISTORY (STRICTLY HIS HISTORY) ─── */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Clinical Profile, Allergies, Prakriti */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-surface-200 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-clinical-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Longitudinal Medical &amp; Clinical History
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Record ID: {PATIENT_PROFILE.uniqueId}
                </span>
              </div>

              {/* Patient Basic Vitals & Demographic History */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-surface-50 p-3 border border-surface-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Blood Pressure</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">128/82 mmHg</div>
                </div>
                <div className="rounded-xl bg-surface-50 p-3 border border-surface-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Pulse / Heart Rate</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">74 bpm</div>
                </div>
                <div className="rounded-xl bg-surface-50 p-3 border border-surface-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">SpO2 Oxygen</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">99% Room Air</div>
                </div>
                <div className="rounded-xl bg-surface-50 p-3 border border-surface-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Body Temperature</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">98.4 °F Normal</div>
                </div>
              </div>

              {/* Verified Allergies & Red Flags */}
              <div className="rounded-xl bg-red-50/70 border border-red-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>Verified Known Drug &amp; Environmental Allergies</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200">
                    Penicillin &bull; Severe Urticaria
                  </span>
                  <span className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200">
                    Sulfa Drugs &bull; Mild Skin Rash
                  </span>
                </div>
              </div>

              {/* Chronic Conditions & Past Illness */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Documented Chronic Diagnoses
                </h3>
                <div className="divide-y divide-surface-100 rounded-xl border border-surface-200 bg-surface-50/30">
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">Mild Primary Hypertension</div>
                      <div className="text-slate-500 text-[11px]">Diagnosed in 2022 • Controlled with lifestyle and herbal regimen</div>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                      Active / Stable
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">Seasonal Bronchial Allergy / Kasa</div>
                      <div className="text-slate-500 text-[11px]">Recurrent dry cough during monsoon season</div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                      Under Evaluation
                    </span>
                  </div>
                </div>
              </div>

              {/* Ayush Prakriti Assessment */}
              <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <HeartPulse className="h-4 w-4 text-amber-700" />
                  <span>Ayush Constitutional Doshic Prakriti</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Prakriti Profile: <strong>Vata-Pitta Predominant (V3-P2-K1)</strong> • Agni: <strong>Samagni</strong> • Koshtha: <strong>Madhyama</strong>. Recommended diet includes warm nourishing foods with moderate spices and avoidance of cold raw dry foods.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Encounters Timeline */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-surface-200 pb-3">
              <Layers className="h-5 w-5 text-clinical-600" />
              <h2 className="text-base font-bold text-slate-900">Visit Journey Timeline</h2>
            </div>

            {timeline.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No past visit events found.
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
                {timeline.slice(0, 8).map((item) => (
                  <div key={item.id} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs ${
                        item.badgeVariant === "success"
                          ? "bg-emerald-500"
                          : item.badgeVariant === "danger"
                          ? "bg-red-500"
                          : item.badgeVariant === "warning"
                          ? "bg-amber-500"
                          : "bg-clinical-500"
                      }`}
                    />
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {new Date(item.timestamp).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: DIAGNOSTIC REPORTS & SCANS ─── */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Laboratory Reports &amp; Diagnostic Imaging Scans
                </h2>
                <p className="text-xs text-slate-500">
                  Verified pathology investigations and radiology scans conducted under NABL accreditation standards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-surface-50"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Print All Reports</span>
              </button>
            </div>

            {diagnosticOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No diagnostic reports currently available.
              </div>
            ) : (
              <div className="space-y-6">
                {diagnosticOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-surface-200 p-5 space-y-4 bg-white shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-100 pb-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-purple-700 tracking-wider">
                          Investigation Order #{order.id.substring(0, 8)}
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                          {(order.items || []).map((i) => i.test_name_snapshot).join(" • ")}
                        </h3>
                        <div className="text-xs text-slate-500">
                          Ordered: {new Date(order.ordered_at).toLocaleString()} • Priority: {order.priority}
                        </div>
                      </div>

                      <span
                        className={`self-start sm:self-auto rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          order.status === "RESULT_AVAILABLE" || order.status === "REVIEWED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {order.status === "RESULT_AVAILABLE" ? "Verified Report Available" : order.status}
                      </span>
                    </div>

                    {/* Results & Scan Visualization */}
                    {(order.results || []).map((res) => (
                      <div key={res.id} className="space-y-3 rounded-xl bg-surface-50/70 p-4 border border-surface-200">
                        <div className="flex items-center justify-between text-xs border-b border-surface-200 pb-2">
                          <span className="font-bold text-slate-800">
                            Verified Result Parameters:
                          </span>
                          <span className="text-slate-500">
                            Evaluated by: <strong>{res.verified_by || res.performed_by || "Verified Technologist"}</strong>
                          </span>
                        </div>

                        {/* Parameter Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {Object.entries(res.result_json || {}).map(([key, val]: any) => (
                            <div
                              key={key}
                              className="rounded-xl bg-white p-3 border border-surface-200 shadow-2xs space-y-1"
                            >
                              <div className="text-[10px] text-slate-400 font-semibold truncate">
                                {val?.label || key}
                              </div>
                              <div className="font-black text-slate-900 text-sm">
                                {val?.value ?? String(val)} {val?.unit || ""}
                              </div>
                              {val?.ref_low && val?.ref_high && (
                                <div className="text-[9px] text-slate-400">
                                  Ref: {val.ref_low} - {val.ref_high} {val.unit}
                                </div>
                              )}
                              <div className="text-[9px] font-bold text-emerald-600 uppercase">
                                {val?.flag || "Normal"}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Radiographic Scan Visualizer (Chest X-Ray) */}
                        {res.finding && res.finding.toLowerCase().includes("radiograph") && (
                          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-white space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-purple-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                                  Digital Radiology Imaging (Chest X-Ray PA View)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingScan(
                                    viewingScan ? null : "xray-chest"
                                  )
                                }
                                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs font-semibold text-white"
                              >
                                {viewingScan ? "Hide Image" : "Inspect Radiograph"}
                              </button>
                            </div>

                            {viewingScan && (
                              <div className="p-4 rounded-lg bg-black flex flex-col items-center justify-center border border-slate-800 space-y-2">
                                <div className="h-48 w-48 rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center text-center p-4">
                                  <div className="space-y-1">
                                    <Activity className="h-8 w-8 text-cyan-400 mx-auto animate-pulse" />
                                    <div className="text-xs font-mono text-cyan-200">PA CHEST VIEW</div>
                                    <div className="text-[10px] text-slate-400">Resolution: 2048 x 2048 DICOM</div>
                                    <div className="text-[10px] text-emerald-400 font-bold">No Infiltrate Visualized</div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  NABL Radiographic Series ID: RAD-2026-X8921
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-slate-700 pt-1">
                          <strong>Technologist Clinical Impression:</strong> {res.finding}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: 1-TIME PRESCRIPTIONS & UNIQUE QR CODES ─── */}
      {activeTab === "prescriptions" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1-Time Verified Prescriptions &amp; Dispensary QR Codes
                </h2>
                <p className="text-xs text-slate-500">
                  Each prescription contains complete tablet doses, duration, and a cryptographically verifiable QR code for dispensary redemption.
                </p>
              </div>
              <Link
                href="/pharmacy/queue"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
              >
                <span>View Hospital Dispensary Queue</span> &rarr;
              </Link>
            </div>

            {prescriptions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No prescriptions issued yet. Consultations with doctor-signed prescriptions will appear here.
              </div>
            ) : (
              <div className="space-y-6">
                {prescriptions.map((rx) => {
                  const qrData = JSON.stringify({
                    rxId: rx.id,
                    rxNumber: rx.prescription_number || rx.id.substring(0, 8),
                    patientId: rx.patient_id,
                    doctor: rx.prescriber_name || "Dr. Ananya Rao",
                    items: (rx.items || []).map((i) => ({
                      name: i.medicine_name,
                      qty: i.quantity,
                      dose: i.dose,
                    })),
                    status: rx.status,
                  });

                  return (
                    <div
                      key={rx.id}
                      className="rounded-2xl border-2 border-emerald-200 p-6 space-y-5 bg-white shadow-md relative overflow-hidden"
                    >
                      {/* Top banner */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-4">
                        <div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 mb-1">
                            <ShieldCheck className="h-3 w-3 text-emerald-700" />
                            <span>1-Time Verified e-Prescription</span>
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900">
                            Prescription Ref: {rx.prescription_number || rx.id.substring(0, 8)}
                          </h3>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Prescribing Physician: <strong>{rx.prescriber_name || "Dr. Ananya Rao, MD (AIIA)"}</strong> • Date: {new Date(rx.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <span
                          className={`self-start sm:self-auto rounded-full px-3 py-1 text-xs font-bold uppercase ${
                            rx.status === "DISPENSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : rx.status === "FINAL"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-surface-100 text-slate-700"
                          }`}
                        >
                          {rx.status === "FINAL" ? "Ready for Pharmacy Pickup" : rx.status}
                        </span>
                      </div>

                      {/* Prescribed Medications Table & Unique QR Code */}
                      <div className="flex flex-col lg:flex-row items-start gap-6">
                        {/* Left: Tablets & Doses Table */}
                        <div className="w-full space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Prescribed Medications &amp; Tablets:
                          </h4>
                          <div className="divide-y divide-surface-100 rounded-xl border border-surface-200 overflow-hidden">
                            {(rx.items || []).map((item) => (
                              <div
                                key={item.id}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-50/50 transition-colors"
                              >
                                <div>
                                  <div className="font-extrabold text-slate-900 text-sm">
                                    {item.medicine_name} {item.strength || ""}
                                  </div>
                                  <div className="text-xs text-slate-600 mt-0.5">
                                    Dose: <strong>{item.dose}</strong> • Frequency: {item.frequency} • Duration: {item.duration}
                                  </div>
                                  {item.anupana && (
                                    <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                                      Ayush Anupana: {item.anupana}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right sm:shrink-0">
                                  <span className="inline-block rounded-lg bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-900 border border-emerald-200">
                                    Quantity: {item.quantity} Tablets
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {(rx.ayush_dietary_advice || rx.notes) && (
                            <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-950">
                              <strong>Doctor&apos;s Diet &amp; Lifestyle Instructions:</strong> {rx.ayush_dietary_advice || rx.notes}
                            </div>
                          )}
                        </div>

                        {/* Right: Authentic Unique QR Code for Dispensary Scanning */}
                        <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-50 border border-surface-200 text-center w-full sm:w-auto">
                          <QrCode value={qrData} size={135} title="Prescription Verification QR" />
                          <div className="mt-2 text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">
                            Dispensary Scan QR
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            {rx.prescription_number || rx.id.substring(0, 8)}
                          </div>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Rx</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Book Consultation Appointment Modal Dialog ─── */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-clinical-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Apply for Doctor OPD Consultation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Clinical Department:
                </label>
                {/* One-Tap Quick Selection Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  {departments.map((d) => {
                    const isSelected = selectedDept === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDept(d.id)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-clinical-600 bg-clinical-50/80 text-clinical-900 font-bold shadow-xs"
                            : "border-surface-200 bg-surface-50/60 text-slate-700 hover:border-clinical-300 hover:bg-white"
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight">{d.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
                          {d.code} {isSelected ? "✓ Selected" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none bg-white font-medium"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Preferred Consultation Date &amp; Time:
                </label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chief Complaint / Symptoms:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Persistent cough for 1 week, evening fatigue, mild throat irritation"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-clinical-50 p-3 text-clinical-900 text-[11px] leading-relaxed">
                Your consultation request will be directly queued in Dr. Ananya Sharma&apos;s OPD workspace. When accepted, you will receive an instant notification here.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setIsBookingOpen(false)}
                  className="rounded-xl border border-surface-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="rounded-xl bg-clinical-600 px-5 py-2 text-xs font-bold text-white hover:bg-clinical-700 shadow disabled:opacity-50"
                >
                  {isSubmittingBooking ? "Submitting..." : "Confirm & Queue with Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
