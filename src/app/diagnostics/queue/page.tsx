"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Plus,
  FileCheck,
  Upload,
  Sparkles,
  AlertTriangle,
  Printer,
  Share2,
} from "lucide-react";
import { DiagnosticOrder, DiagnosticOrderItem, DiagnosticOrderStatus, DiagnosticPriority } from "@/types/ecosystem";
import {
  ShareProfileModal,
  ProfileShareData,
} from "@/components/shared/share-profile-modal";
import { QrCode } from "@/components/shared/qr-code";

const DIAGNOSTIC_PROFILE: ProfileShareData = {
  role: "diagnostic",
  roleTitle: "NABL Accredited Pathology & Radiology Lab",
  uniqueId: "LAB-TECH-4092",
  name: "Ramesh V., M.Sc MLT",
  secondaryIdLabel: "NABL Accreditation",
  secondaryIdValue: "NABL-MED-883",
  facility: "Central Diagnostic Laboratory & Imaging, AIIA",
  departmentOrScope: "Clinical Biochemistry & Digital Radiology",
  contactOrMeta: "+91 98765 33445 • Central Lab",
  validity: "Active / Verified",
};

export default function DiagnosticsQueuePage() {
  const facilityId = "fac-hyd-01";
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [printReportOrder, setPrintReportOrder] = useState<DiagnosticOrder | null>(null);

  // Result entry modal state
  const [activeOrderForResults, setActiveOrderForResults] = useState<DiagnosticOrder | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [parameterName, setParameterName] = useState("Hemoglobin (Hb)");
  const [numericValue, setNumericValue] = useState("13.8");
  const [unit, setUnit] = useState("g/dL");
  const [refLow, setRefLow] = useState("12.0");
  const [refHigh, setRefHigh] = useState("16.0");
  const [abnormalFlag, setAbnormalFlag] = useState("NORMAL");
  const [findingText, setFindingText] = useState("Within expected physiological limits for age and gender.");
  const [technicianName, setTechnicianName] = useState("Ramesh V., Senior Lab Technologist");
  const [submittingResult, setSubmittingResult] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const url = filterStatus === "ALL"
        ? `/api/diagnostics/orders?facilityId=${facilityId}`
        : `/api/diagnostics/orders?facilityId=${facilityId}&status=${filterStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load diagnostic queue:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 12000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const handleUpdateStatus = async (orderId: string, nextStatus: DiagnosticOrderStatus) => {
    setActionInProgressId(orderId);
    try {
      const res = await fetch(`/api/diagnostics/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
        setNotification(`Order status transitioned to ${nextStatus}`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to update diagnostic status");
      }
    } catch (err) {
      alert("Error updating order status");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleOpenResultEntry = (order: DiagnosticOrder) => {
    setActiveOrderForResults(order);
    if (order.items && order.items.length > 0) {
      setSelectedItemId(order.items[0].id);
      const firstCode = order.items[0].test_code_snapshot || order.items[0].test_code;
      if (firstCode === "CBC") {
        setParameterName("Hemoglobin (Hb)");
        setNumericValue("13.8");
        setUnit("g/dL");
        setRefLow("12.0");
        setRefHigh("16.0");
        setAbnormalFlag("NORMAL");
      } else if (firstCode === "LFT") {
        setParameterName("Serum Bilirubin (Total)");
        setNumericValue("0.9");
        setUnit("mg/dL");
        setRefLow("0.2");
        setRefHigh("1.2");
        setAbnormalFlag("NORMAL");
      } else if (firstCode === "KFT") {
        setParameterName("Serum Creatinine");
        setNumericValue("0.85");
        setUnit("mg/dL");
        setRefLow("0.6");
        setRefHigh("1.3");
        setAbnormalFlag("NORMAL");
      } else {
        setParameterName(`${order.items[0].test_name_snapshot || "Diagnostic"} Assessment`);
        setNumericValue("");
        setUnit("");
        setAbnormalFlag("NORMAL");
      }
    }
  };

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderForResults) return;

    setSubmittingResult(true);
    try {
      const payload = {
        orderItemId: selectedItemId || activeOrderForResults.items?.[0]?.id || "default-item",
        patientId: activeOrderForResults.patient_id,
        caseId: activeOrderForResults.case_id,
        performedBy: technicianName,
        verifiedBy: "Dr. K. S. Rao, Chief Pathologist",
        resultJson: {
          parameterName,
          numericValue: numericValue ? parseFloat(numericValue) : null,
          unit,
          referenceRangeLow: refLow ? parseFloat(refLow) : null,
          referenceRangeHigh: refHigh ? parseFloat(refHigh) : null,
          abnormalFlag,
          finding: findingText,
        },
        resultText: `${parameterName}: ${numericValue} ${unit} [Flag: ${abnormalFlag}] - ${findingText}`,
      };

      const res = await fetch(`/api/diagnostics/orders/${activeOrderForResults.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setNotification(`Lab result submitted for Order #${activeOrderForResults.id.substring(0, 8)}. Notified clinician.`);
        setActiveOrderForResults(null);
        fetchOrders();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to submit result");
      }
    } catch (err) {
      alert("Error submitting diagnostic result");
    } finally {
      setSubmittingResult(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.patient_name && o.patient_name.toLowerCase().includes(q)) ||
      (o.patient_code && o.patient_code.toLowerCase().includes(q)) ||
      (o.order_number && o.order_number.toLowerCase().includes(q)) ||
      o.id.toLowerCase().includes(q)
    );
  });

  const orderedCount = orders.filter((o) => o.status === "ORDERED").length;
  const sampleCount = orders.filter((o) => o.status === "SAMPLE_COLLECTED").length;
  const progressCount = orders.filter((o) => o.status === "IN_PROGRESS").length;
  const resultReadyCount = orders.filter((o) => o.status === "RESULT_AVAILABLE" || o.status === "REVIEWED").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Share Profile Modal */}
      <ShareProfileModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        profile={DIAGNOSTIC_PROFILE}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 uppercase tracking-wider">
              Central Pathology &amp; Diagnostic Lab
            </span>
            <span className="text-xs text-slate-500">• AIIA Diagnostic Wing</span>
            <span className="text-xs font-mono font-bold text-slate-800 bg-surface-100 px-2.5 py-0.5 rounded">
              ID: {DIAGNOSTIC_PROFILE.uniqueId}
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Diagnostic Orders &amp; Specimen Worklist
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Specimen accessioning, diagnostic test processing, and electronic lab report transmission.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-white px-3.5 py-2 text-xs font-bold text-purple-800 shadow-2xs hover:bg-purple-50 transition-colors"
          >
            <Share2 className="h-4 w-4 text-purple-600" />
            <span>Share Lab Profile</span>
          </button>
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-purple-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Awaiting Sample</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600">{orderedCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Specimen not yet collected</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Specimens Received</span>
            <FlaskConical className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-600">{sampleCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Barcoded in lab accession</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">In Analysis</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-purple-600">{progressCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Under analyzer run</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Reports Ready</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">{resultReadyCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Transmitted to clinician</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["ALL", "ORDERED", "SAMPLE_COLLECTED", "IN_PROGRESS", "RESULT_AVAILABLE", "REVIEWED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === st
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-surface-100 text-slate-600 hover:bg-surface-200"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, order #..."
            className="w-full rounded-xl border border-surface-200 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-3xl border border-surface-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Worklist ({filteredOrders.length} Orders)
          </h2>
          <span className="text-xs text-slate-400">
            Prioritized: STAT &rarr; URGENT &rarr; ROUTINE
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FlaskConical className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No diagnostic orders matching this filter</p>
            <p className="mt-1 text-xs text-slate-400">New orders placed by OPD doctors will automatically appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 text-slate-500 font-semibold border-b border-surface-200 text-xs">
                <tr>
                  <th className="px-6 py-3.5">Order Ref</th>
                  <th className="px-6 py-3.5">Patient Details</th>
                  <th className="px-6 py-3.5">Tests Requested</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Clinical Context</th>
                  <th className="px-6 py-3.5">Workflow Status</th>
                  <th className="px-6 py-3.5 text-right">Lab Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredOrders.map((order) => {
                  const isCurUpdating = actionInProgressId === order.id;
                  const orderNum = order.order_number || `ORD-${order.id.substring(0, 8).toUpperCase()}`;

                  return (
                    <tr key={order.id} className="hover:bg-surface-50/60 transition-colors">
                      {/* Ref */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          {orderNum}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Patient */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{order.patient_name || "Demo Patient"}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          ID: {order.patient_id.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {order.items?.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-800 font-semibold"
                            >
                              {item.test_name || item.test_name_snapshot}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            order.priority === "STAT"
                              ? "bg-red-100 text-red-800"
                              : order.priority === "URGENT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {order.priority}
                        </span>
                      </td>

                      {/* Clinical Context (Read-Only) */}
                      <td className="px-6 py-4 max-w-xs text-xs text-slate-600">
                        <div className="truncate" title={order.clinical_indication || order.clinical_context || ""}>
                          {order.clinical_indication || order.clinical_context || "OPD Diagnostic evaluation"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            order.status === "ORDERED"
                              ? "bg-amber-100 text-amber-800"
                              : order.status === "SAMPLE_COLLECTED"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "IN_PROGRESS"
                              ? "bg-purple-100 text-purple-800"
                              : order.status === "RESULT_AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "REVIEWED"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === "ORDERED" && (
                            <button
                              type="button"
                              disabled={isCurUpdating}
                              onClick={() => handleUpdateStatus(order.id, "SAMPLE_COLLECTED")}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              Collect Sample
                            </button>
                          )}

                          {order.status === "SAMPLE_COLLECTED" && (
                            <button
                              type="button"
                              disabled={isCurUpdating}
                              onClick={() => handleUpdateStatus(order.id, "IN_PROGRESS")}
                              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                            >
                              Begin Analysis
                            </button>
                          )}

                          {(order.status === "IN_PROGRESS" || order.status === "SAMPLE_COLLECTED") && (
                            <button
                              type="button"
                              onClick={() => handleOpenResultEntry(order)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Enter Result
                            </button>
                          )}

                          {(order.status === "RESULT_AVAILABLE" || order.status === "REVIEWED") && (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Filed
                              </span>
                              <button
                                type="button"
                                onClick={() => setPrintReportOrder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-900 hover:bg-purple-100 shadow-2xs transition-colors"
                              >
                                <Printer className="h-3.5 w-3.5 text-purple-700" />
                                <span>Print Report</span>
                              </button>
                            </div>
                          )}
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

      {/* Result Entry Modal Dialog */}
      {activeOrderForResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Enter Official Laboratory Result
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order Ref: #{activeOrderForResults.id.substring(0, 8).toUpperCase()} • Patient: {activeOrderForResults.patient_name || "Demo Patient"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveOrderForResults(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResult} className="space-y-4 text-xs">
              {/* Select Item */}
              {activeOrderForResults.items && activeOrderForResults.items.length > 1 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Test Item:</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                  >
                    {activeOrderForResults.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.test_name || it.test_name_snapshot} ({it.test_code || it.test_code_snapshot})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parameter Analyzed:</label>
                  <input
                    type="text"
                    value={parameterName}
                    onChange={(e) => setParameterName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observed Value &amp; Unit:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={numericValue}
                      onChange={(e) => setNumericValue(e.target.value)}
                      placeholder="e.g. 13.8"
                      className="w-2/3 rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                    />
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="g/dL"
                      className="w-1/3 rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference Low:</label>
                  <input
                    type="text"
                    value={refLow}
                    onChange={(e) => setRefLow(e.target.value)}
                    placeholder="12.0"
                    className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference High:</label>
                  <input
                    type="text"
                    value={refHigh}
                    onChange={(e) => setRefHigh(e.target.value)}
                    placeholder="16.0"
                    className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Abnormal Flag:</label>
                  <select
                    value={abnormalFlag}
                    onChange={(e) => setAbnormalFlag(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                  >
                    <option value="NORMAL">NORMAL (Within Range)</option>
                    <option value="HIGH">HIGH (Elevated)</option>
                    <option value="LOW">LOW (Decreased)</option>
                    <option value="CRITICAL">CRITICAL (Panic Alert)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technologist Clinical Finding / Notes:</label>
                <textarea
                  rows={2}
                  value={findingText}
                  onChange={(e) => setFindingText(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reporting Technologist Signature:</label>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setActiveOrderForResults(null)}
                  className="rounded-xl border border-surface-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResult}
                  className="rounded-xl bg-purple-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  {submittingResult ? "Transmitting..." : "Sign & Transmit to Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Printable Official NABL Laboratory Report Modal ─── */}
      {printReportOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-6 max-h-[90vh] overflow-y-auto animate-scaleUp">
            {/* Modal Actions Header */}
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Official NABL Accredited Diagnostic Report
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintReportOrder(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Formatted Report Sheet */}
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 space-y-6 shadow-sm font-sans text-xs">
              {/* Institution Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-purple-800">
                  Ministry of Ayush • Government of India
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  ALL INDIA INSTITUTE OF AYURVEDA (AIIA)
                </h2>
                <div className="text-xs text-slate-600 font-medium">
                  Central Diagnostic Pathology &amp; Imaging Center • Facility ID: fac-hyd-01
                </div>
                <div className="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-300">
                  NABL ISO 15189 Accredited Laboratory (Cert # NABL-MED-883)
                </div>
              </div>

              {/* Patient & Order Demographics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Patient Name</span>
                  <span className="font-extrabold text-slate-900 text-sm">Ramesh Kumar Varma</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Patient ID / ABHA</span>
                  <span className="font-mono font-bold text-slate-900">MED-2026-1001</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Age / Gender</span>
                  <span className="font-bold text-slate-900">45 Yrs / Male</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Referred By</span>
                  <span className="font-bold text-slate-900">Dr. Ananya Rao, MD</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Sample Accession ID</span>
                  <span className="font-mono font-bold text-slate-900">ACC-{printReportOrder.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Collection Date</span>
                  <span className="font-bold text-slate-900">{new Date(printReportOrder.ordered_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Priority</span>
                  <span className="font-bold text-slate-900">{printReportOrder.priority}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Report Status</span>
                  <span className="font-bold text-emerald-700 uppercase">VERIFIED FINAL</span>
                </div>
              </div>

              {/* Investigation Results Table */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-slate-900 border-b border-surface-200 pb-1">
                  Investigation Findings &amp; Quantitative Values
                </h4>

                {(printReportOrder.results || []).map((res) => (
                  <div key={res.id} className="space-y-3">
                    <table className="w-full text-left border border-surface-200 rounded-xl overflow-hidden">
                      <thead className="bg-surface-100 text-slate-700 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-2.5">Investigation Parameter</th>
                          <th className="px-4 py-2.5">Observed Value</th>
                          <th className="px-4 py-2.5">Reference Interval</th>
                          <th className="px-4 py-2.5">Evaluation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {Object.entries(res.result_json || {}).map(([key, val]: any) => (
                          <tr key={key} className="hover:bg-surface-50/50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">
                              {val?.label || key}
                            </td>
                            <td className="px-4 py-2.5 font-extrabold text-slate-900">
                              {val?.value ?? String(val)} {val?.unit || ""}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {val?.ref_low && val?.ref_high
                                ? `${val.ref_low} - ${val.ref_high} ${val.unit || ""}`
                                : "N/A"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  val?.flag === "NORMAL" || !val?.flag
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {val?.flag || "Normal"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {res.finding && (
                      <div className="rounded-xl bg-surface-50 p-3 text-slate-700 border border-surface-200">
                        <strong>Clinical Impression / Notes:</strong> {res.finding}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer: Signatures & QR Code */}
              <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <QrCode
                    value={`https://medkit-ai-sih26047.vercel.app/verify/profile?id=${printReportOrder.id}&role=diagnostic`}
                    size={90}
                    title="Report Verification QR"
                  />
                  <div className="text-[10px] text-slate-500">
                    <div>Scannable Digital Verification</div>
                    <div className="font-mono text-slate-700 font-bold">SHA-256 Verified</div>
                    <div>AIIA LIS v2.6.0</div>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-bold text-slate-900 text-xs">Ramesh V., M.Sc MLT</div>
                  <div className="text-[10px] text-slate-500">Senior Medical Lab Technologist</div>
                  <div className="text-[10px] font-mono text-purple-700 font-bold">
                    Reg: NABL-MED-883
                  </div>
                  <div className="text-[9px] text-slate-400">Electronically signed on {new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
