"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { DEMO_PATIENT_ID, DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";
import { Appointment, OpdQueueEntry, Prescription, DiagnosticOrder, FacilityDepartment } from "@/types/ecosystem";
import { TimelineMilestone } from "@/features/timeline/types";

export default function PatientPortalPage() {
  const [patientId] = useState(DEMO_PATIENT_ID);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueEntry, setQueueEntry] = useState<OpdQueueEntry | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [diagnosticOrders, setDiagnosticOrders] = useState<DiagnosticOrder[]>([]);
  const [timeline, setTimeline] = useState<TimelineMilestone[]>([]);
  const [departments, setDepartments] = useState<FacilityDepartment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bookingReason, setBookingReason] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadPatientData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Appointments
      const apptRes = await fetch(`/api/appointments?patientId=${patientId}`);
      const apptData = await apptRes.json();
      if (apptRes.ok && apptData.appointments) {
        setAppointments(apptData.appointments);

        // Find active checked-in appointment to find queue token
        const checkedInAppt = apptData.appointments.find(
          (a: Appointment) => a.status === "CHECKED_IN" || a.status === "IN_CONSULTATION"
        );
        if (checkedInAppt) {
          const qRes = await fetch(`/api/opd/queue?facilityId=${checkedInAppt.facility_id}`);
          const qData = await qRes.json();
          if (qRes.ok && qData.queue) {
            const myQueue = qData.queue.find(
              (q: OpdQueueEntry) => q.appointment_id === checkedInAppt.id
            );
            if (myQueue) setQueueEntry(myQueue);
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
        if (deptData.departments.length > 0) {
          setSelectedDept(deptData.departments[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load patient data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
    if (typeof window !== "undefined" && window.location.search.includes("book=true")) {
      setIsBookingOpen(true);
    }
  }, [patientId]);

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
        setActionSuccessMessage(`Successfully checked in! Your OPD Token is #${data.queueEntry.token_number}.`);
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
      const scheduledTime = selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString();
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
        setActionSuccessMessage("Consultation appointment successfully booked!");
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
                <span>Verified Patient Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                {DEMO_QUICK_ACCESS.patient.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                <span>Patient ID: <strong className="text-slate-800">{DEMO_QUICK_ACCESS.patient.demoId}</strong></span>
                <span>•</span>
                <span>ABHA Number: <strong className="text-slate-800">{DEMO_QUICK_ACCESS.patient.abhaId}</strong></span>
                <span>•</span>
                <span>Primary Facility: <strong className="text-slate-800">AIIA Hospital (fac-hyd-01)</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/intake/new"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-clinical-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start Voice Case Intake &rarr;</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:bg-surface-50 transition-colors"
            >
              <PlusCircle className="h-4 w-4 text-slate-500" />
              <span>Book Appointment</span>
            </button>
            <button
              type="button"
              onClick={loadPatientData}
              title="Refresh Records"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-surface-200 bg-white text-slate-600 hover:bg-surface-100"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-clinical-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

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
              <div className="text-xs font-bold uppercase tracking-wider text-clinical-800">Active OPD Queue Token</div>
              <div className="text-lg font-bold text-slate-900">
                Token #{queueEntry.token_number} • {queueEntry.department_name || "General Medicine"}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Current Status: <strong className="text-clinical-700 uppercase">{queueEntry.status}</strong> • Arrived at {new Date(queueEntry.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

      {/* ─── Main Content Grid: Appointments & Diagnostics & Prescriptions ─── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Appointments, Diagnostics & Prescriptions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Section 1: Upcoming Appointments */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-clinical-600" />
                <h2 className="text-base font-bold text-slate-900">My Consultation Appointments</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(true)}
                className="text-xs font-semibold text-clinical-600 hover:text-clinical-800"
              >
                + Book New
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No appointments currently booked. Complete clinical intake or book an appointment above.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-surface-200 p-4 gap-3 hover:border-surface-300 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {appt.department?.name || "General Medicine"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            appt.status === "CHECKED_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : appt.status === "IN_CONSULTATION"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-surface-100 text-slate-700"
                          }`}
                        >
                          {appt.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(appt.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                        <span>•</span>
                        <span>{appt.reason || "Consultation"}</span>
                      </div>
                    </div>

                    {appt.status === "BOOKED" && (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(appt.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Check In &amp; Get Token</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Prescriptions & Pharmacy Status */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Prescriptions &amp; Pharmacy Status</h2>
              </div>
              <Link
                href="/pharmacy/queue"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Hospital Dispensary &rarr;
              </Link>
            </div>

            {prescriptions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No prescriptions issued yet. Consultations and doctor-finalized prescriptions will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="rounded-xl border border-surface-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-800">
                        Prescribed by {rx.prescriber_name || "Doctor"} • {new Date(rx.created_at).toLocaleDateString()}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                          rx.status === "DISPENSED"
                            ? "bg-emerald-100 text-emerald-800"
                            : rx.status === "PARTIALLY_DISPENSED"
                            ? "bg-amber-100 text-amber-800"
                            : rx.status === "FINAL"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-surface-100 text-slate-600"
                        }`}
                      >
                        {rx.status === "DISPENSED"
                          ? "Dispensed at Pharmacy"
                          : rx.status === "FINAL"
                          ? "Approved & Ready for Pickup"
                          : rx.status}
                      </span>
                    </div>

                    <div className="divide-y divide-surface-100 border-t border-surface-100 pt-2">
                      {(rx.items || []).map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-900">{item.medicine_name} {item.strength || ""}</div>
                            <div className="text-slate-500">
                              {item.dose} • {item.frequency} • {item.duration} {item.instructions ? `• ${item.instructions}` : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-slate-700">Qty: {item.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Diagnostic Laboratory Investigations */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                <h2 className="text-base font-bold text-slate-900">Laboratory Investigations &amp; Reports</h2>
              </div>
              <Link
                href="/diagnostics/queue"
                className="text-xs font-semibold text-purple-600 hover:text-purple-800"
              >
                Diagnostic Portal &rarr;
              </Link>
            </div>

            {diagnosticOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No diagnostic investigations ordered yet. Ordered lab tests and verified results will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {diagnosticOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-surface-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-slate-900">
                        {(order.items || []).map((i) => i.test_name_snapshot).join(", ")}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          order.status === "REVIEWED"
                            ? "bg-emerald-100 text-emerald-800"
                            : order.status === "RESULT_AVAILABLE"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      Ordered: {new Date(order.ordered_at).toLocaleString()} • Priority: {order.priority}
                    </div>

                    {order.results && order.results.length > 0 && (
                      <div className="rounded-lg bg-surface-50 p-3 mt-2 text-xs space-y-2">
                        <div className="font-bold text-slate-800">Verified Result Values:</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(order.results[0].result_json || {}).map(([key, val]: any) => (
                            <div key={key} className="rounded bg-white p-2 border border-surface-200">
                              <div className="text-[10px] text-slate-400 font-semibold">{val?.label || key}</div>
                              <div className="font-bold text-slate-900">{val?.value ?? String(val)} {val?.unit || ""}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Unified Longitudinal Timeline */}
        <div className="space-y-8">
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-clinical-600" />
                <h2 className="text-base font-bold text-slate-900">My Clinical Journey Timeline</h2>
              </div>
            </div>

            {timeline.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No timeline events recorded yet. Complete intake to begin.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
                {timeline.slice(0, 10).map((item) => (
                  <div key={item.id} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                        item.badgeVariant === "success"
                          ? "bg-emerald-500"
                          : item.badgeVariant === "danger"
                          ? "bg-red-500"
                          : item.badgeVariant === "warning"
                          ? "bg-amber-500"
                          : item.badgeVariant === "purple"
                          ? "bg-purple-500"
                          : "bg-clinical-500"
                      }`}
                    />
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {new Date(item.timestamp).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Book Appointment Modal Dialog ─── */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Book Outpatient Consultation</h3>
              <button
                type="button"
                onClick={() => setIsBookingOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date &amp; Preferred Time
                </label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Visit / Chief Symptoms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever and cough for 3 days"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
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
                  {isSubmittingBooking ? "Booking..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
