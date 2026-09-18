"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Building2,
  RefreshCw,
  PhoneCall,
  Play,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Filter,
} from "lucide-react";
import { OpdQueueEntry, FacilityDepartment, OpdQueueStatus } from "@/types/ecosystem";

export default function OpdQueuePage() {
  const facilityId = "fac-hyd-01";
  const [queue, setQueue] = useState<OpdQueueEntry[]>([]);
  const [departments, setDepartments] = useState<FacilityDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchQueueData = async () => {
    setIsLoading(true);
    try {
      // 1. Departments
      const deptRes = await fetch(`/api/facilities/${facilityId}/departments`);
      const deptData = await deptRes.json();
      if (deptRes.ok && deptData.departments) {
        setDepartments(deptData.departments);
      }

      // 2. Queue
      const qUrl = selectedDeptId === "ALL"
        ? `/api/opd/queue?facilityId=${facilityId}`
        : `/api/opd/queue?facilityId=${facilityId}&departmentId=${selectedDeptId}`;
      const qRes = await fetch(qUrl);
      const qData = await qRes.json();
      if (qRes.ok && qData.queue) {
        setQueue(qData.queue);
      }
    } catch (err) {
      console.error("Failed to load queue data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [selectedDeptId]);

  const handleStatusTransition = async (queueId: string, newStatus: OpdQueueStatus) => {
    setIsUpdating(queueId);
    try {
      const res = await fetch(`/api/opd/queue/${queueId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.queueEntry) {
        setQueue((prev) =>
          prev.map((item) => (item.id === queueId ? data.queueEntry : item))
        );
        setNotification(`Token ${data.queueEntry.token_number} transitioned to ${newStatus}`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to update queue entry");
      }
    } catch (err: any) {
      alert("Network error updating token status");
    } finally {
      setIsUpdating(null);
    }
  };

  const waitingCount = queue.filter((q) => q.status === "WAITING").length;
  const calledCount = queue.filter((q) => q.status === "CALLED").length;
  const consultingCount = queue.filter((q) => q.status === "IN_CONSULTATION").length;
  const doneCount = queue.filter((q) => q.status === "DONE").length;

  const activeCalledToken = queue.find((q) => q.status === "CALLED");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-clinical-100 px-3 py-1 text-xs font-bold text-clinical-800 uppercase tracking-wider">
              Hospital Reception & OPD Triage
            </span>
            <span className="text-xs text-slate-500">• AIIA Main Hospital</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Live OPD Queue & Token Dispatch
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time outpatient monitoring, automated calling display, and doctor case coordination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchQueueData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-clinical-600" : ""}`} />
            Refresh Queue
          </button>
          <Link
            href="/doctor"
            className="inline-flex items-center gap-2 rounded-xl bg-clinical-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
          >
            <Stethoscope className="h-4 w-4" /> Doctor Workspace
          </Link>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Calling Banner */}
      {activeCalledToken && (
        <div className="rounded-3xl border-2 border-clinical-500 bg-gradient-to-r from-clinical-600 to-clinical-800 p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white font-extrabold text-2xl shadow-inner">
              <PhoneCall className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-clinical-200 font-bold">
                Currently Calling Patient
              </div>
              <div className="text-3xl sm:text-4xl font-black mt-1">
                Token {activeCalledToken.token_number}
              </div>
              <div className="text-sm text-clinical-100 mt-1">
                {activeCalledToken.patient_name} • Proceed to {activeCalledToken.department_name} (Dr. {activeCalledToken.doctor_name || "Assigned Physician"})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleStatusTransition(activeCalledToken.id, "IN_CONSULTATION")}
              className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-clinical-800 shadow-md hover:bg-clinical-50 transition-colors"
            >
              Start Consultation &rarr;
            </button>
            <button
              type="button"
              onClick={() => handleStatusTransition(activeCalledToken.id, "NO_SHOW")}
              className="rounded-xl bg-red-600/80 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-600 transition-colors"
            >
              Mark No-Show
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Waiting</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600">{waitingCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">In waiting lounge</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Called</span>
            <PhoneCall className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-600">{calledCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Proceeding to cabin</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">In Consultation</span>
            <Stethoscope className="h-4 w-4 text-clinical-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-clinical-600">{consultingCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">With physician</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">{doneCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Consultation finished</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-surface-200">
        <Filter className="h-4 w-4 text-slate-400 flex-shrink-0 mr-1" />
        <button
          type="button"
          onClick={() => setSelectedDeptId("ALL")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            selectedDeptId === "ALL"
              ? "bg-clinical-600 text-white shadow-sm"
              : "bg-surface-100 text-slate-600 hover:bg-surface-200"
          }`}
        >
          All Departments ({queue.length})
        </button>
        {departments.map((dept) => {
          const count = queue.filter((q) => q.department_id === dept.id).length;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => setSelectedDeptId(dept.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDeptId === dept.id
                  ? "bg-clinical-600 text-white shadow-sm"
                  : "bg-surface-100 text-slate-600 hover:bg-surface-200"
              }`}
            >
              {dept.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Queue Table */}
      <div className="rounded-3xl border border-surface-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Queue Roster ({queue.length} Total Patients)
          </h2>
          <span className="text-xs text-slate-400">
            Auto-sorts by triage priority & check-in order
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No patients currently in this queue</p>
            <p className="mt-1 text-xs text-slate-400">Patients will appear here immediately after OPD check-in</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 text-slate-500 font-semibold border-b border-surface-200 text-xs">
                <tr>
                  <th className="px-6 py-3.5">Token</th>
                  <th className="px-6 py-3.5">Patient Details</th>
                  <th className="px-6 py-3.5">Department & Doctor</th>
                  <th className="px-6 py-3.5">Triage Priority</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Wait Time</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {queue.map((entry) => {
                  const isCurUpdating = isUpdating === entry.id;

                  return (
                    <tr key={entry.id} className="hover:bg-surface-50/60 transition-colors">
                      {/* Token */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-sm font-black bg-clinical-50 text-clinical-800 border border-clinical-200">
                          {entry.token_number}
                        </span>
                      </td>

                      {/* Patient Details */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{entry.patient_name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          ID: {entry.patient_id.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Department & Doctor */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{entry.department_name}</div>
                        <div className="text-xs text-slate-500">Dr. {entry.doctor_name || "On Duty"}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            entry.priority === "EMERGENCY"
                              ? "bg-red-100 text-red-800"
                              : entry.priority === "URGENT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {entry.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            entry.status === "WAITING"
                              ? "bg-amber-100 text-amber-800"
                              : entry.status === "CALLED"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : entry.status === "IN_CONSULTATION"
                              ? "bg-purple-100 text-purple-800"
                              : entry.status === "DONE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              entry.status === "WAITING"
                                ? "bg-amber-500"
                                : entry.status === "CALLED"
                                ? "bg-blue-500"
                                : entry.status === "IN_CONSULTATION"
                                ? "bg-purple-500"
                                : entry.status === "DONE"
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {entry.status}
                        </span>
                      </td>

                      {/* Wait Time */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {entry.estimated_wait_minutes} min
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.status === "WAITING" && (
                            <button
                              type="button"
                              disabled={isCurUpdating}
                              onClick={() => handleStatusTransition(entry.id, "CALLED")}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              Call
                            </button>
                          )}

                          {entry.status === "CALLED" && (
                            <button
                              type="button"
                              disabled={isCurUpdating}
                              onClick={() => handleStatusTransition(entry.id, "IN_CONSULTATION")}
                              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                            >
                              Consult
                            </button>
                          )}

                          {entry.status === "IN_CONSULTATION" && (
                            <button
                              type="button"
                              disabled={isCurUpdating}
                              onClick={() => handleStatusTransition(entry.id, "DONE")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Finish
                            </button>
                          )}

                          <Link
                            href={`/doctor/cases/${entry.case_id || "demo-case"}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface-50 shadow-sm transition-colors"
                            title="Open case in Doctor Workspace"
                          >
                            Open <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
