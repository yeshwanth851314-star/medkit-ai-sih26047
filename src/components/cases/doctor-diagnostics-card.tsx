"use client";

import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { DiagnosticOrder, DiagnosticCatalogItem, DiagnosticResult } from "@/types/ecosystem";

interface DoctorDiagnosticsCardProps {
  caseId: string;
  patientId: string;
  facilityId?: string;
  initialOrders?: DiagnosticOrder[];
}

export function DoctorDiagnosticsCard({
  caseId,
  patientId,
  facilityId = "fac-hyd-01",
  initialOrders = [],
}: DoctorDiagnosticsCardProps) {
  const [orders, setOrders] = useState<DiagnosticOrder[]>(initialOrders);
  const [catalog, setCatalog] = useState<DiagnosticCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [clinicalIndication, setClinicalIndication] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/diagnostics/orders?patientId=${patientId}&caseId=${caseId}`);
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load diagnostic orders:", err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch("/api/diagnostics/catalog");
      const data = await res.json();
      if (res.ok && data.catalog) {
        setCatalog(data.catalog);
      }
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCatalog();
  }, [caseId, patientId]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTests.length === 0) {
      alert("Please select at least one test to order.");
      return;
    }

    setSubmitting(true);
    try {
      const items = selectedTests.map((testCode) => {
        const cat = catalog.find((c) => (c.code || c.test_code) === testCode);
        return {
          testCode,
          testName: cat?.name || cat?.test_name || testCode,
          category: cat?.category || "pathology",
        };
      });

      const res = await fetch("/api/diagnostics/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          caseId,
          facilityId,
          clinicalIndication: clinicalIndication || "Diagnostic evaluation during outpatient encounter",
          priority,
          items,
        }),
      });

      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) => [data.order, ...prev]);
        setIsOrdering(false);
        setSelectedTests([]);
        setClinicalIndication("");
        setNotification(`Diagnostic Order ${data.order.order_number} submitted to lab queue.`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to submit diagnostic order");
      }
    } catch (err: any) {
      alert("Error submitting diagnostic order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewOrder = async (orderId: string) => {
    setReviewingId(orderId);
    try {
      const res = await fetch(`/api/diagnostics/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Reviewed by attending physician. Results acknowledged." }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
        setNotification("Lab results successfully marked as REVIEWED & acknowledged.");
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to mark order as reviewed");
      }
    } catch (err) {
      alert("Error reviewing order");
    } finally {
      setReviewingId(null);
    }
  };

  const toggleSelectTest = (testCode: string) => {
    setSelectedTests((prev) =>
      prev.includes(testCode) ? prev.filter((t) => t !== testCode) : [...prev, testCode]
    );
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Diagnostic Orders &amp; Laboratory Results
            </h2>
            <p className="text-xs text-slate-500">
              Order pathology &amp; imaging, review real-time reports, and track longitudinal lab deltas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-surface-50"
            title="Refresh Orders"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOrdering(!isOrdering)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {isOrdering ? "Cancel Order" : "Order Diagnostics"}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Order Creation Panel */}
      {isOrdering && (
        <form
          onSubmit={handleCreateOrder}
          className="rounded-2xl border-2 border-purple-200 bg-purple-50/40 p-5 space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900">
              Create New Diagnostic Order
            </h3>
            <span className="text-[11px] text-purple-700 font-medium">
              Lab catalog synced with AIIA Central Hospital
            </span>
          </div>

          {/* Test Selector Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Tests ({selectedTests.length} selected):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {catalog.map((cat) => {
                const code = cat.code || cat.test_code || "";
                const name = cat.name || cat.test_name || "";
                const isSelected = selectedTests.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleSelectTest(code)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? "border-purple-600 bg-purple-100/80 font-bold text-purple-950 shadow-2xs"
                        : "border-surface-200 bg-white text-slate-700 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-purple-700">{code}</span>
                      <span className="text-[10px] text-slate-400">{cat.turnaround_hours}h</span>
                    </div>
                    <div className="mt-1 font-semibold">{name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{cat.category}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Indication / Reason:
              </label>
              <input
                type="text"
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                placeholder="e.g., Evaluate ongoing pyrexia and joint discomfort"
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              >
                <option value="ROUTINE">Routine (Standard)</option>
                <option value="URGENT">Urgent (Within 4 hours)</option>
                <option value="STAT">STAT (Immediate Emergency)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOrdering(false)}
              className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedTests.length === 0}
              className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Submitting Order..." : "Confirm & Dispatch to Lab"}
            </button>
          </div>
        </form>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 p-8 text-center text-slate-400">
          <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs font-medium text-slate-500">No diagnostic orders placed for this encounter</p>
          <p className="text-[11px] text-slate-400">Click &quot;Order Diagnostics&quot; above to request pathology or imaging</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const hasResults = order.results && order.results.length > 0;
            const isReadyForReview = order.status === "RESULT_AVAILABLE";
            const isReviewed = order.status === "REVIEWED";
            const orderNum = order.order_number || `ORD-${order.id.substring(0, 8).toUpperCase()}`;
            const indication = order.clinical_indication || order.clinical_context;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-surface-200 bg-surface-50/40 p-5 space-y-3"
              >
                {/* Order Meta Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                      {orderNum}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.priority === "STAT"
                          ? "bg-red-100 text-red-800"
                          : order.priority === "URGENT"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {order.priority}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === "REVIEWED"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.status === "RESULT_AVAILABLE"
                          ? "bg-blue-100 text-blue-800"
                          : order.status === "IN_PROGRESS"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">
                      Ordered: {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {/* Review Button */}
                    {isReadyForReview && (
                      <button
                        type="button"
                        disabled={reviewingId === order.id}
                        onClick={() => handleReviewOrder(order.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {reviewingId === order.id ? "Acknowledging..." : "Acknowledge & Review"}
                      </button>
                    )}

                    {isReviewed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Doctor Acknowledged
                      </span>
                    )}
                  </div>
                </div>

                {/* Indication */}
                {indication && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Indication: </span>
                    {indication}
                  </div>
                )}

                {/* Items Ordered */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {order.items?.map((item) => {
                    const testName = item.test_name || item.test_name_snapshot;
                    const testCode = item.test_code || item.test_code_snapshot;
                    return (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-surface-200 px-2.5 py-1 text-xs text-slate-700 font-medium"
                      >
                        <FlaskConical className="h-3 w-3 text-purple-600" />
                        {testName} ({testCode})
                      </span>
                    );
                  })}
                </div>

                {/* Diagnostic Results Table if Uploaded */}
                {hasResults && (
                  <div className="mt-3 rounded-xl border border-surface-200 bg-white overflow-hidden shadow-2xs">
                    <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Laboratory Results &amp; Deltas</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Verified by Lab Technologist
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-50/60 text-slate-500 font-semibold border-b border-surface-100 text-[11px]">
                          <tr>
                            <th className="px-4 py-2">Parameter</th>
                            <th className="px-4 py-2">Observed Value</th>
                            <th className="px-4 py-2">Reference Range</th>
                            <th className="px-4 py-2">Flag</th>
                            <th className="px-4 py-2">Interpretation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {order.results?.map((res) => {
                            const pName = res.parameter_name || res.result_json?.parameterName || "Test";
                            const nVal = res.numeric_value ?? res.result_json?.numericValue;
                            const tVal = res.text_value || res.result_json?.textValue || res.result_text || "";
                            const unit = res.unit || res.result_json?.unit || "";
                            const rLow = res.reference_range_low ?? res.result_json?.referenceRangeLow;
                            const rHigh = res.reference_range_high ?? res.result_json?.referenceRangeHigh;
                            const abFlag = res.abnormal_flag || res.result_json?.abnormalFlag || "NORMAL";
                            const finding = res.finding || res.result_json?.finding || "Recorded";
                            const isAbnormal = abFlag !== "NORMAL";

                            return (
                              <tr key={res.id} className="hover:bg-surface-50/50">
                                <td className="px-4 py-2.5 font-semibold text-slate-800">
                                  {pName}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-slate-900">
                                  {nVal !== undefined && nVal !== null ? `${nVal} ${unit}` : tVal}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                  {rLow !== undefined && rLow !== null && rHigh !== undefined && rHigh !== null
                                    ? `${rLow} – ${rHigh} ${unit}`
                                    : "Clinical Standard"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isAbnormal
                                        ? "bg-red-100 text-red-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {abFlag}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">
                                  {finding}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
