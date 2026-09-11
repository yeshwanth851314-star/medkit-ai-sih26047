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
  X,
  FileCheck,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export function DocumentExtractionViewer({
  initialExtraction,
  filename = "document_preview.pdf",
  fileUrl,
}: {
  initialExtraction: DocumentExtractionResult;
  filename?: string;
  fileUrl?: string;
}) {
  const [extraction, setExtraction] = useState<DocumentExtractionResult>(initialExtraction);
  const [verifyingItem, setVerifyingItem] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<string | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemType, setEditingItemType] = useState<"med" | "test" | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAcceptCandidate = async (
    type: "med" | "test",
    candidateId: string,
    candidateName: string
  ) => {
    setActionError(null);
    setVerifyingItem(candidateId || candidateName);
    try {
      const res = await fetch(`/api/documents/${extraction.documentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          candidateName,
          candidateType: type === "med" ? "medication" : "test",
          action: "accept",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.extraction) {
        throw new Error(data.error || "Failed to confirm candidate on server");
      }
      setExtraction(data.extraction);
    } catch (err: any) {
      // Never fall back to local verification: fail closed
      setActionError(err.message || "Failed to verify candidate. Please check connection and try again.");
    } finally {
      setVerifyingItem(null);
    }
  };

  const handleRejectCandidate = async (
    type: "med" | "test",
    candidateId: string,
    candidateName: string
  ) => {
    setActionError(null);
    setRejectingItem(candidateId || candidateName);
    try {
      const res = await fetch(`/api/documents/${extraction.documentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          candidateName,
          candidateType: type === "med" ? "medication" : "test",
          action: "reject",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.extraction) {
        throw new Error(data.error || "Failed to reject candidate on server");
      }
      setExtraction(data.extraction);
    } catch (err: any) {
      setActionError(err.message || "Failed to reject candidate. Please check connection and try again.");
    } finally {
      setRejectingItem(null);
    }
  };

  const handleSaveEdit = async () => {
    if (editingItemIndex === null || !editingItemType) return;
    setActionError(null);
    const medsList = extraction.extractedData.medications || [];
    const testsList = extraction.extractedData.tests || [];
    const item = editingItemType === "med" ? medsList[editingItemIndex] : testsList[editingItemIndex];
    if (!item) return;

    try {
      const res = await fetch(`/api/documents/${extraction.documentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: item.id || item.name,
          candidateName: item.name,
          candidateType: editingItemType === "med" ? "medication" : "test",
          action: "edit",
          updatedValue: editValue,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.extraction) {
        throw new Error(data.error || "Failed to save edited candidate value on server");
      }
      setExtraction(data.extraction);
      setEditingItemIndex(null);
      setEditingItemType(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to save edit on server.");
    }
  };

  const isFailed = extraction.status === "failed";
  const meds = extraction.extractedData.medications || [];
  const tests = extraction.extractedData.tests || [];
  const unverifiedCount = meds.filter((m: any) => m.status !== "verified").length;

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header with Mandatory Safety Disclaimer */}
      <div>
        <div className="flex items-center justify-between border-b border-surface-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-clinical-600" />
            <h2 className="text-base font-bold text-slate-900">
              Multimodal Document Digitization &amp; OCR
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-surface-100 border border-surface-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase font-mono">
              {extraction.documentType}
            </span>
            {unverifiedCount === 0 && meds.length > 0 ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                All Verified
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                {unverifiedCount} Pending Review
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Safety Mandate:</strong> {extraction.disclaimer} OCR confidence is not clinical confidence. Unverified extractions do not become final clinical truth until confirmed.
          </div>
        </div>

        {actionError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span><strong>Verification Error:</strong> {actionError}</span>
          </div>
        )}
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
          {/* Left Column: Original Document / Authorized Viewer */}
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-surface-200 pb-2">
              <span>Source Artifact: {filename}</span>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-clinical-600 hover:text-clinical-800"
                >
                  <ExternalLink className="h-3 w-3" /> Open in Viewer
                </a>
              )}
            </div>

            {fileUrl && (fileUrl.endsWith(".pdf") || fileUrl.includes("pdf")) ? (
              <iframe
                src={fileUrl}
                title={filename}
                className="h-80 w-full rounded-lg border border-surface-200 bg-white"
              />
            ) : fileUrl ? (
              <div className="h-80 w-full overflow-auto rounded-lg border border-surface-200 bg-white flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl}
                  alt={filename}
                  className="max-h-full max-w-full object-contain rounded"
                />
              </div>
            ) : (
              <div className="h-80 rounded-lg bg-white border border-surface-200 p-4 font-mono text-[11px] text-slate-600 overflow-y-auto space-y-2 shadow-inner">
                <div className="text-center font-bold text-slate-900 border-b pb-1">
                  {extraction.extractedData.doctor_name || extraction.extractedData.laboratory || "CLINICAL FACILITY ARTIFACT"}
                </div>
                <div className="text-right text-[10px] text-slate-400">Date: {extraction.extractedData.date || "2026-08-10"}</div>

                {meds.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <div className="font-bold text-slate-800">Prescribed Regimens:</div>
                    {meds.map((m: any, i: number) => (
                      <div key={i} className="pl-3">
                        &bull; {m.name} — {m.dosage} ({m.duration || "unspecified"})
                      </div>
                    ))}
                  </div>
                )}

                {tests.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <div className="font-bold text-slate-800">Diagnostic Findings:</div>
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
            )}
          </div>

          {/* Right Column: Candidate Fields with Verification Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-surface-200 pb-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Candidate Extracted Fields</span>
              <span className="font-semibold text-clinical-700">
                OCR Confidence: {Math.round(extraction.confidence * 100)}%
              </span>
            </div>

            {/* Medications Extraction List with Per-Candidate Actions */}
            {meds.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Extracted Medications</span>
                {meds.map((m: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl border border-surface-200 p-3 bg-white hover:border-clinical-300 transition-all text-xs flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">{m.name}</strong>
                        <span className="rounded bg-clinical-50 text-clinical-700 px-1.5 py-0.5 text-[10px] font-medium">
                          p.{m.pageRef || 1}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Math.round((m.confidence || extraction.confidence) * 100)}% match
                        </span>
                      </div>
                      {editingItemIndex === i && editingItemType === "med" ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="rounded border border-surface-300 px-2 py-0.5 text-xs text-slate-800"
                            placeholder="Dosage..."
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="rounded bg-clinical-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemIndex(null);
                              setEditingItemType(null);
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-slate-600 mt-0.5">
                          {m.dosage} {m.duration ? `• ${m.duration}` : ""}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.status === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <Check className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : m.status === "rejected" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                          <X className="h-3.5 w-3.5" /> Rejected
                        </span>
                      ) : (
                        <>
                          <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Candidate
                          </span>
                          <button
                            type="button"
                            disabled={verifyingItem === (m.id || m.name)}
                            onClick={() => handleAcceptCandidate("med", m.id || m.name, m.name)}
                            className="inline-flex items-center gap-1 rounded-lg bg-clinical-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700 disabled:opacity-40"
                            title="Accept and verify candidate"
                            aria-label="Verify & Confirm medication"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            {verifyingItem === (m.id || m.name) ? "..." : "Verify & Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemIndex(i);
                              setEditingItemType("med");
                              setEditValue(m.dosage || "");
                            }}
                            className="rounded-lg border border-surface-200 p-2 text-slate-500 hover:bg-surface-100 hover:text-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-clinical-500"
                            title="Edit dosage"
                            aria-label={`Edit dosage for ${m.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={rejectingItem === (m.id || m.name)}
                            onClick={() => handleRejectCandidate("med", m.id || m.name, m.name)}
                            className="rounded-lg border border-surface-200 p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            title="Reject candidate"
                            aria-label={`Reject candidate medication ${m.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lab Tests Extraction List with Reject & Edit */}
            {tests.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Extracted Lab Parameters</span>
                <div className="space-y-1.5">
                  {tests.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-surface-200 p-2.5 bg-white text-xs gap-2"
                    >
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800">{t.name}</span>
                        <span className="text-slate-400 text-[10px] ml-2">ref: {t.reference}</span>
                        {editingItemIndex === i && editingItemType === "test" ? (
                          <div className="flex items-center gap-2 mt-1.5">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="rounded border border-surface-300 px-2 py-0.5 text-xs text-slate-800"
                              placeholder="Value..."
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="rounded bg-clinical-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemIndex(null);
                                setEditingItemType(null);
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null}
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
                        {t.status === "verified" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <Check className="h-3 w-3" /> Verified
                          </span>
                        ) : t.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                            <X className="h-3 w-3" /> Rejected
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={verifyingItem === (t.id || t.name)}
                              onClick={() => handleAcceptCandidate("test", t.id || t.name, t.name)}
                              className="inline-flex items-center gap-0.5 rounded bg-clinical-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-clinical-700 disabled:opacity-40 min-h-[32px] focus:outline-none focus:ring-2 focus:ring-clinical-500"
                              title="Accept and verify test"
                              aria-label={`Accept and verify lab test ${t.name}`}
                            >
                              <Check className="h-3 w-3" />
                              {verifyingItem === (t.id || t.name) ? "..." : "Accept"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemIndex(i);
                                setEditingItemType("test");
                                setEditValue(t.value || "");
                              }}
                              className="text-slate-400 hover:text-slate-600 p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-clinical-500"
                              title="Edit test value"
                              aria-label={`Edit test value for ${t.name}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={rejectingItem === (t.id || t.name)}
                              onClick={() => handleRejectCandidate("test", t.id || t.name, t.name)}
                              className="text-slate-400 hover:text-rose-600 ml-1 p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              title="Reject candidate"
                              aria-label={`Reject candidate lab test ${t.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
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
