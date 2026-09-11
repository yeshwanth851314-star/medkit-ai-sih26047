"use client";

import React from "react";

interface ExaminationSectionProps {
  bloodPressure: string;
  setBloodPressure: (val: string) => void;
  pulse: string;
  setPulse: (val: string) => void;
  temperature: string;
  setTemperature: (val: string) => void;
  spo2: string;
  setSpo2: (val: string) => void;
  examNotes: string;
  setExamNotes: (val: string) => void;
}

export function ExaminationSection({
  bloodPressure,
  setBloodPressure,
  pulse,
  setPulse,
  temperature,
  setTemperature,
  spo2,
  setSpo2,
  examNotes,
  setExamNotes,
}: ExaminationSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Vitals &amp; Physical Examination</h2>
        <p className="text-xs text-slate-500 mt-0.5">Recorded by clinician during consultation</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label htmlFor="exam-bp" className="block text-xs font-semibold text-slate-700 mb-1">
            Blood Pressure (mmHg)
          </label>
          <input
            id="exam-bp"
            type="text"
            value={bloodPressure}
            onChange={(e) => setBloodPressure(e.target.value)}
            placeholder="120/80"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-clinical-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="exam-pulse" className="block text-xs font-semibold text-slate-700 mb-1">
            Pulse (bpm)
          </label>
          <input
            id="exam-pulse"
            type="text"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            placeholder="72"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-clinical-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="exam-temp" className="block text-xs font-semibold text-slate-700 mb-1">
            Temperature (&deg;F)
          </label>
          <input
            id="exam-temp"
            type="text"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="98.6"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-clinical-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="exam-spo2" className="block text-xs font-semibold text-slate-700 mb-1">
            SpO2 (%)
          </label>
          <input
            id="exam-spo2"
            type="text"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            placeholder="98"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-clinical-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="exam-notes" className="block text-xs font-semibold text-slate-700 mb-1">
          Clinical Examination Findings
        </label>
        <textarea
          id="exam-notes"
          rows={3}
          value={examNotes}
          onChange={(e) => setExamNotes(e.target.value)}
          placeholder="e.g. Chest: Clear bilaterally. Throat: Mild erythema, no tonsillar exudates."
          className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:ring-2 focus:ring-clinical-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
