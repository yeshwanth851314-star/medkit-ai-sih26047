"use client";

import { useState } from "react";
import { DocumentExtractionResult } from "@/features/documents/types";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pill,
  ExternalLink,
  Check,
  Edit2,
  FileCheck,
} from "lucide-react";

export function DocumentExtractionViewer({
  initialExtraction,
  filename = "document_preview.pdf",
}: {
  initialExtraction: DocumentExtractionResult;
  filename?: string;
}) {
  const [extraction, setExtraction] = useState<DocumentExtractionResult>(initialExtraction);
  const [verifyingMed, setVerifyingMed] = useState<string | null>(null);

  const handleVerifyMedication = async (medName: string) => {
    setVerifyingMed(medName);
    try {
      const res = await fetch(`/api/documents/${extraction.documentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationName: medName }),
      });
      const data = await res.json();
      if (res.ok && data.extraction) {
        setExtraction(data.extraction);
      }
    } catch {
      console.error("Failed to verify medication");
    } finally {
      setVerifyingMed(null);
    }
  };

  const isFailed = extraction.status === "failed";
  const meds = extraction.extractedData.medications || [];
  const tests = extraction.extractedData.tests || [];

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs space-y-6">
      {/* Header with Mandatory Safety Disclaimer */}
      <div>
        <div className="flex items-center justify-between border-b border-surface-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-clinical-600" />
            <h2 className="text-base font-bold text-slate-900">
              Multimodal Document Digitization &amp; OCR
            </h2>
          </div>
          <span className="rounded-md bg-surface-100 border border-surface-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase font-mono">
            {extraction.documentType}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Safety Mandate:</strong> {extraction.disclaimer} OCR confidence is not clinical confidence. Unverified extractions do not become final clinical truth until confirmed.
          </div>
        </div>
      </div>

      {isFailed ? (
        /* Graceful Degradation / Failure View */
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <h3 className="text-sm font-bold text-red-900">Document Extraction Could Not Be Completed</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">
            {extraction.errorMessage || "The uploaded scan is too blurry or obscured for reliable automated OCR."}
          </p>
          <p className="text-[11px] text-slate-500 italic">
            The original file is safely preserved in encrypted storage. You may review the original image and enter details manually.
          </p>
        </div>
      ) : (
        /* Side-by-Side Review Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Original Document Simulated Preview */}
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-surface-200 pb-2">
              <span>Source Artifact: {filename}</span>
              <span className="text-slate-400 font-mono">Page 1 of 1</span>
            </div>

            <div className="h-72 rounded-lg bg-white border border-surface-200 p-4 font-mono text-[11px] text-slate-600 overflow-y-auto space-y-2 shadow-inner">
              <div className="text-center font-bold text-slate-900 border-b pb-1">
                {extraction.extractedData.doctor_name || extraction.extractedData.laboratory || "CLINICAL FACILITY (DEMO SCAN)"}
              </div>
              <div className="text-right text-[10px] text-slate-400">Date: {extraction.extractedData.date || "2026-08-10"}</div>

              {meds.length > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="font-bold text-slate-800">Rx:</div>
                  {meds.map((m: any, i: number) => (
                    <div key={i} className="pl-3">
                      &bull; {m.name} — {m.dosage} ({m.duration})
                    </div>
                  ))}
                </div>
              )}

              {tests.length > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="font-bold text-slate-800">LAB RESULTS:</div>
                  {tests.map((t: any, i: number) => (
                    <div key={i} className="pl-3 flex justify-between">
                      <span>{t.name}:</span>
                      <span className="font-bold">{t.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {extraction.extractedData.instructions && (
                <div className="pt-2 text-[10px] text-slate-500 italic">
                  Notes: {extraction.extractedData.instructions}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Candidate Fields with Verification Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-surface-200 pb-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Candidate Extracted Fields</span>
              <span className="font-semibold text-clinical-700">
                Confidence: {Math.round(extraction.confidence * 100)}%
              </span>
            </div>

            {/* Medications Extraction List */}
            {meds.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Extracted Medications</span>
                {meds.map((m: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl border border-surface-200 p-3 bg-white hover:border-clinical-300 transition-all text-xs flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">{m.name}</strong>
                        <span className="rounded bg-clinical-50 text-clinical-700 px-1.5 py-0.5 text-[10px] font-medium">
                          p.{m.pageRef || 1}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Math.round((m.confidence || extraction.confidence) * 100)}% match
                        </span>
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        {m.dosage} {m.duration ? `• ${m.duration}` : ""}
                      </div>
                    </div>

                    <div>
                      {m.status === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <Check className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={verifyingMed === m.name}
                          onClick={() => handleVerifyMedication(m.name)}
                          className="inline-flex items-center gap-1 rounded-lg bg-clinical-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-clinical-700 disabled:opacity-40"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          {verifyingMed === m.name ? "Verifying..." : "Verify & Confirm"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lab Tests Extraction List */}
            {tests.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Extracted Lab Parameters</span>
                <div className="space-y-1.5">
                  {tests.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-surface-200 p-2.5 bg-white text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{t.name}</span>
                        <span className="text-slate-400 text-[10px] ml-2">ref: {t.reference}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{t.value}</span>
                        {t.flag === "high" && (
                          <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.2 text-[10px] font-bold uppercase">
                            HIGH
                          </span>
                        )}
                        {t.flag === "low" && (
                          <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold uppercase">
                            LOW
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
