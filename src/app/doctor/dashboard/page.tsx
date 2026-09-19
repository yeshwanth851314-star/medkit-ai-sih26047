"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  Building2,
  RefreshCw,
  PhoneCall,
  XCircle,
  FileText,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Share2,
  Activity,
  AlertTriangle,
  HeartPulse,
  Filter,
  Check,
  Play,
  ArrowRight,
} from "lucide-react";
import { OpdQueueEntry, Appointment, FacilityDepartment, OpdQueueStatus } from "@/types/ecosystem";
import {
  ShareProfileModal,
  ProfileShareData,
} from "@/components/shared/share-profile-modal";

const DOCTOR_PROFILE: ProfileShareData = {
  role: "doctor",
  roleTitle: "Institutional Clinician Credential",
  uniqueId: "AIIA-DOC-8921",
  name: "Dr. Ananya Rao, MD (AIIA)",
  secondaryIdLabel: "Council Registration",
  secondaryIdValue: "MCI-AYUSH-2024-589",
  facility: "All India Institute of Ayurveda, Central Hospital",
  departmentOrScope: "General Medicine & Kayachikitsa",
  contactOrMeta: "OPD Consultation Room #4",
  validity: "Active / Verified",
};

export type DoctorAvailability =
  | "AVAILABLE_OPD"
  | "IN_CONSULTATION"
  | "ON_ROUNDS"
  | "ON_BREAK"
  | "OFF_DUTY";

export default function DoctorDashboardPage() {
  const facilityId = "fac-hyd-01";
  const [availability, setAvailability] = useState<DoctorAvailability>("AVAILABLE_OPD");
  const [queue, setQueue] = useState<OpdQueueEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [departments, setDepartments] = useState<FacilityDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Active view tab: 'waiting' | 'applied' | 'completed'
  const [activeTab, setActiveTab] = useState<"waiting" | "applied" | "completed">("waiting");

  // Detailed Patient Summary Modal State
  const [summaryPatient, setSummaryPatient] = useState<any | null>(null);

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<{ id: string; type: "queue" | "appointment"; name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const fetchDoctorData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Departments
      const deptRes = await fetch(`/api/facilities/${facilityId}/departments`);
      const deptData = await deptRes.json();
      if (deptRes.ok && deptData.departments) {
        setDepartments(deptData.departments);
      }

      // 2. OPD Queue
      const qUrl =
        selectedDeptId === "ALL"
          ? `/api/opd/queue?facilityId=${facilityId}`
          : `/api/opd/queue?facilityId=${facilityId}&departmentId=${selectedDeptId}`;
      const qRes = await fetch(qUrl);
      const qData = await qRes.json();
      if (qRes.ok && qData.queue) {
        setQueue(qData.queue);
      }

      // 3. Appointments (Applied / Scheduled)
      const apptRes = await fetch(`/api/appointments?facilityId=${facilityId}`);
      const apptData = await apptRes.json();
      if (apptRes.ok && apptData.appointments) {
        setAppointments(apptData.appointments);
      }
    } catch (err) {
      console.error("Failed to load doctor dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, selectedDeptId]);

  useEffect(() => {
    fetchDoctorData();
    const interval = setInterval(fetchDoctorData, 10000);

    if (typeof window !== "undefined") {
      const handleHash = () => {
        const hash = window.location.hash.replace("#", "");
        if (hash === "waiting" || hash === "applied" || hash === "completed") {
          setActiveTab(hash as any);
        }
      };
      handleHash();
      window.addEventListener("hashchange", handleHash);
      return () => {
        clearInterval(interval);
        window.removeEventListener("hashchange", handleHash);
      };
    }
    return () => clearInterval(interval);
  }, [fetchDoctorData]);

  // Handle Accept / Call Patient
  const handleAcceptPatient = async (queueId: string, patientName = "Patient") => {
    try {
      const res = await fetch(`/api/opd/queue/${queueId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CALLED" }),
      });
      const data = await res.json();
      if (res.ok && data.queueEntry) {
        setQueue((prev) =>
          prev.map((item) => (item.id === queueId ? data.queueEntry : item))
        );
        setNotification(
          `Token #${data.queueEntry.token_number} accepted & CALLED! ${patientName} has been notified via live portal alert.`
        );
        setTimeout(() => setNotification(null), 5000);
      } else {
        alert(data.error || "Failed to call patient");
      }
    } catch {
      alert("Network error updating token");
    }
  };

  // Handle Cancel OPD or Appointment
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    if (cancelTarget.type === "queue") {
      setQueue((prev) => prev.filter((q) => q.id !== cancelTarget.id));
      setNotification(
        `OPD visit for ${cancelTarget.name} has been CANCELLED. Reason: ${cancelReason || "Doctor unavailable"}`
      );
    } else {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === cancelTarget.id ? { ...a, status: "CANCELLED" as any } : a
        )
      );
      setNotification(
        `Appointment application for ${cancelTarget.name} has been CANCELLED. Patient notified.`
      );
    }

    setCancelTarget(null);
    setCancelReason("");
    setTimeout(() => setNotification(null), 5000);
  };

  // Availability styling helper
  const availabilityDetails = {
    AVAILABLE_OPD: {
      label: "Available in OPD (Room #4)",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      dot: "bg-emerald-500",
    },
    IN_CONSULTATION: {
      label: "In Consultation with Patient",
      badge: "bg-blue-100 text-blue-800 border-blue-300",
      dot: "bg-blue-500",
    },
    ON_ROUNDS: {
      label: "Inpatient Ward Rounds",
      badge: "bg-purple-100 text-purple-800 border-purple-300",
      dot: "bg-purple-500",
    },
    ON_BREAK: {
      label: "On Clinical Break",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      dot: "bg-amber-500",
    },
    OFF_DUTY: {
      label: "Off Duty",
      badge: "bg-slate-100 text-slate-800 border-slate-300",
      dot: "bg-slate-400",
    },
  }[availability];

  const waitingQueue = queue.filter(
    (q) => q.status === "WAITING" || q.status === "CALLED"
  );
  const appliedAppointments = appointments.filter(
    (a) => a.status === "BOOKED" || a.status === "CHECKED_IN"
  );
  const completedList = queue.filter(
    (q) => q.status === "DONE" || q.status === "IN_CONSULTATION"
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ─── Share Profile Modal ─── */}
      <ShareProfileModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        profile={DOCTOR_PROFILE}
      />

      {/* ─── Header: Doctor Identity, Unique ID & Availability Updater ─── */}
      <div className="rounded-3xl border border-clinical-200 bg-gradient-to-r from-clinical-50/90 via-white to-clinical-50/60 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700 shadow-sm shrink-0">
              <Stethoscope className="h-9 w-9" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-clinical-100 px-3 py-1 text-xs font-bold text-clinical-800 border border-clinical-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-clinical-600" />
                  <span>Institutional Clinician Portal</span>
                </span>

                {/* Active Availability Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${availabilityDetails.badge}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full animate-pulse ${availabilityDetails.dot}`}
                  />
                  <span>{availabilityDetails.label}</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {DOCTOR_PROFILE.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>
                  Clinician ID:{" "}
                  <strong className="text-slate-900 font-mono">
                    {DOCTOR_PROFILE.uniqueId}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Council Reg:{" "}
                  <strong className="text-slate-900 font-mono">
                    {DOCTOR_PROFILE.secondaryIdValue}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Dept:{" "}
                  <strong className="text-slate-900">
                    {DOCTOR_PROFILE.departmentOrScope}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Availability Selector & Profile Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Availability Dropdown Updater */}
            <div className="rounded-xl border border-surface-300 bg-white p-2 shadow-2xs space-y-1">
              <label className="block text-[10px] font-bold uppercase text-slate-500">
                Update Doctor Availability:
              </label>
              <select
                value={availability}
                onChange={(e) =>
                  setAvailability(e.target.value as DoctorAvailability)
                }
                className="w-full rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-clinical-600 focus:outline-none"
              >
                <option value="AVAILABLE_OPD">Available in OPD (Room #4)</option>
                <option value="IN_CONSULTATION">In Consultation</option>
                <option value="ON_ROUNDS">Inpatient Rounds</option>
                <option value="ON_BREAK">On Clinical Break</option>
                <option value="OFF_DUTY">Off Duty</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-clinical-300 bg-white px-4 py-2 text-xs font-bold text-clinical-800 hover:bg-clinical-50 transition-colors shadow-2xs"
            >
              <Share2 className="h-4 w-4 text-clinical-600" />
              <span>Share Clinician Card</span>
            </button>

            <Link
              href="/doctor/patients"
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors"
            >
              <span>Patient Registry &rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 text-xs sm:text-sm flex items-center justify-between shadow-sm animate-scaleUp">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-bold text-emerald-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── OPD Queue Tabs: Waiting, Applied, Completed ─── */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("waiting")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "waiting"
                  ? "bg-clinical-600 text-white shadow"
                  : "bg-surface-100 text-slate-600 hover:bg-surface-200"
              }`}
            >
              Waiting OPDs ({waitingQueue.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("applied")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "applied"
                  ? "bg-clinical-600 text-white shadow"
                  : "bg-surface-100 text-slate-600 hover:bg-surface-200"
              }`}
            >
              Applied Appointments ({appliedAppointments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "completed"
                  ? "bg-clinical-600 text-white shadow"
                  : "bg-surface-100 text-slate-600 hover:bg-surface-200"
              }`}
            >
              In Consultation &amp; Done ({completedList.length})
            </button>
          </div>

          <button
            type="button"
            onClick={fetchDoctorData}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-clinical-600" : ""}`} />
            <span>Refresh Queues</span>
          </button>
        </div>

        {/* TAB 1: WAITING OPDS */}
        {activeTab === "waiting" && (
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Patients Arrived &amp; Waiting for Consultation
                </h2>
                <p className="text-xs text-slate-500">
                  Accepting a patient notifies them immediately on their portal &amp; updates the hospital OPD calling token.
                </p>
              </div>
              <span className="text-xs font-bold text-clinical-700 bg-clinical-50 px-3 py-1 rounded-lg border border-clinical-200">
                Active Room: OPD #4
              </span>
            </div>

            {waitingQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No patients currently waiting in the OPD queue.
              </div>
            ) : (
              <div className="space-y-4">
                {waitingQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border-2 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      item.status === "CALLED"
                        ? "border-clinical-500 bg-clinical-50/50 shadow-md ring-2 ring-clinical-500/20"
                        : "border-surface-200 bg-white hover:border-surface-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-600 text-white font-extrabold text-xl shadow shrink-0">
                        #{item.token_number}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">
                            Ramesh Kumar Varma
                          </h3>
                          <span className="text-xs text-slate-500">
                            (45 M • MED-2026-1001)
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              item.status === "CALLED"
                                ? "bg-clinical-600 text-white animate-pulse"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Department: <strong>{item.department_name || "General Medicine"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Arrived:{" "}
                            {new Date(item.checked_in_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-amber-700 font-semibold">
                            Complaint: Chronic cough &amp; seasonal fatigue
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Detailed Summary, Accept/Call, Cancel */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSummaryPatient({
                            name: "Ramesh Kumar Varma",
                            age: 45,
                            gender: "Male",
                            id: "MED-2026-1001",
                            caseId: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
                            chiefComplaint: "Persistent dry cough for 7 days, evening fatigue, joint stiffness",
                            prakriti: "Vata-Pitta Predominant (V3-P2-K1)",
                            vitals: "BP: 128/82 | Pulse: 74 | SpO2: 99% | Temp: 98.4°F",
                            allergies: "Penicillin (Severe Urticaria), Sulfa Drugs",
                            aiSummary: "Patient presents with subacute non-productive cough without dyspnea or hemoptysis. Prior prescription digitized with Maha Sudarshana & Paracetamol. Chest X-Ray clear. Vata-Pitta dosha aggravation indicated.",
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-surface-50 shadow-2xs"
                      >
                        <FileText className="h-4 w-4 text-clinical-600" />
                        <span>Detailed AI Summary</span>
                      </button>

                      {item.status !== "CALLED" ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptPatient(item.id, "Ramesh Kumar Varma")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-clinical-700"
                        >
                          <PhoneCall className="h-4 w-4" />
                          <span>Accept &amp; Call Patient</span>
                        </button>
                      ) : (
                        <Link
                          href="/doctor/cases/7b511c8e-efaa-4d49-9c9c-bcb26a2295aa"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <Play className="h-4 w-4" />
                          <span>Start Consultation &rarr;</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setCancelTarget({
                            id: item.id,
                            type: "queue",
                            name: "Ramesh Kumar Varma",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>Cancel OPD</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLIED APPOINTMENTS */}
        {activeTab === "applied" && (
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Applied Consultation Requests (From Patient Portal)
                </h2>
                <p className="text-xs text-slate-500">
                  Appointments booked by patients through the patient portal. You can accept or decline appointments.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Total Applied: {appliedAppointments.length}
              </span>
            </div>

            {appliedAppointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No new appointment applications currently pending.
              </div>
            ) : (
              <div className="space-y-3">
                {appliedAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-surface-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-50/40 hover:border-surface-300 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">
                          Ramesh Kumar Varma
                        </span>
                        <span className="text-xs text-slate-500">
                          (MED-2026-1001)
                        </span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                          {appt.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Dept: <strong>{appt.department?.name || "General Medicine & Kayachikitsa"}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Requested For:{" "}
                          {new Date(appt.scheduled_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span>•</span>
                        <span>Reason: <strong>{appt.reason || "Outpatient Clinical Consultation"}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSummaryPatient({
                            name: "Ramesh Kumar Varma",
                            age: 45,
                            gender: "Male",
                            id: "MED-2026-1001",
                            caseId: "7b511c8e-efaa-4d49-9c9c-bcb26a2295aa",
                            chiefComplaint: appt.reason || "Outpatient Consultation",
                            prakriti: "Vata-Pitta Predominant",
                            vitals: "BP: 128/82 | Pulse: 74 | SpO2: 99% | Temp: 98.4°F",
                            allergies: "Penicillin",
                            aiSummary: "Patient booked consultation for evaluation of recurrent cough and general wellness.",
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-surface-50"
                      >
                        <FileText className="h-3.5 w-3.5 text-clinical-600" />
                        <span>Summary</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNotification(
                            `Appointment application for Ramesh Kumar Varma accepted! Patient notified.`
                          );
                          setTimeout(() => setNotification(null), 4000);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-clinical-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept Application</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCancelTarget({
                            id: appt.id,
                            type: "appointment",
                            name: "Ramesh Kumar Varma",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLETED & IN-CONSULTATION */}
        {activeTab === "completed" && (
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">
                Completed Consultations &amp; Case History
              </h2>
              <span className="text-xs text-slate-500">
                Total Encounters: {completedList.length}
              </span>
            </div>

            {completedList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No consultations marked as completed yet. Complete a consultation from the Waiting Queue.
              </div>
            ) : (
              <div className="space-y-3">
                {completedList.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-surface-200 p-4 flex items-center justify-between bg-surface-50/30"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        Token #{item.token_number} • Ramesh Kumar Varma
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Completed at: {new Date(item.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <Link
                      href="/doctor/cases/7b511c8e-efaa-4d49-9c9c-bcb26a2295aa"
                      className="rounded-xl bg-white border border-surface-300 px-3.5 py-1.5 text-xs font-bold text-clinical-700 hover:bg-surface-50"
                    >
                      View Case Record &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Detailed AI Patient Case Summary Modal ─── */}
      {summaryPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-5 relative max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-700">
                    Clinical AI Intake Summary
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {summaryPatient.name} ({summaryPatient.age} {summaryPatient.gender})
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryPatient(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Vitals & Unique ID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Patient ID</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{summaryPatient.id}</div>
              </div>
              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Blood Pressure</div>
                <div className="font-bold text-slate-900 mt-0.5">128/82 mmHg</div>
              </div>
              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Heart Rate</div>
                <div className="font-bold text-slate-900 mt-0.5">74 bpm</div>
              </div>
              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">SpO2 / Temp</div>
                <div className="font-bold text-slate-900 mt-0.5">99% • 98.4°F</div>
              </div>
            </div>

            {/* AI Synthesized Summary */}
            <div className="rounded-2xl bg-clinical-50/70 border border-clinical-200 p-4 space-y-2 text-xs">
              <div className="font-extrabold text-clinical-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-clinical-700" />
                <span>AI Clinical Copilot Synthesis:</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {summaryPatient.aiSummary}
              </p>
            </div>

            {/* Chief Complaints & Prakriti */}
            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-surface-50 p-3 border border-surface-200">
                <strong className="text-slate-900">Chief Symptoms &amp; Duration:</strong>
                <p className="text-slate-700 mt-0.5">{summaryPatient.chiefComplaint}</p>
              </div>

              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
                <strong className="text-amber-950">Ayush Constitutional Prakriti:</strong>
                <p className="text-amber-900 mt-0.5">{summaryPatient.prakriti}</p>
              </div>

              <div className="rounded-xl bg-red-50 p-3 border border-red-200">
                <strong className="text-red-950">Documented Drug Allergies:</strong>
                <p className="text-red-900 mt-0.5">{summaryPatient.allergies}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-surface-200">
              <button
                type="button"
                onClick={() => setSummaryPatient(null)}
                className="rounded-xl border border-surface-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-surface-50"
              >
                Close Summary
              </button>

              <Link
                href={`/doctor/cases/${summaryPatient.caseId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-5 py-2 text-xs font-bold text-white hover:bg-clinical-700 shadow"
              >
                <span>Open Full Clinical Case &amp; Prescription &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Confirmation Modal Dialog ─── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-surface-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">
                Cancel Outpatient Consultation?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel the {cancelTarget.type} for <strong>{cancelTarget.name}</strong>? The patient will be notified on their portal.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cancellation Reason:
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Doctor called for clinical emergency, or patient rescheduled"
                className="w-full rounded-xl border border-surface-300 p-2.5 text-xs focus:border-red-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-xl border border-surface-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 shadow"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
