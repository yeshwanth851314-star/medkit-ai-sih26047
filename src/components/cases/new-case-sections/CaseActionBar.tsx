"use client";

import React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

interface CaseActionBarProps {
  activeSection: number;
  sectionsCount: number;
  nextSectionLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
  onFinalize: () => void;
  isSaving: boolean;
  disabled?: boolean;
}

export function CaseActionBar({
  activeSection,
  sectionsCount,
  nextSectionLabel,
  onPrevious,
  onNext,
  onFinalize,
  isSaving,
  disabled = false,
}: CaseActionBarProps) {
  const isFirst = activeSection === 0;
  const isLast = activeSection >= sectionsCount - 1;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 pt-5">
      <button
        type="button"
        disabled={isFirst}
        onClick={onPrevious}
        className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Previous Section</span>
      </button>

      {!isLast ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-clinical-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700 focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:ring-offset-2"
        >
          <span>Next: {nextSectionLabel ?? "Next Section"}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onFinalize}
          disabled={isSaving || disabled}
          aria-busy={isSaving}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-700 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{isSaving ? "Finalizing Consultation..." : "Finalize Consultation"}</span>
        </button>
      )}
    </div>
  );
}
