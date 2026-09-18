"use client";

import React, { useState, useEffect } from "react";
import {
  Pill,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Prescription, PrescriptionItem } from "@/types/ecosystem";

interface DoctorPrescriptionCardProps {
  caseId: string;
  patientId: string;
  facilityId?: string;
  initialPrescriptions?: Prescription[];
  doctorName?: string;
}

interface ItemDraft {
  drugName: string;
  form: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  anupana: string;
  pathyaApathya: string;
}

const DEFAULT_ITEM: ItemDraft = {
  drugName: "",
  form: "Tablet",
  dosage: "500 mg",
  frequency: "1-0-1 (After Food)",
  duration: "5 days",
  route: "Oral",
  instructions: "Take with lukewarm water",
  anupana: "Warm water (Ushnodaka)",
  pathyaApathya: "Avoid heavy, oily foods; consume light warm soups",
};

export function DoctorPrescriptionCard({
  caseId,
  patientId,
  facilityId = "fac-hyd-01",
  initialPrescriptions = [],
  doctorName = "Dr. Ananya Sharma, MD",
}: DoctorPrescriptionCardProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [isDrafting, setIsDrafting] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [generalInstructions, setGeneralInstructions] = useState("");
  const [ayushDietaryAdvice, setAyushDietaryAdvice] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([DEFAULT_ITEM]);
  const [submitting, setSubmitting] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch(`/api/prescriptions?patientId=${patientId}&caseId=${caseId}`);
      const data = await res.json();
      if (res.ok && data.prescriptions) {
        setPrescriptions(data.prescriptions);
      }
    } catch (err) {
      console.error("Failed to load prescriptions:", err);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [caseId, patientId]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM, drugName: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemDraft, val: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.drugName.trim().length > 0);
    if (validItems.length === 0) {
      alert("Please enter at least one medication.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patientId,
        caseId,
        facilityId,
        doctorName,
        diagnosis: diagnosis || "Clinical evaluation and symptom relief",
        generalInstructions,
        ayushDietaryAdvice,
        items: validItems.map((v) => ({
          drugName: v.drugName,
          form: v.form,
          dosage: v.dosage,
          frequency: v.frequency,
          duration: v.duration,
          route: v.route,
          instructions: v.instructions,
          anupana: v.anupana,
          pathyaApathya: v.pathyaApathya,
        })),
      };

      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.prescription) {
        setPrescriptions((prev) => [data.prescription, ...prev]);
        setIsDrafting(false);
        setItems([DEFAULT_ITEM]);
        setNotification(`Prescription draft ${data.prescription.prescription_number} created.`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to save prescription draft");
      }
    } catch (err) {
      alert("Error creating prescription draft");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizePrescription = async (prescriptionId: string) => {
    if (!confirm("Are you sure you want to finalize this prescription? Once approved, it will be immediately transmitted to the Pharmacy for dispensing.")) {
      return;
    }

    setFinalizingId(prescriptionId);
    try {
      const res = await fetch(`/api/prescriptions/${prescriptionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorName }),
      });

      const data = await res.json();
      if (res.ok && data.prescription) {
        setPrescriptions((prev) =>
          prev.map((p) => (p.id === prescriptionId ? data.prescription : p))
        );
        setNotification(`Prescription ${data.prescription.prescription_number} APPROVED and routed to Pharmacy.`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to finalize prescription");
      }
    } catch (err) {
      alert("Error finalizing prescription");
    } finally {
      setFinalizingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Clinical Prescription &amp; Ayurvedic Regimen
            </h2>
            <p className="text-xs text-slate-500">
              Draft pharmacotherapy, incorporate Anupana &amp; Pathya/Apathya, and sign off for pharmacy dispensing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchPrescriptions()}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-surface-50"
            title="Refresh Prescriptions"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsDrafting(!isDrafting)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {isDrafting ? "Cancel Draft" : "Draft New Prescription"}
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

      {/* Drafting Panel */}
      {isDrafting && (
        <form
          onSubmit={handleSaveDraft}
          className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 space-y-5 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
              Prescription Draft (Clinician Authoring)
            </h3>
            <span className="text-[11px] text-emerald-700 font-medium">
              Transmitted to Pharmacy only upon doctor final approval
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Diagnosis / Impression:
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g., Acute Upper Respiratory Tract Infection"
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                General Diet &amp; Lifestyle Advice:
              </label>
              <input
                type="text"
                value={generalInstructions}
                onChange={(e) => setGeneralInstructions(e.target.value)}
                placeholder="e.g., Adequate hydration, avoid cold exposure, 8h sleep"
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Medication Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Medications &amp; Dosage ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <Plus className="h-3.5 w-3.5" /> Add Another Medication
              </button>
            </div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-surface-200 bg-white p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                  <span className="font-bold text-xs text-slate-700">Medication #{idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Drug / Form Formulation</label>
                    <input
                      type="text"
                      value={item.drugName}
                      onChange={(e) => handleItemChange(idx, "drugName", e.target.value)}
                      placeholder="e.g., Paracetamol 500mg or Ashwagandha Churna"
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Dosage / Form</label>
                    <input
                      type="text"
                      value={item.dosage}
                      onChange={(e) => handleItemChange(idx, "dosage", e.target.value)}
                      placeholder="e.g., 1 tablet or 3g"
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Frequency</label>
                    <input
                      type="text"
                      value={item.frequency}
                      onChange={(e) => handleItemChange(idx, "frequency", e.target.value)}
                      placeholder="e.g., 1-0-1, BD, TDS"
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Duration</label>
                    <input
                      type="text"
                      value={item.duration}
                      onChange={(e) => handleItemChange(idx, "duration", e.target.value)}
                      placeholder="e.g., 5 days"
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Route</label>
                    <select
                      value={item.route}
                      onChange={(e) => handleItemChange(idx, "route", e.target.value)}
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                    >
                      <option value="Oral">Oral</option>
                      <option value="Topical">Topical</option>
                      <option value="Inhalation">Inhalation</option>
                      <option value="Nasal (Nasya)">Nasal (Nasya)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Anupana (Vehicle / Medium)</label>
                    <input
                      type="text"
                      value={item.anupana}
                      onChange={(e) => handleItemChange(idx, "anupana", e.target.value)}
                      placeholder="e.g., Warm water, honey, cow's milk"
                      className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDrafting(false)}
              className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving Draft..." : "Save Prescription Draft"}
            </button>
          </div>
        </form>
      )}

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 p-8 text-center text-slate-400">
          <Pill className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs font-medium text-slate-500">No prescriptions drafted for this case yet</p>
          <p className="text-[11px] text-slate-400">Click &quot;Draft New Prescription&quot; above to begin therapy regimen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => {
            const isDraft = rx.status === "DRAFT";
            const isFinal = rx.status === "FINAL";
            const isDispensed = rx.status === "DISPENSED";

            return (
              <div
                key={rx.id}
                className="rounded-2xl border border-surface-200 bg-surface-50/40 p-5 space-y-4"
              >
                {/* Meta Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      {rx.prescription_number || `RX-${rx.id.substring(0, 8).toUpperCase()}`}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isFinal
                          ? "bg-emerald-100 text-emerald-800"
                          : isDraft
                          ? "bg-amber-100 text-amber-800"
                          : isDispensed
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {rx.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">
                      Authored by: {rx.doctor_name || rx.prescriber_name || "Attending Physician"}
                    </span>

                    {/* Finalize Button if DRAFT */}
                    {isDraft && (
                      <button
                        type="button"
                        disabled={finalizingId === rx.id}
                        onClick={() => handleFinalizePrescription(rx.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {finalizingId === rx.id ? "Approving..." : "Doctor Final Approval & Transmit"}
                      </button>
                    )}

                    {isFinal && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approved &amp; Queued at Pharmacy
                      </span>
                    )}
                  </div>
                </div>

                {/* Diagnosis & Instructions */}
                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Diagnosis / Notes: </span>
                    <span className="text-slate-900">{rx.diagnosis || rx.notes || "Clinical Care Plan"}</span>
                  </div>
                  {rx.general_instructions && (
                    <div>
                      <span className="font-semibold text-slate-700">General Instructions: </span>
                      <span className="text-slate-600">{rx.general_instructions}</span>
                    </div>
                  )}
                  {rx.ayush_dietary_advice && (
                    <div>
                      <span className="font-semibold text-emerald-800">Ayush Diet &amp; Regimen: </span>
                      <span className="text-slate-600">{rx.ayush_dietary_advice}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50 text-slate-500 font-semibold border-b border-surface-200 text-[11px]">
                        <tr>
                          <th className="px-4 py-2">Medication / Formulation</th>
                          <th className="px-4 py-2">Dosage &amp; Route</th>
                          <th className="px-4 py-2">Frequency</th>
                          <th className="px-4 py-2">Duration</th>
                          <th className="px-4 py-2">Anupana (Vehicle)</th>
                          <th className="px-4 py-2">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {rx.items?.map((item) => {
                          const medName = item.medicine_name || item.drug_name || "Medicine";
                          const medForm = item.form || item.strength || "";
                          const medDose = item.dose || item.dosage || "Standard Dose";
                          const medAnupana = item.anupana || "Warm water";

                          return (
                            <tr key={item.id} className="hover:bg-surface-50/50">
                              <td className="px-4 py-2.5 font-bold text-slate-900">
                                {medName}
                                {medForm && (
                                  <span className="text-[10px] text-slate-400 font-normal block">
                                    {medForm}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700">
                                {medDose} ({item.route})
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-clinical-700">
                                {item.frequency}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {item.duration}
                              </td>
                              <td className="px-4 py-2.5 text-emerald-800 font-medium">
                                {medAnupana}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">
                                {item.instructions || "As advised"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
