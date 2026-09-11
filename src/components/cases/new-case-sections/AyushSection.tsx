"use client";

import React from "react";
import { Leaf } from "lucide-react";

interface AyushSectionProps {
  prakriti: string;
  setPrakriti: (val: string) => void;
  vikriti: string;
  setVikriti: (val: string) => void;
  sara: string;
  setSara: (val: string) => void;
  samhanana: string;
  setSamhanana: (val: string) => void;
  pramana: string;
  setPramana: (val: string) => void;
  satmya: string;
  setSatmya: (val: string) => void;
  sattva: string;
  setSattva: (val: string) => void;
  aharaShakti: string;
  setAharaShakti: (val: string) => void;
  vyayamaShakti: string;
  setVyayamaShakti: (val: string) => void;
  vaya: string;
  setVaya: (val: string) => void;
  dietaryHabits: string;
  setDietaryHabits: (val: string) => void;
  dailyRoutine: string;
  setDailyRoutine: (val: string) => void;
}

export function AyushSection({
  prakriti,
  setPrakriti,
  vikriti,
  setVikriti,
  sara,
  setSara,
  samhanana,
  setSamhanana,
  pramana,
  setPramana,
  satmya,
  setSatmya,
  sattva,
  setSattva,
  aharaShakti,
  setAharaShakti,
  vyayamaShakti,
  setVyayamaShakti,
  vaya,
  setVaya,
  dietaryHabits,
  setDietaryHabits,
  dailyRoutine,
  setDailyRoutine,
}: AyushSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 pb-3 border-b border-ayush-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ayush-100 text-ayush-700" aria-hidden="true">
          <Leaf className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">AYUSH Dashavidha Pariksha</h2>
          <p className="text-xs text-slate-500">Ten-fold Ayurvedic diagnostic assessment per Ministry of Ayush / AIIA standards</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="ayush-prakriti" className="block text-xs font-semibold text-slate-700 mb-1">
            Prakriti (Constitutional Type)
          </label>
          <select
            id="ayush-prakriti"
            value={prakriti}
            onChange={(e) => setPrakriti(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Vata-Pitta">Vata-Pitta</option>
            <option value="Pitta-Kapha">Pitta-Kapha</option>
            <option value="Kapha-Vata">Kapha-Vata</option>
            <option value="Vataja">Vataja</option>
            <option value="Pittaja">Pittaja</option>
            <option value="Kaphaja">Kaphaja</option>
            <option value="Tridoshaja / Sama">Tridoshaja / Sama</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-vikriti" className="block text-xs font-semibold text-slate-700 mb-1">
            Vikriti (Dosha Imbalance)
          </label>
          <input
            id="ayush-vikriti"
            type="text"
            value={vikriti}
            onChange={(e) => setVikriti(e.target.value)}
            placeholder="e.g. Vata Prakopa with Pittanubandha"
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="ayush-sara" className="block text-xs font-semibold text-slate-700 mb-1">
            Sara (Dhatu Excellence)
          </label>
          <select
            id="ayush-sara"
            value={sara}
            onChange={(e) => setSara(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Pravara (Superior / Sarva Sara)">Pravara (Superior / Sarva Sara)</option>
            <option value="Madhyama (Moderate)">Madhyama (Moderate)</option>
            <option value="Avara (Inferior / Asara)">Avara (Inferior / Asara)</option>
            <option value="Rakta Sara">Rakta Sara</option>
            <option value="Asthi Sara">Asthi Sara</option>
            <option value="Majja Sara">Majja Sara</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-samhanana" className="block text-xs font-semibold text-slate-700 mb-1">
            Samhanana (Compactness)
          </label>
          <select
            id="ayush-samhanana"
            value={samhanana}
            onChange={(e) => setSamhanana(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Su-samhanana (Well-compacted)">Su-samhanana (Well-compacted)</option>
            <option value="Madhyama (Moderate)">Madhyama (Moderate)</option>
            <option value="Heena / Avara (Poorly built)">Heena / Avara (Poorly built)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-pramana" className="block text-xs font-semibold text-slate-700 mb-1">
            Pramana (Anthropometric Proportion)
          </label>
          <select
            id="ayush-pramana"
            value={pramana}
            onChange={(e) => setPramana(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Sama-pramana (Proportionate)">Sama-pramana (Proportionate)</option>
            <option value="Ati-dirgha (Excessive height)">Ati-dirgha (Excessive height)</option>
            <option value="Ati-hraswa (Short stature)">Ati-hraswa (Short stature)</option>
            <option value="Ati-sthula (Obese)">Ati-sthula (Obese)</option>
            <option value="Ati-krisha (Emaciated)">Ati-krisha (Emaciated)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-satmya" className="block text-xs font-semibold text-slate-700 mb-1">
            Satmya (Adaptability &amp; Habituation)
          </label>
          <select
            id="ayush-satmya"
            value={satmya}
            onChange={(e) => setSatmya(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Pravara (Sarva-rasa satmya)">Pravara (Sarva-rasa satmya)</option>
            <option value="Madhyama (Moderate)">Madhyama (Moderate)</option>
            <option value="Avara (Eka-rasa satmya)">Avara (Eka-rasa satmya)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-sattva" className="block text-xs font-semibold text-slate-700 mb-1">
            Sattva (Mental Strength &amp; Resilience)
          </label>
          <select
            id="ayush-sattva"
            value={sattva}
            onChange={(e) => setSattva(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Pravara (High / Strong mental control)">Pravara (High / Strong mental control)</option>
            <option value="Madhyama (Moderate)">Madhyama (Moderate)</option>
            <option value="Avara (Low / Fearful / Fragile)">Avara (Low / Fearful / Fragile)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-ahara" className="block text-xs font-semibold text-slate-700 mb-1">
            Ahara Shakti (Digestive Capacity / Agni)
          </label>
          <select
            id="ayush-ahara"
            value={aharaShakti}
            onChange={(e) => setAharaShakti(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Pravara (Samagni - balanced)">Pravara (Samagni - balanced)</option>
            <option value="Madhyama (Moderate digestion)">Madhyama (Moderate digestion)</option>
            <option value="Vishama (Vishamagni - irregular)">Vishama (Vishamagni - irregular)</option>
            <option value="Tikshna (Tikshnagni - hyperactive)">Tikshna (Tikshnagni - hyperactive)</option>
            <option value="Manda (Mandagni - hypoactive)">Manda (Mandagni - hypoactive)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-vyayama" className="block text-xs font-semibold text-slate-700 mb-1">
            Vyayama Shakti (Physical Work Capacity)
          </label>
          <select
            id="ayush-vyayama"
            value={vyayamaShakti}
            onChange={(e) => setVyayamaShakti(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Pravara (High physical capacity)">Pravara (High physical capacity)</option>
            <option value="Madhyama (Moderate capacity)">Madhyama (Moderate capacity)</option>
            <option value="Avara (Low physical capacity)">Avara (Low physical capacity)</option>
          </select>
        </div>

        <div>
          <label htmlFor="ayush-vaya" className="block text-xs font-semibold text-slate-700 mb-1">
            Vaya (Chronological / Biological Age)
          </label>
          <select
            id="ayush-vaya"
            value={vaya}
            onChange={(e) => setVaya(e.target.value)}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm min-h-[44px] focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          >
            <option value="Bala (Childhood / Growth stage)">Bala (Childhood / Growth stage)</option>
            <option value="Madhyama (Adult / Youth to Mid-age)">Madhyama (Adult / Youth to Mid-age)</option>
            <option value="Vriddha (Elderly / Geriatric)">Vriddha (Elderly / Geriatric)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-surface-200">
        <div>
          <label htmlFor="ayush-dietary" className="block text-xs font-semibold text-slate-700 mb-1">
            Ahara (Dietary Habits &amp; Preferences)
          </label>
          <textarea
            id="ayush-dietary"
            rows={3}
            value={dietaryHabits}
            onChange={(e) => setDietaryHabits(e.target.value)}
            placeholder="e.g. Prefers warm, oily food. Irregular meal timings. Avoids spicy and cold foods."
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="ayush-routine" className="block text-xs font-semibold text-slate-700 mb-1">
            Vihara (Daily Regimen &amp; Lifestyle)
          </label>
          <textarea
            id="ayush-routine"
            rows={3}
            value={dailyRoutine}
            onChange={(e) => setDailyRoutine(e.target.value)}
            placeholder="e.g. Sedentary desk job. Late night sleep around 1 AM. Regular morning walking."
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:ring-2 focus:ring-ayush-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export default AyushSection;
