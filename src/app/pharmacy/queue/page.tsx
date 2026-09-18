"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Pill,
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
  Package,
  Layers,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Send,
} from "lucide-react";
import {
  Prescription,
  PrescriptionItem,
  PharmacyInventoryItem,
  DispenseStatus,
  PrescriptionClarification,
} from "@/types/ecosystem";

export default function PharmacyQueuePage() {
  const facilityId = "fac-hyd-01";
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"prescriptions" | "inventory">("prescriptions");
  const [notification, setNotification] = useState<string | null>(null);

  // Dispense Modal State
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [dispenseQuantities, setDispenseQuantities] = useState<Record<string, number>>({});
  const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [pharmacistName, setPharmacistName] = useState("Venkatesh Iyer, Reg. Pharmacist");
  const [submittingDispense, setSubmittingDispense] = useState(false);

  // Clarification Modal State
  const [clarificationRx, setClarificationRx] = useState<Prescription | null>(null);
  const [clarificationReason, setClarificationReason] = useState("");
  const [submittingClarification, setSubmittingClarification] = useState(false);

  const fetchPharmacyData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch FINAL prescriptions (strict isolation invariant: only FINAL prescriptions reach pharmacy)
      const rxRes = await fetch(`/api/pharmacy/prescriptions?facilityId=${facilityId}`);
      const rxData = await rxRes.json();
      if (rxRes.ok && rxData.prescriptions) {
        setPrescriptions(rxData.prescriptions);
      }

      // 2. Fetch Inventory
      const invRes = await fetch(`/api/pharmacy/inventory?facilityId=${facilityId}`);
      const invData = await invRes.json();
      if (invRes.ok && invData.inventory) {
        setInventory(invData.inventory);
      }
    } catch (err) {
      console.error("Failed to load pharmacy data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacyData();
    const interval = setInterval(fetchPharmacyData, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenDispenseModal = (rx: Prescription) => {
    setSelectedRx(rx);
    const initialQtys: Record<string, number> = {};
    const initialBatches: Record<string, string> = {};
    const initialExpiries: Record<string, string> = {};

    rx.items?.forEach((item) => {
      const remaining = item.quantity - (item.dispensed_quantity || 0);
      initialQtys[item.id] = remaining > 0 ? remaining : 0;
      initialBatches[item.id] = "BATCH-2026-" + Math.floor(100 + Math.random() * 900);
      initialExpiries[item.id] = "2027-12-31";
    });

    setDispenseQuantities(initialQtys);
    setBatchNumbers(initialBatches);
    setExpiryDates(initialExpiries);
    setDispenseNotes("Dispensed full regimen with standard dosage counselling.");
  };

  const handleSubmitDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRx) return;

    setSubmittingDispense(true);
    try {
      const itemsPayload = selectedRx.items?.map((item) => ({
        prescriptionItemId: item.id,
        quantity: dispenseQuantities[item.id] || 0,
        batchNumber: batchNumbers[item.id] || "B-DEFAULT",
        expiryDate: expiryDates[item.id] || "2027-12-31",
      })).filter((i) => i.quantity > 0) || [];

      if (itemsPayload.length === 0) {
        alert("Please enter a quantity greater than 0 to dispense.");
        setSubmittingDispense(false);
        return;
      }

      const res = await fetch("/api/pharmacy/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriptionId: selectedRx.id,
          facilityId,
          dispensedBy: pharmacistName,
          notes: dispenseNotes,
          items: itemsPayload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.dispenseEvent) {
        setNotification(`Dispense confirmed for Prescription ${selectedRx.prescription_number || selectedRx.id.substring(0, 8)}. Stock decremented.`);
        setSelectedRx(null);
        fetchPharmacyData();
        setTimeout(() => setNotification(null), 5000);
      } else {
        alert(data.error || "Failed to dispense medication");
      }
    } catch (err) {
      alert("Error confirming dispense");
    } finally {
      setSubmittingDispense(false);
    }
  };

  const handleRaiseClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarificationRx || !clarificationReason.trim()) return;

    setSubmittingClarification(true);
    try {
      const res = await fetch("/api/pharmacy/clarifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriptionId: clarificationRx.id,
          raisedBy: pharmacistName,
          reason: clarificationReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.clarification) {
        setNotification(`Clarification sent to Dr. ${clarificationRx.doctor_name || "Physician"}.`);
        setClarificationRx(null);
        setClarificationReason("");
        fetchPharmacyData();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to raise clarification");
      }
    } catch (err) {
      alert("Error raising clarification");
    } finally {
      setSubmittingClarification(false);
    }
  };

  const pendingRxCount = prescriptions.filter((p) => p.status === "FINAL").length;
  const partialRxCount = prescriptions.filter((p) => p.status === "PARTIALLY_DISPENSED").length;
  const completedRxCount = prescriptions.filter((p) => p.status === "DISPENSED").length;
  const lowStockCount = inventory.filter((i) => i.stock_quantity < 50).length;

  const filteredRx = prescriptions.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.patient_name && p.patient_name.toLowerCase().includes(q)) ||
      (p.patient_code && p.patient_code.toLowerCase().includes(q)) ||
      (p.prescription_number && p.prescription_number.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Hospital Pharmacy &amp; Dispensary
            </span>
            <span className="text-xs text-slate-500">• AIIA Dispensary Wing</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pharmacy Dispense &amp; Inventory Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Strict isolation dispense queue (only approved FINAL prescriptions), batch tracking, and inventory decrement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchPharmacyData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh Dispensary
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
            <span className="text-xs font-semibold text-slate-500 uppercase">Awaiting Dispense</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">{pendingRxCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Approved by physician</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Partially Dispensed</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600">{partialRxCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Split fulfillment</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Completed Today</span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-600">{completedRxCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Fully dispensed orders</p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Inventory SKUs</span>
            <Package className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{inventory.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">
            {lowStockCount > 0 ? `${lowStockCount} items low stock` : "Stock levels adequate"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-surface-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("prescriptions")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === "prescriptions"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-surface-100 text-slate-600 hover:bg-surface-200"
            }`}
          >
            Prescription Dispense Queue ({prescriptions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === "inventory"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-surface-100 text-slate-600 hover:bg-surface-200"
            }`}
          >
            Pharmacy Stock Inventory ({inventory.length})
          </button>
        </div>

        {activeTab === "prescriptions" && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, Rx #..."
              className="w-full rounded-xl border border-surface-200 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        )}
      </div>

      {/* VIEW 1: Prescription Queue */}
      {activeTab === "prescriptions" && (
        <div className="rounded-3xl border border-surface-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Approved Doctor Prescriptions</h2>
              <p className="text-xs text-slate-400">
                Grounded invariant: Only verified FINAL prescriptions appear for pharmacy dispensing
              </p>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
              Facility: {facilityId}
            </span>
          </div>

          {filteredRx.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Pill className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-600">No prescriptions waiting in the pharmacy queue</p>
              <p className="mt-1 text-xs text-slate-400">
                Prescriptions finalized by doctors in OPD will appear here instantaneously
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {filteredRx.map((rx) => {
                const isFinal = rx.status === "FINAL";
                const isPartial = rx.status === "PARTIALLY_DISPENSED";
                const isDispensed = rx.status === "DISPENSED";
                const rxNum = rx.prescription_number || `RX-${rx.id.substring(0, 8).toUpperCase()}`;

                return (
                  <div key={rx.id} className="p-6 hover:bg-surface-50/40 transition-colors space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                          {rxNum}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{rx.patient_name || "Demo Patient"}</div>
                          <div className="text-xs text-slate-400">
                            Prescribed by {rx.doctor_name || rx.prescriber_name || "Attending Physician"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            isFinal
                              ? "bg-emerald-100 text-emerald-800"
                              : isPartial
                              ? "bg-amber-100 text-amber-800"
                              : isDispensed
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {rx.status.replace(/_/g, " ")}
                        </span>

                        {/* Clarification Trigger */}
                        <button
                          type="button"
                          onClick={() => setClarificationRx(rx)}
                          className="inline-flex items-center gap-1 rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface-50 shadow-2xs"
                        >
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                          Clarify with Doctor
                        </button>

                        {/* Dispense Button */}
                        {(isFinal || isPartial) && (
                          <button
                            type="button"
                            onClick={() => handleOpenDispenseModal(rx)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                          >
                            <Pill className="h-3.5 w-3.5" />
                            Dispense Medications &rarr;
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Prescribed Items Table */}
                    <div className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-50 text-slate-500 font-semibold border-b border-surface-200 text-[11px]">
                          <tr>
                            <th className="px-4 py-2.5">Medication Name</th>
                            <th className="px-4 py-2.5">Dosage / Form</th>
                            <th className="px-4 py-2.5">Frequency &amp; Duration</th>
                            <th className="px-4 py-2.5">Quantity Prescribed</th>
                            <th className="px-4 py-2.5">Already Dispensed</th>
                            <th className="px-4 py-2.5">Ayush Anupana &amp; Regimen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {rx.items?.map((item) => {
                            const medName = item.medicine_name || item.drug_name || "Medicine";
                            const medDose = item.dose || item.dosage || "Standard Dose";
                            const alreadyDispensed = item.dispensed_quantity || 0;
                            const isFullyDispensed = alreadyDispensed >= item.quantity;

                            return (
                              <tr key={item.id} className="hover:bg-surface-50/50">
                                <td className="px-4 py-2.5 font-bold text-slate-900">
                                  {medName}
                                  {item.generic_name && (
                                    <span className="text-[10px] text-slate-400 font-normal block">
                                      ({item.generic_name})
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-slate-700">
                                  {medDose} {item.strength || ""} ({item.route})
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">
                                  {item.frequency} for {item.duration}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-slate-900">
                                  {item.quantity} units
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isFullyDispensed
                                        ? "bg-blue-100 text-blue-800"
                                        : alreadyDispensed > 0
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {alreadyDispensed} / {item.quantity}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-emerald-800 font-medium">
                                  {item.anupana || item.instructions || "Warm water"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Pharmacy Inventory */}
      {activeTab === "inventory" && (
        <div className="rounded-3xl border border-surface-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Formulary &amp; Stock Inventory</h2>
              <p className="text-xs text-slate-400">
                Allopathic &amp; Classical Ayurvedic herbal formulations with automated stock decrement
              </p>
            </div>
            <span className="text-xs text-slate-400">Facility: {facilityId}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 text-slate-500 font-semibold border-b border-surface-200 text-xs">
                <tr>
                  <th className="px-6 py-3.5">Medicine Name</th>
                  <th className="px-6 py-3.5">Key / Code</th>
                  <th className="px-6 py-3.5">Strength / Form</th>
                  <th className="px-6 py-3.5">Batch #</th>
                  <th className="px-6 py-3.5">Expiry Date</th>
                  <th className="px-6 py-3.5">Available Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs">
                {inventory.map((inv) => {
                  const isLow = inv.stock_quantity < 50;

                  return (
                    <tr key={inv.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {inv.medicine_name}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-500">
                        {inv.medicine_key}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {inv.strength || "Standard"}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-500">
                        {inv.batch_number || "B-2026-01"}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {inv.expiry_date || "2027-12-31"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                            isLow
                              ? "bg-red-100 text-red-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {inv.stock_quantity} units
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {selectedRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Confirm Medication Dispensing
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prescription #{selectedRx.prescription_number || selectedRx.id.substring(0, 8)} • Patient: {selectedRx.patient_name || "Demo Patient"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRx(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDispense} className="space-y-4 text-xs">
              <div className="rounded-xl bg-surface-50 p-3 border border-surface-200 text-slate-600 space-y-1">
                <div><strong>Prescribed By:</strong> {selectedRx.doctor_name || selectedRx.prescriber_name || "Attending Physician"}</div>
                {selectedRx.notes && <div><strong>Doctor Instructions:</strong> {selectedRx.notes}</div>}
              </div>

              {/* Items Dispense Form */}
              <div className="space-y-3">
                <label className="block font-bold text-slate-800 uppercase tracking-wider">
                  Dispense Quantities &amp; Batch Allocation
                </label>

                {selectedRx.items?.map((item) => {
                  const medName = item.medicine_name || item.drug_name || "Medicine";
                  const remaining = item.quantity - (item.dispensed_quantity || 0);

                  return (
                    <div key={item.id} className="rounded-xl border border-surface-200 p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{medName}</span>
                        <span className="text-[11px] text-slate-500">
                          Remaining to dispense: <strong>{remaining} units</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Dispense Qty</label>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={dispenseQuantities[item.id] || 0}
                            onChange={(e) =>
                              setDispenseQuantities({
                                ...dispenseQuantities,
                                [item.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full rounded-lg border border-surface-200 p-2 text-xs focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Batch #</label>
                          <input
                            type="text"
                            value={batchNumbers[item.id] || ""}
                            onChange={(e) =>
                              setBatchNumbers({
                                ...batchNumbers,
                                [item.id]: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-surface-200 p-2 text-xs focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Expiry Date</label>
                          <input
                            type="date"
                            value={expiryDates[item.id] || "2027-12-31"}
                            onChange={(e) =>
                              setExpiryDates({
                                ...expiryDates,
                                [item.id]: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-surface-200 p-2 text-xs focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pharmacist Dispensing Notes:</label>
                <input
                  type="text"
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pharmacist Signature:</label>
                <input
                  type="text"
                  value={pharmacistName}
                  onChange={(e) => setPharmacistName(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setSelectedRx(null)}
                  className="rounded-xl border border-surface-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispense}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submittingDispense ? "Processing..." : "Confirm Dispense & Decrement Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {clarificationRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-surface-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Raise Pharmacist Clarification with Prescribing Doctor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClarificationRx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseClarification} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Prescription Ref: <strong>{clarificationRx.prescription_number || clarificationRx.id.substring(0, 8)}</strong>
                <br />
                Doctor: <strong>Dr. {clarificationRx.doctor_name || "Physician"}</strong>
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Clarification Query / Reason:
                </label>
                <textarea
                  rows={3}
                  required
                  value={clarificationReason}
                  onChange={(e) => setClarificationReason(e.target.value)}
                  placeholder="e.g., Query regarding dosage duration vs standard guidelines, or check for potential allergy cross-reactivity."
                  className="w-full rounded-xl border border-surface-200 p-2.5 focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setClarificationRx(null)}
                  className="rounded-xl border border-surface-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClarification}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {submittingClarification ? "Sending..." : "Submit Clarification to Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
