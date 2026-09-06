"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClinicalCase, Patient, MedicalDocument } from "@/types/database";
import { mapCaseToFhirBundle } from "@/features/interoperability/fhir-mapper";
import { FhirPreviewDrawer } from "@/components/interoperability/fhir-preview-drawer";
import {
  FileCode,
  Printer,
  TrendingUp,
  FileEdit,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  History,
} from "lucide-react";

interface CaseActionsBarProps {
  clinicalCase: ClinicalCase;
  patient: Patient;
  documents?: MedicalDocument[];
}

export function CaseActionsBar({ clinicalCase, patient, documents = [] }: CaseActionsBarProps) {
  const router = useRouter();
  const [isFhirOpen, setIsFhirOpen] = useState(false);
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("Addendum to treatment plan based on follow-up report");
  const [amendNotes, setAmendNotes] = useState("");
  const [isSubmittingAmend, setIsSubmittingAmend] = useState(false);
  const [amendError, setAmendError] = useState<string | null>(null);

  // Generate valid FHIR R4 Bundle on demand
  const fhirBundle = mapCaseToFhirBundle({
    clinicalCase,
    patient,
    documents,
  });

  const handleCreateAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendReason.trim() || !amendNotes.trim()) {
      setAmendError("Reason and amendment notes are required.");
      return;
    }

    setIsSubmittingAmend(true);
    setAmendError(null);

    try {
      const res = await fetch(`/api/cases/${clinicalCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "amend",
          reason: amendReason.trim(),
          notes: amendNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record amendment");

      setIsAmendModalOpen(false);
      setAmendNotes("");
      router.refresh();
    } catch (err: any) {
      setAmendError(err.message || "Failed to submit amendment");
    } finally {
      setIsSubmittingAmend(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 no-print">
        {/* Longitudinal Timeline CTA */}
        <Link
          href={`/doctor/patients/${patient.id}/timeline`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-50 hover:text-clinical-700 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5 text-clinical-600" />
          <span>Timeline &amp; What Changed</span>
        </Link>

        {/* FHIR R4 / ABDM Preview Button */}
        <button
          type="button"
          onClick={() => setIsFhirOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-50 hover:text-clinical-700 transition-colors"
        >
          <FileCode className="h-3.5 w-3.5 text-clinical-600" />
          <span>FHIR R4 / ABDM View</span>
        </button>

        {/* Post-finalization Amendment Button */}
        {clinicalCase.status === "final" && (
          <button
            type="button"
            onClick={() => setIsAmendModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100/50 transition-colors"
          >
            <FileEdit className="h-3.5 w-3.5 text-amber-600" />
            <span>Add Addendum</span>
          </button>
        )}

        {/* Print Case Sheet */}
        <Link
          href={`/doctor/cases/${clinicalCase.id}/print`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-50"
        >
          <Printer className="h-3.5 w-3.5 text-slate-500" />
          <span>Print Case Sheet</span>
        </Link>
      </div>

      {/* FHIR Drawer */}
      <FhirPreviewDrawer
        bundle={fhirBundle}
        isOpen={isFhirOpen}
        onClose={() => setIsFhirOpen(false)}
      />

      {/* Amendment Modal */}
      {isAmendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Append Clinical Addendum to Case
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAmendModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-surface-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This case is finalized. Medical ethics and regulatory compliance (ABDM/HIPAA) require that finalized clinical records are immutable. Revisions are recorded as numbered addenda with timestamp and clinician attribution.
            </p>

            {amendError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{amendError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAmendment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Addendum *
                </label>
                <input
                  type="text"
                  required
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  placeholder="e.g. New lab findings received; adjusted dosage"
                  className="block w-full rounded-lg border border-surface-200 p-2 text-xs focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Addendum Notes &amp; Clinical Action *
                </label>
                <textarea
                  rows={4}
                  required
                  value={amendNotes}
                  onChange={(e) => setAmendNotes(e.target.value)}
                  placeholder="State the additional findings, verified test results, or modified instructions..."
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-xs focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setIsAmendModalOpen(false)}
                  className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAmend}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isSubmittingAmend ? "Recording..." : "Sign & Append Addendum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
