"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";

interface MedicationItem {
  name: string;
  dose: string;
}

interface AllergyItem {
  substance: string;
  reaction: string;
}

interface MedicationAllergySectionProps {
  medications: MedicationItem[];
  setMedications: (meds: MedicationItem[]) => void;
  newMedName: string;
  setNewMedName: (val: string) => void;
  newMedDose: string;
  setNewMedDose: (val: string) => void;
  addMedication: () => void;
  allergies: AllergyItem[];
  setAllergies: (allergies: AllergyItem[]) => void;
  newAllergySubstance: string;
  setNewAllergySubstance: (val: string) => void;
  newAllergyReaction: string;
  setNewAllergyReaction: (val: string) => void;
  addAllergy: () => void;
}

export function MedicationAllergySection({
  medications,
  setMedications,
  newMedName,
  setNewMedName,
  newMedDose,
  setNewMedDose,
  addMedication,
  allergies,
  setAllergies,
  newAllergySubstance,
  setNewAllergySubstance,
  newAllergyReaction,
  setNewAllergyReaction,
  addAllergy,
}: MedicationAllergySectionProps) {
  return (
    <section aria-labelledby="section-meds-allergies" className="space-y-6">
      <div>
        <h2 id="section-meds-allergies" className="text-lg font-bold text-slate-900">
          4. Current Medications &amp; Known Allergies
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Record ongoing pharmacotherapy, ayurvedic formulations, and adverse drug reactions
        </p>
      </div>

      {/* Medications List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Active Medications
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label htmlFor="new-med-name-input" className="sr-only">
              Medication Name
            </label>
            <input
              id="new-med-name-input"
              type="text"
              value={newMedName}
              onChange={(e) => setNewMedName(e.target.value)}
              placeholder="Medicine name (e.g. Metformin 500mg or Ashwagandha Churna)"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMedication();
                }
              }}
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="new-med-dose-input" className="sr-only">
              Dosage &amp; Frequency
            </label>
            <input
              id="new-med-dose-input"
              type="text"
              value={newMedDose}
              onChange={(e) => setNewMedDose(e.target.value)}
              placeholder="Dosage (e.g. 1 tab BD pc)"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMedication();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={addMedication}
            aria-label="Add Medication"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white hover:bg-clinical-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        {medications.length > 0 ? (
          <ul className="space-y-2 pt-2" aria-label="Added Medications List">
            {medications.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-surface-200 p-2.5 text-xs bg-surface-50"
              >
                <div>
                  <strong className="text-slate-900">{m.name}</strong> —{" "}
                  <span className="text-slate-600">{m.dose}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}
                  aria-label={`Remove medication ${m.name}`}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 italic">No current medications added.</p>
        )}
      </div>

      {/* Allergies List */}
      <div className="space-y-3 pt-4 border-t border-surface-200">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Known Allergies &amp; ADRs
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label htmlFor="new-allergy-substance-input" className="sr-only">
              Allergic Substance
            </label>
            <input
              id="new-allergy-substance-input"
              type="text"
              value={newAllergySubstance}
              onChange={(e) => setNewAllergySubstance(e.target.value)}
              placeholder="Substance (e.g. Penicillin, Peanuts, Sulfa)"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAllergy();
                }
              }}
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="new-allergy-reaction-input" className="sr-only">
              Reaction Description
            </label>
            <input
              id="new-allergy-reaction-input"
              type="text"
              value={newAllergyReaction}
              onChange={(e) => setNewAllergyReaction(e.target.value)}
              placeholder="Reaction (e.g. Urticaria / Anaphylaxis)"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAllergy();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={addAllergy}
            aria-label="Add Allergy"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        {allergies.length > 0 ? (
          <ul className="space-y-2 pt-2" aria-label="Added Allergies List">
            {allergies.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-rose-200 p-2.5 text-xs bg-rose-50/60"
              >
                <div className="text-rose-900">
                  <strong className="font-semibold">{a.substance}</strong> — <span>{a.reaction}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllergies(allergies.filter((_, idx) => idx !== i))}
                  aria-label={`Remove allergy ${a.substance}`}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 italic">No known drug or food allergies documented.</p>
        )}
      </div>
    </section>
  );
}
