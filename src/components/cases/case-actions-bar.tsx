"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClinicalCase, Patient, MedicalDocument } from "@/types/database";
import dynamic from "next/dynamic";
import { mapCaseToFhirBundle } from "@/features/interoperability/fhir-mapper";
import { ContextualHelp } from "@/components/help/contextual-help";

const FhirPreviewDrawer = dynamic(
  () => import("@/components/interoperability/fhir-preview-drawer").then((m) => m.FhirPreviewDrawer),
  { ssr: false }
);
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
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [amendError, setAmendError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAmendModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAmendModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAmendModalOpen]);

  const handleFinalizeCase = async () => {
    setIsFinalizing(true);
    try {
      const res = await fetch(`/api/cases/${clinicalCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err: any) {
      console.error("Failed to finalize case", err);
    } finally {
      setIsFinalizing(false);
    }
  };

  const [fhirBundle, setFhirBundle] = useState<any>(null);

  const handleOpenFhir = () => {
    try {
      const bundle = mapCaseToFhirBundle({
        clinicalCase,
        patient,
        documents,
      });
      setFhirBundle(bundle);
    } catch (err) {
      console.error("Failed to generate FHIR bundle on demand:", err);
    }
    setIsFhirOpen(true);
  };

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
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 hover:text-clinical-700 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5 text-clinical-600" />
          <span>Timeline &amp; What Changed</span>
        </Link>

        {/* FHIR R4 / ABDM Preview Button */}
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={handleOpenFhir}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 hover:text-clinical-700 transition-colors"
          >
            <FileCode className="h-3.5 w-3.5 text-clinical-600" />
            <span>FHIR R4 / ABDM View</span>
          </button>
          <ContextualHelp topic="fhir" />
        </div>

        {/* Finalize Case Button (for draft cases) */}
        {clinicalCase.status === "draft" && (
          <button
            type="button"
            onClick={handleFinalizeCase}
            disabled={isFinalizing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{isFinalizing ? "Finalizing..." : "Finalize Case"}</span>
          </button>
        )}

        {/* Post-finalization Amendment Button */}
        {clinicalCase.status === "final" && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsAmendModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100/50 transition-colors"
            >
              <FileEdit className="h-3.5 w-3.5 text-amber-600" />
              <span>Add Addendum</span>
            </button>
            <ContextualHelp topic="addendum" />
          </div>
        )}

        {/* Print Case Sheet */}
        <Link
          href={`/doctor/cases/${clinicalCase.id}/print`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50"
        >
          <Printer className="h-3.5 w-3.5 text-slate-500" />
          <span>Print Case Sheet</span>
        </Link>
      </div>

      {/* FHIR Drawer */}
      {isFhirOpen && fhirBundle && (
        <FhirPreviewDrawer
          bundle={fhirBundle}
          isOpen={isFhirOpen}
          onClose={() => setIsFhirOpen(false)}
        />
      )}

      {/* Amendment Modal */}
      {isAmendModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="addendum-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAmendModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-600" />
                <h3 id="addendum-modal-title" className="text-sm font-bold text-slate-900">
                  Append Clinical Addendum to Case
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAmendModalOpen(false)}
                aria-label="Close addendum modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-surface-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
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
