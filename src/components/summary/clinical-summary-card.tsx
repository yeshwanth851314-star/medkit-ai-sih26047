"use client";

import { useState } from "react";
import { ClinicalSummary } from "@/features/summaries/types";
import { ContextualHelp } from "@/components/help/contextual-help";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  RefreshCw,
  FileCheck,
  Pill,
  HeartPulse,
} from "lucide-react";

export function ClinicalSummaryCard({
  initialSummary,
  caseId,
}: {
  initialSummary: ClinicalSummary;
  caseId: string;
}) {
  const [summary, setSummary] = useState<ClinicalSummary>(initialSummary);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarrative, setEditedNarrative] = useState(summary.hpiNarrative);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(summary.status === "confirmed");

  const handleRegenerate = async (useAI = false) => {
    setIsRegenerating(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: useAI ? "ai_assisted" : "deterministic" }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
        setEditedNarrative(data.summary.hpiNarrative);
        setIsConfirmed(false);
        setIsEditing(false);
      }
    } catch {
      console.error("Failed to regenerate summary");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          narrative: editedNarrative,
          summary,
          editedByClinician: editedNarrative !== summary.hpiNarrative,
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
        setIsEditing(false);
        setIsConfirmed(true);
        setConfirmError(null);
      } else {
        setConfirmError(data?.error || "Failed to persist clinical confirmation. Please try again.");
      }
    } catch {
      setConfirmError("Network error: Failed to confirm clinical synopsis. Please check connection and retry.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="rounded-2xl border border-clinical-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-surface-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-clinical-100 border border-clinical-200 px-2.5 py-0.5 text-xs font-bold text-clinical-800">
              <Sparkles className="h-3.5 w-3.5 text-clinical-600" />
              {summary.providerMeta?.provider === "gemini-2.5-flash"
                ? `● Live Gemini 2.5 Flash (${summary.providerMeta.latencyMs || 0}ms)`
                : summary.summaryType === "ai_assisted"
                ? "● Deterministic Fallback"
                : "Deterministic Intake Summary"}
            </span>

            {isConfirmed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Clinician Confirmed {summary.confirmedBy ? `(${summary.confirmedBy})` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                Review Required
              </span>
            )}

            <ContextualHelp topic="provenance" />
          </div>
          <h2 className="mt-2 text-base font-bold text-slate-900 flex items-center gap-2">
            AI-Assisted Clinical Summary &amp; Physician Copilot Synopsis
            <ContextualHelp topic="summary" />
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRegenerate(true)}
            disabled={isRegenerating || isConfirmed || isConfirming}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate AI
          </button>

          {!isConfirmed && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${isConfirming ? "animate-spin" : ""}`} />
              {isConfirming ? "Confirming..." : "Confirm Synopsis"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Error Banner with Retry */}
      {confirmError && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{confirmError}</span>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="ml-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mandatory Safety Notice */}
      <div className="flex items-start gap-2 rounded-lg bg-clinical-50 border border-clinical-200 p-3 text-xs text-clinical-900">
        <ShieldCheck className="h-4 w-4 text-clinical-600 shrink-0 mt-0.5" />
        <div>
          <strong>Safety Contract:</strong> {summary.disclaimer} All facts are traceable to patient statements, physical examination, or confirmed documents.
        </div>
      </div>

      {/* Main Narrative Synopsis */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Synthesized Clinical History
          </span>
          {!isConfirmed && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1 text-xs text-clinical-600 hover:text-clinical-800 font-semibold"
            >
              <Edit3 className="h-3 w-3" />
              {isEditing ? "Cancel Editing" : "Edit Narrative"}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={editedNarrative}
              onChange={(e) => setEditedNarrative(e.target.value)}
              aria-label="Synthesized Clinical History narrative"
              className="block w-full rounded-xl border border-surface-200 p-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-semibold shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className={`h-3.5 w-3.5 ${isConfirming ? "animate-spin" : ""}`} /> {isConfirming ? "Saving..." : "Save & Confirm Synopsis"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : editedNarrative?.trim() ? (
          <p className="rounded-xl bg-surface-50 p-4 text-xs font-medium leading-relaxed text-slate-900 border border-surface-200">
            {editedNarrative}
          </p>
        ) : (
          <div className="rounded-xl bg-surface-50 p-4 text-xs text-slate-500 border border-surface-200 text-center">
            <span className="font-semibold text-slate-700 block">No clinical synopsis generated yet</span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Generate a structured AI-assisted summary after reviewing the intake.</span>
          </div>
        )}
      </div>

      {/* Pertinent Positives & Negatives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="rounded-xl border border-surface-200 p-3 bg-white">
          <span className="text-slate-500 font-bold block mb-2 uppercase text-[10px] tracking-wider">
            Pertinent Positives
          </span>
          {summary.pertinentPositives.length > 0 ? (
            <ul className="space-y-1">
              {summary.pertinentPositives.map((p, i) => (
                <li key={i} className="flex items-center gap-1.5 text-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-400 italic">None reported</span>
          )}
        </div>

        <div className="rounded-xl border border-surface-200 p-3 bg-white">
          <span className="text-slate-500 font-bold block mb-2 uppercase text-[10px] tracking-wider">
            Pertinent Negatives (Denies)
          </span>
          {summary.pertinentNegatives.length > 0 ? (
            <ul className="space-y-1">
              {summary.pertinentNegatives.map((n, i) => (
                <li key={i} className="flex items-center gap-1.5 text-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Denies {n}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-400 italic">None specifically documented</span>
          )}
        </div>
      </div>

      {/* Red Flags & Missing Information Safety Strip */}
      {(summary.redFlags.length > 0 || summary.missingInformation.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {summary.redFlags.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-red-900">
              <span className="font-bold flex items-center gap-1.5 mb-1.5 text-red-700">
                <AlertTriangle className="h-4 w-4" /> Potential Red Flags
              </span>
              <ul className="space-y-1 list-disc list-inside">
                {summary.redFlags.map((rf, i) => (
                  <li key={i}>{rf}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.missingInformation.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900">
              <span className="font-bold flex items-center gap-1.5 mb-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Intake Gaps / Missing Items
              </span>
              <ul className="space-y-1 list-disc list-inside text-[11px]">
                {summary.missingInformation.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
