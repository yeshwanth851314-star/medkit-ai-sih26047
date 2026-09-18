"use client";

import React, { useState } from "react";
import {
  Clock,
  AlertTriangle,
  ShieldCheck,
  Pill,
  AlertCircle,
  FlaskConical,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { ClinicalCase } from "@/types/database";

interface DoctorQuickViewProps {
  clinicalCase: ClinicalCase;
  patientName?: string;
  hasChangedSinceLastVisit?: boolean;
  changesSummary?: string[];
  pendingDiagnosticsCount?: number;
}

export function DoctorQuickView({
  clinicalCase: c,
  patientName,
  hasChangedSinceLastVisit,
  changesSummary,
  pendingDiagnosticsCount = 0,
}: DoctorQuickViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute Case Readiness Score
  let score = 0;
  const missingItems: string[] = [];

  if (c.chief_complaint) score += 20;
  else missingItems.push("Chief Complaint");

  if (c.hpi?.duration || c.hpi?.onset) score += 20;
  else missingItems.push("HPI Duration / Onset");

  if (c.allergy_history !== undefined && c.allergy_history !== null) score += 15;
  else missingItems.push("Allergy Review");

  if (c.medication_history !== undefined && c.medication_history !== null) score += 15;
  else missingItems.push("Medication Reconciliation");

  if (c.examination && Object.keys(c.examination).length > 0) score += 15;
  else missingItems.push("Physical / Systemic Examination");

  if (c.assessment_plan?.summary || c.assessment_plan?.plan) score += 15;
  else missingItems.push("Assessment & Treatment Plan");

  const redFlagsCount = c.red_flags?.length || 0;
  const allergiesCount = c.allergy_history?.length || 0;
  const medsCount = c.medication_history?.length || 0;

  return (
    <div className="rounded-2xl border border-clinical-200 bg-gradient-to-br from-clinical-50/70 via-white to-clinical-50/40 p-5 shadow-sm space-y-4 no-print">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                15-Second Doctor View
              </h2>
              <span className="rounded-full bg-clinical-100 text-clinical-800 text-[10px] font-bold px-2 py-0.5">
                AI Rapid Glance
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              High-priority clinical snapshot compiled from verified intake records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Readiness Meter Badge */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-surface-200 shadow-2xs">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Readiness</div>
              <div className={`text-xs font-black ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {score}%
              </div>
            </div>
            <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-surface-100"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 6 Rapid Glance Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            {/* 1. Chief Complaint & Duration */}
            <div className="bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Complaint &amp; Duration</span>
              <div className="font-bold text-slate-900 truncate" title={c.chief_complaint}>
                {c.chief_complaint}
              </div>
              <div className="text-[11px] text-clinical-700 font-medium">
                {c.hpi?.duration || c.hpi?.onset || "Duration pending"}
              </div>
            </div>

            {/* 2. Red Flags */}
            <div className={`p-3 rounded-xl border shadow-2xs space-y-1 ${
              redFlagsCount > 0 ? "bg-red-50/80 border-red-200" : "bg-white border-surface-200/80"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Safety Flags</span>
                {redFlagsCount > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
              <div className={`font-bold ${redFlagsCount > 0 ? "text-red-700" : "text-slate-700"}`}>
                {redFlagsCount > 0 ? `${redFlagsCount} Alert(s)` : "None Flagged"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {redFlagsCount > 0 ? c.red_flags?.[0]?.message || "High severity" : "Safe for routine OPD"}
              </div>
            </div>

            {/* 3. Known Allergies */}
            <div className="bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Allergies</span>
              <div className={`font-bold ${allergiesCount > 0 ? "text-amber-700" : "text-slate-700"}`}>
                {allergiesCount > 0 ? `${allergiesCount} Documented` : "NKDA (None)"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {allergiesCount > 0
                  ? c.allergy_history?.map((a) => a.substance).join(", ")
                  : "No known drug allergies"}
              </div>
            </div>

            {/* 4. Current Medications */}
            <div className="bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Active Meds</span>
                <Pill className="h-3 w-3 text-slate-400" />
              </div>
              <div className="font-bold text-slate-900">
                {medsCount > 0 ? `${medsCount} Regular Drug(s)` : "None Reported"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {medsCount > 0
                  ? c.medication_history?.map((m) => m.name).join(", ")
                  : "Patient is med-free"}
              </div>
            </div>

            {/* 5. Pending Diagnostics */}
            <div className="bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Lab Orders</span>
                <FlaskConical className="h-3 w-3 text-slate-400" />
              </div>
              <div className="font-bold text-slate-900">
                {pendingDiagnosticsCount > 0 ? `${pendingDiagnosticsCount} Active Order(s)` : "All Cleared"}
              </div>
              <div className="text-[11px] text-slate-500">
                {pendingDiagnosticsCount > 0 ? "Awaiting technician" : "No pending results"}
              </div>
            </div>

            {/* 6. Longitudinal Change */}
            <div className="bg-white p-3 rounded-xl border border-surface-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Visit Delta</span>
                <Activity className="h-3 w-3 text-clinical-600" />
              </div>
              <div className="font-bold text-slate-900 truncate">
                {hasChangedSinceLastVisit ? "Changes Detected" : "First Encounter"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {hasChangedSinceLastVisit
                  ? (changesSummary?.[0] || "Longitudinal update")
                  : "Baseline encounter"}
              </div>
            </div>
          </div>

          {/* Missing Checklist if score < 100 */}
          {missingItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-surface-100/80 rounded-xl px-3 py-2 border border-surface-200">
              <span className="font-bold text-slate-600">Pending Documentation:</span>
              {missingItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-md bg-white border border-surface-300 px-2 py-0.5 text-slate-700 font-medium"
                >
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  {item}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
