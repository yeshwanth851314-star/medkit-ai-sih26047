"use client";

import React, { useState } from "react";
import { BilingualEntry } from "../../features/i18n/types";
import { t } from "../../features/i18n/dictionary";

interface BilingualTranscriptCardProps {
  entry: BilingualEntry;
  onVerify?: (verifiedEntry: BilingualEntry) => void;
  canEdit?: boolean;
}

export function BilingualTranscriptCard({
  entry,
  onVerify,
  canEdit = true,
}: BilingualTranscriptCardProps) {
  const [currentEntry, setCurrentEntry] = useState<BilingualEntry>(entry);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEnglish, setEditedEnglish] = useState(entry.normalizedEnglish);

  const handleVerify = () => {
    const updated: BilingualEntry = {
      ...currentEntry,
      normalizedEnglish: editedEnglish,
      isVerified: true,
      verifiedBy: "Dr. Clinician Reviewer",
      verifiedAt: new Date().toISOString(),
    };
    setCurrentEntry(updated);
    setIsEditing(false);
    if (onVerify) {
      onVerify(updated);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {currentEntry.originalLanguage === "te"
              ? "తెలుగు (Telugu)"
              : currentEntry.originalLanguage === "hi"
              ? "हिन्दी (Hindi)"
              : "English"}
          </span>
          <span className="text-xs text-slate-500">
            Confidence: {Math.round(currentEntry.confidence * 100)}%
          </span>
        </div>

        <div>
          {currentEntry.isVerified ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-medium text-emerald-800">
              ✓ Verified by {currentEntry.verifiedBy}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800">
              Pending Clinician Audit
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Verbatim Native Script Box */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Patient Verbatim Speech (Original)
            </span>
            <span className="text-xs text-slate-400">Provenance: {currentEntry.provenance}</span>
          </div>
          <p className="mt-2 text-base font-medium leading-relaxed text-slate-900">
            {currentEntry.originalText}
          </p>
          <div className="mt-3 flex items-center text-xs font-medium text-blue-700">
            <svg
              className="mr-1.5 h-4 w-4 shrink-0 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              {currentEntry.originalLanguage === "te"
                ? t("auditPreservationNotice", "te")
                : t("auditPreservationNotice", "en")}
            </span>
          </div>
        </div>

        {/* Normalized English Translation Box */}
        <div className="rounded-lg border border-slate-100 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Clinical English Translation
            </span>
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
              >
                Edit Translation
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editedEnglish}
                onChange={(e) => setEditedEnglish(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Apply Edit
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-base font-normal leading-relaxed text-slate-800">
              {editedEnglish}
            </p>
          )}

          {currentEntry.clinicalEntities?.concepts && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {currentEntry.clinicalEntities.concepts.map((concept: string) => (
                <span
                  key={concept}
                  className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200"
                >
                  #{concept}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!currentEntry.isVerified && onVerify && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleVerify}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✓ Verify & Confirm Translation
          </button>
        </div>
      )}
    </div>
  );
}
