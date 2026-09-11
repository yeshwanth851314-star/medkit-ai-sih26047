"use client";

import React from "react";

interface AssessmentPlanSectionProps {
  assessmentSummary: string;
  setAssessmentSummary: (val: string) => void;
  treatmentPlan: string;
  setTreatmentPlan: (val: string) => void;
}

export function AssessmentPlanSection({
  assessmentSummary,
  setAssessmentSummary,
  treatmentPlan,
  setTreatmentPlan,
}: AssessmentPlanSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Clinician Assessment &amp; Treatment Plan</h2>
        <p className="text-xs text-slate-500 mt-0.5">Physician-owned conclusions, prescription, and counselling</p>
      </div>

      <div>
        <label htmlFor="assessment-summary" className="block text-xs font-semibold text-slate-700 mb-1">
          Clinical Impression / Summary
        </label>
        <textarea
          id="assessment-summary"
          rows={3}
          value={assessmentSummary}
          onChange={(e) => setAssessmentSummary(e.target.value)}
          placeholder="e.g. Upper respiratory tract allergy with dry cough. No signs of infection."
          className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:ring-2 focus:ring-clinical-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="treatment-plan" className="block text-xs font-semibold text-slate-700 mb-1">
          Management &amp; Prescription Plan
        </label>
        <textarea
          id="treatment-plan"
          rows={4}
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          placeholder="e.g. Tab Levocetirizine 5mg 1 tab OD at bedtime x 7 days. Warm saline gargles. Return if fever develops."
          className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:ring-2 focus:ring-clinical-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
