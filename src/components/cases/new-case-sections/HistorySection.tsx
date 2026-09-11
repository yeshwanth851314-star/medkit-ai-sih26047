"use client";

import React from "react";

interface HistorySectionProps {
  chronicConditions: string;
  setChronicConditions: (val: string) => void;
  familyHistory: string;
  setFamilyHistory: (val: string) => void;
  diet: string;
  setDiet: (val: string) => void;
  sleep: string;
  setSleep: (val: string) => void;
}

export function HistorySection({
  chronicConditions,
  setChronicConditions,
  familyHistory,
  setFamilyHistory,
  diet,
  setDiet,
  sleep,
  setSleep,
}: HistorySectionProps) {
  return (
    <section aria-labelledby="section-history" className="space-y-6">
      <div>
        <h2 id="section-history" className="text-lg font-bold text-slate-900">
          3. Past Medical, Family &amp; Personal History
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Document known comorbidities, hereditary predispositions, diet, and lifestyle patterns
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="past-history-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Past Medical &amp; Surgical History
          </label>
          <textarea
            id="past-history-input"
            rows={2}
            value={chronicConditions}
            onChange={(e) => setChronicConditions(e.target.value)}
            placeholder="e.g. Hypertension (5 years, controlled), Type 2 Diabetes, Appendectomy in 2018"
            aria-describedby="past-history-hint"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
          />
          <span id="past-history-hint" className="text-xs text-slate-500 mt-1 block">
            Enter known conditions separated by commas or sentences.
          </span>
        </div>

        <div>
          <label htmlFor="family-history-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Family Medical History
          </label>
          <input
            id="family-history-input"
            type="text"
            value={familyHistory}
            onChange={(e) => setFamilyHistory(e.target.value)}
            placeholder="e.g. Father has Type 2 Diabetes; Mother has Hypertension"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dietary-habits-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Dietary Lifestyle
            </label>
            <select
              id="dietary-habits-select"
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            >
              <option value="Vegetarian">Vegetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Vegan">Vegan</option>
            </select>
          </div>

          <div>
            <label htmlFor="sleep-pattern-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Sleep Pattern
            </label>
            <select
              id="sleep-pattern-select"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            >
              <option value="Normal">Normal (7-8 hours restful)</option>
              <option value="Disturbed">Disturbed / Insomnia</option>
              <option value="Decreased">Decreased (&lt;5 hours)</option>
              <option value="Excessive">Excessive (&gt;9 hours)</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
