"use client";

import React from "react";

interface ChiefComplaintSectionProps {
  chiefComplaint: string;
  setChiefComplaint: (val: string) => void;
  rawPatientComplaint: string;
  setRawPatientComplaint: (val: string) => void;
  patientLanguage: string;
}

export function ChiefComplaintSection({
  chiefComplaint,
  setChiefComplaint,
  rawPatientComplaint,
  setRawPatientComplaint,
  patientLanguage,
}: ChiefComplaintSectionProps) {
  return (
    <section aria-labelledby="section-chief-complaint" className="space-y-6">
      <div>
        <h2 id="section-chief-complaint" className="text-lg font-bold text-slate-900">
          1. Chief Complaint &amp; Intake
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Capture the patient&apos;s primary clinical complaint and verbatim narrative
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="chief-complaint-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Normalized Chief Complaint <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <textarea
            id="chief-complaint-input"
            rows={3}
            required
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="e.g. Persistent dry cough for 2 weeks with throat irritation, worse at night"
            aria-describedby="chief-complaint-hint"
            className="block w-full rounded-lg border border-surface-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
          />
          <span id="chief-complaint-hint" className="text-xs text-slate-500 mt-1 block">
            Provide a standardized clinical summary of primary symptoms. Minimum 3 characters for finalization.
          </span>
        </div>

        <div>
          <label htmlFor="raw-patient-complaint-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Raw Patient Verbatim (Preserve Original Spoken Phrase)
          </label>
          <input
            id="raw-patient-complaint-input"
            type="text"
            value={rawPatientComplaint}
            onChange={(e) => setRawPatientComplaint(e.target.value)}
            placeholder={
              patientLanguage === "te"
                ? "ఉదా. రెండు వారాలుగా గొంతులో మంట, దగ్గు ఎక్కువగా వస్తోంది"
                : "e.g. Coughing constantly for the past 2 weeks, throat hurts when swallowing"
            }
            lang={patientLanguage === "te" ? "te" : "en"}
            aria-describedby="raw-complaint-hint"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
          />
          <span id="raw-complaint-hint" className="text-xs text-slate-500 mt-1 block">
            Clinical provenance rule: Original patient wording is retained for clinical fidelity and medicolegal audit.
          </span>
        </div>
      </div>
    </section>
  );
}
