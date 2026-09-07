import { VisitComparisonResult } from "@/features/timeline/types";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowRight,
  TrendingUp,
  Pill,
  HeartPulse,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  Activity,
  Check,
  Plus,
  Clock,
} from "lucide-react";

import { ContextualHelp } from "@/components/help/contextual-help";

export function VisitComparisonView({ comparison }: { comparison: VisitComparisonResult }) {
  if (!comparison.hasPreviousVisit) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-clinical-100 text-clinical-600 mb-2">
          <HeartPulse className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No previous visit available</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          &ldquo;What Changed Since Last Visit?&rdquo; will appear after this patient has more than one recorded encounter. Baseline visit recorded.
        </p>
      </div>
    );
  }

  const hasSymptomChanges =
    (comparison.symptomChanges?.added?.length ?? 0) > 0 ||
    (comparison.symptomChanges?.persisting?.length ?? 0) > 0 ||
    (comparison.symptomChanges?.resolved?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-clinical-300/80 bg-gradient-to-b from-clinical-50/30 via-white to-white p-6 shadow-sm space-y-6">
      {/* Signature Header */}
      <div className="border-b border-surface-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-clinical-100 px-3 py-0.5 text-xs font-bold text-clinical-800 uppercase tracking-wider border border-clinical-200">
              <TrendingUp className="h-3.5 w-3.5" />
              Longitudinal Delta Analysis
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
              Differential View
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Last visit: {comparison.previousVisitDate ? formatDateTime(comparison.previousVisitDate) : "Prior"}</span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          What Changed Since the Previous Visit?
          <ContextualHelp topic="what_changed" />
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Automated cross-encounter synthesis comparing Encounter on {comparison.previousVisitDate ? formatDateTime(comparison.previousVisitDate) : "prior"} with Current Encounter on {formatDateTime(comparison.currentVisitDate)}
        </p>
      </div>

      {/* Critical Red Flags Delta Alert if present */}
      {comparison.redFlagAlerts && comparison.redFlagAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-700">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            ⚡ Active Red Flag Delta Between Encounters
          </div>
          <div className="space-y-1 text-xs">
            {comparison.redFlagAlerts.map((rf, i) => (
              <div key={i} className="flex items-start gap-2 font-medium">
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-800">
                  {rf.severity.toUpperCase()}
                </span>
                <span>{rf.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chief Complaint Evolution */}
      <div className="rounded-xl bg-surface-50 p-4 border border-surface-200">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Chief Complaint Evolution</h3>
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 text-xs">
          <div className="flex-1 rounded-lg bg-white p-3 border border-surface-200">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Previous Visit</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{comparison.previousComplaint || "None recorded"}</span>
          </div>
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-clinical-100 p-1.5 text-clinical-700 hidden sm:flex">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-white p-3 border border-clinical-300 shadow-sm">
            <span className="text-clinical-600 block text-[10px] font-semibold uppercase">Current Visit (Evolution)</span>
            <span className="font-bold text-slate-900 mt-0.5 block">{comparison.currentComplaint}</span>
          </div>
        </div>
        {comparison.complaintProgressionNotes && (
          <p className="mt-2 text-[11px] text-slate-500 italic bg-white/60 px-3 py-1.5 rounded-md border border-surface-200/60">
            <strong>Evolution note:</strong> {comparison.complaintProgressionNotes}
          </p>
        )}
      </div>

      {/* Symptom Progression Deltas */}
      {hasSymptomChanges && (
        <div className="rounded-xl border border-surface-200 bg-white p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-clinical-600" />
            Symptom Progression &amp; Resolution Delta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Added / New Symptoms */}
            <div className="rounded-lg bg-emerald-50/50 border border-emerald-200 p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 uppercase tracking-wider">
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                New Symptoms ({comparison.symptomChanges.added.length})
              </div>
              {comparison.symptomChanges.added.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comparison.symptomChanges.added.map((sym, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300 shadow-sm"
                    >
                      <Plus className="h-2.5 w-2.5" /> {sym}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No newly added symptoms</p>
              )}
            </div>

            {/* Persisting Symptoms */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                Persisting ({comparison.symptomChanges.persisting.length})
              </div>
              {comparison.symptomChanges.persisting.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comparison.symptomChanges.persisting.map((sym, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 border border-slate-300 shadow-sm"
                    >
                      <ArrowRight className="h-2.5 w-2.5 text-slate-400" /> {sym}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No persisting symptoms</p>
              )}
            </div>

            {/* Resolved Symptoms */}
            <div className="rounded-lg bg-sky-50/50 border border-sky-200 p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-sky-800 flex items-center gap-1 uppercase tracking-wider">
                <Check className="h-3.5 w-3.5 text-sky-600" />
                Resolved ({comparison.symptomChanges.resolved.length})
              </div>
              {comparison.symptomChanges.resolved.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comparison.symptomChanges.resolved.map((sym, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-sky-700 border border-sky-300 shadow-sm line-through"
                    >
                      <Check className="h-2.5 w-2.5" /> {sym}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No resolved symptoms</p>
              )}
            </div>
          </div>
        </div>
      )}

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
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                          <PlusCircle className="h-3 w-3" /> Added
                        </span>
                      )}
                      {m.status === "continued" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 border border-slate-200">
                          Continued
                        </span>
                      )}
                      {m.status === "discontinued" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 font-bold text-rose-700 border border-rose-200">
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
            Vitals Comparison &amp; Trajectory
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {comparison.vitalsComparison.map((v, i) => (
              <div key={i} className="rounded-xl border border-surface-200 p-3 bg-surface-50/50 hover:bg-white hover:shadow-sm transition-all">
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
