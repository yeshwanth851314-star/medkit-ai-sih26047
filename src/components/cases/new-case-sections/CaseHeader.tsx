"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Stethoscope, Leaf, WifiOff, Clock } from "lucide-react";

interface CaseHeaderProps {
  patientId: string;
  caseType: "general" | "ayush";
  setCaseType: (type: "general" | "ayush") => void;
  patientLanguage: string;
  setPatientLanguage: (lang: string) => void;
  savedCaseId: string | null;
  lastSavedTime: string | null;
  isSaving: boolean;
}

export function CaseHeader({
  patientId,
  caseType,
  setCaseType,
  patientLanguage,
  setPatientLanguage,
  savedCaseId,
  lastSavedTime,
  isSaving,
}: CaseHeaderProps) {
  return (
    <div className="mb-6 rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/doctor/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
            {savedCaseId && (
              <span className="rounded-full bg-clinical-50 px-2.5 py-0.5 text-xs font-semibold text-clinical-700 border border-clinical-200">
                Draft Case #{savedCaseId.slice(0, 8)}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Clinical Consultation & Case-Taking
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Patient ID: <span className="font-mono font-semibold text-slate-900">{patientId || "Select Patient"}</span>
          </p>
        </div>

        {/* Global Case Settings */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Case Type Toggle */}
          <div className="inline-flex rounded-lg border border-surface-200 bg-surface-50 p-1" role="group" aria-label="Clinical System">
            <button
              type="button"
              onClick={() => setCaseType("general")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                caseType === "general"
                  ? "bg-white text-clinical-900 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={caseType === "general"}
            >
              <Stethoscope className="h-3.5 w-3.5 text-clinical-600" />
              <span>Allopathy / General</span>
            </button>
            <button
              type="button"
              onClick={() => setCaseType("ayush")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                caseType === "ayush"
                  ? "bg-white text-emerald-900 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={caseType === "ayush"}
            >
              <Leaf className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ayush / Ayurveda (AIIA)</span>
            </button>
          </div>

          {/* Consultation Language */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="case-language-select" className="text-xs font-medium text-slate-500">
              Lang:
            </label>
            <select
              id="case-language-select"
              value={patientLanguage}
              onChange={(e) => setPatientLanguage(e.target.value)}
              className="rounded-md border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500"
            >
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Auto-save & Status Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-surface-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {lastSavedTime ? (
            <span>
              Last saved at <span className="font-medium text-slate-700">{lastSavedTime}</span>
            </span>
          ) : (
            <span>New unsaved draft</span>
          )}
          {isSaving && <span className="ml-1 text-clinical-600 font-medium animate-pulse">Saving...</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline-Ready Client Storage Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}
