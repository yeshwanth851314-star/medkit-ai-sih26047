"use client";

import React from "react";

interface HpiSectionProps {
  onset: string;
  setOnset: (val: string) => void;
  duration: string;
  setDuration: (val: string) => void;
  character: string;
  setCharacter: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  radiation: string;
  setRadiation: (val: string) => void;
  severity: string;
  setSeverity: (val: string) => void;
  aggravatingFactors: string;
  setAggravatingFactors: (val: string) => void;
  relievingFactors: string;
  setRelievingFactors: (val: string) => void;
}

export function HpiSection({
  onset,
  setOnset,
  duration,
  setDuration,
  character,
  setCharacter,
  location,
  setLocation,
  radiation,
  setRadiation,
  severity,
  setSeverity,
  aggravatingFactors,
  setAggravatingFactors,
  relievingFactors,
  setRelievingFactors,
}: HpiSectionProps) {
  return (
    <section aria-labelledby="section-hpi" className="space-y-6">
      <div>
        <h2 id="section-hpi" className="text-lg font-bold text-slate-900">
          2. History of Present Illness (HPI)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Structured chronological analysis of symptom progression, onset, and severity
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="sr-only">Symptom Details and Modifying Factors</legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="hpi-onset-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Onset
            </label>
            <input
              id="hpi-onset-input"
              type="text"
              value={onset}
              onChange={(e) => setOnset(e.target.value)}
              placeholder="e.g. Acute 3 days ago / Gradual over 2 weeks"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-duration-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Duration
            </label>
            <input
              id="hpi-duration-input"
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 14 days"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-character-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Character / Nature of Symptoms
            </label>
            <input
              id="hpi-character-input"
              type="text"
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              placeholder="e.g. Dry, hacking / Burning / Throbbing"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-severity-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Severity
            </label>
            <select
              id="hpi-severity-select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            >
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="hpi-location-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Anatomical Location
            </label>
            <input
              id="hpi-location-input"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Retrosternal / Epigastric / Throat"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-radiation-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Radiation / Spread
            </label>
            <input
              id="hpi-radiation-input"
              type="text"
              value={radiation}
              onChange={(e) => setRadiation(e.target.value)}
              placeholder="e.g. Radiating to back / jaw / left arm"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-aggravating-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Aggravating Factors
            </label>
            <input
              id="hpi-aggravating-input"
              type="text"
              value={aggravatingFactors}
              onChange={(e) => setAggravatingFactors(e.target.value)}
              placeholder="e.g. Cold exposure, physical exertion, night time"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="hpi-relieving-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Relieving Factors
            </label>
            <input
              id="hpi-relieving-input"
              type="text"
              value={relievingFactors}
              onChange={(e) => setRelievingFactors(e.target.value)}
              placeholder="e.g. Warm liquids, rest, sitting upright"
              className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none transition-all"
            />
          </div>
        </div>
      </fieldset>
    </section>
  );
}
