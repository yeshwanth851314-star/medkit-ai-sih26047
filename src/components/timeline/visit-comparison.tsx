import { VisitComparisonResult } from "@/features/timeline/types";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowRight,
  TrendingUp,
  Pill,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
} from "lucide-react";

export function VisitComparisonView({ comparison }: { comparison: VisitComparisonResult }) {
  if (!comparison.hasPreviousVisit) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-xs text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-clinical-100 text-clinical-600 mb-2">
          <HeartPulse className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Baseline Visit Recorded</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          This is the patient&apos;s initial encounter. Subsequent visits will automatically compute clinical comparisons and highlight delta changes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-clinical-200 bg-white p-6 shadow-xs space-y-6">
      <div className="border-b border-surface-200 pb-4">
        <div className="flex items-center gap-2 text-xs font-bold text-clinical-700 uppercase tracking-wider mb-1">
          <TrendingUp className="h-4 w-4" />
          Signature Feature: Longitudinal Comparison
        </div>
        <h2 className="text-lg font-bold text-slate-900">What Changed Since the Previous Visit?</h2>
        <p className="text-xs text-slate-500">
          Comparing Encounter on {formatDateTime(comparison.previousVisitDate)} with Current Encounter on {formatDateTime(comparison.currentVisitDate)}
        </p>
      </div>

      {/* Complaint Progression */}
      <div className="rounded-xl bg-surface-50 p-4 border border-surface-200">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Chief Complaint Evolution</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
          <div className="flex-1 rounded-lg bg-white p-3 border border-surface-200">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Previous Visit</span>
            <span className="font-semibold text-slate-800">{comparison.previousComplaint}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-clinical-600 shrink-0 hidden sm:block" />
          <div className="flex-1 rounded-lg bg-white p-3 border border-clinical-300 shadow-2xs">
            <span className="text-clinical-600 block text-[10px] font-semibold uppercase">Current Visit (Progression)</span>
            <span className="font-bold text-slate-900">{comparison.currentComplaint}</span>
          </div>
        </div>
      </div>

      {/* Medication Changes Table */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Pill className="h-4 w-4 text-clinical-600" />
          Medication Changes &amp; Titration Delta
        </h3>
        {comparison.medicationChanges.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No medication adjustments noted between visits.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-200">
            <table className="min-w-full divide-y divide-surface-200 text-xs">
              <thead className="bg-surface-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th className="py-2.5 px-3">Medication Name</th>
                  <th className="py-2.5 px-3">Change Status</th>
                  <th className="py-2.5 px-3">Current Regimen</th>
                  <th className="py-2.5 px-3">Previous Regimen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 bg-white">
                {comparison.medicationChanges.map((m, idx) => (
                  <tr key={idx} className="hover:bg-surface-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{m.name}</td>
                    <td className="py-2.5 px-3">
                      {m.status === "added" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                          <PlusCircle className="h-3 w-3" /> Added
                        </span>
                      )}
                      {m.status === "continued" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          Continued
                        </span>
                      )}
                      {m.status === "discontinued" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700 border border-rose-200">
                          <MinusCircle className="h-3 w-3" /> Discontinued
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{m.dose || "—"}</td>
                    <td className="py-2.5 px-3 text-slate-500">{m.previousDose || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vitals Side-by-Side Comparison */}
      {comparison.vitalsComparison.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <HeartPulse className="h-4 w-4 text-clinical-600" />
            Vitals Comparison
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {comparison.vitalsComparison.map((v, i) => (
              <div key={i} className="rounded-xl border border-surface-200 p-3 bg-surface-50/50">
                <span className="text-slate-500 font-medium block text-[11px]">{v.metric}</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-bold text-slate-900 text-sm">{v.currentValue}</span>
                  <span className="text-slate-400 text-[10px]">prev: {v.previousValue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
