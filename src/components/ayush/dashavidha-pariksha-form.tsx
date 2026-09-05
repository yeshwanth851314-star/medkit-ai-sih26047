"use client";

import { useState } from "react";
import { AyushAssessmentInput } from "@/features/ayush/types";
import { getDefaultAyushAssessment } from "@/features/ayush/ayush-service";
import { Sparkles, CheckCircle2, ShieldCheck, Feather, HeartPulse, Save } from "lucide-react";

export function DashavidhaParikshaForm({
  caseId,
  initialData,
  onSaved,
}: {
  caseId: string;
  initialData?: AyushAssessmentInput | null;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<AyushAssessmentInput>(
    initialData || getDefaultAyushAssessment()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseType: "ayush",
          ayushAssessment: data,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (onSaved) onSaved();
      }
    } catch {
      console.error("Failed to save AYUSH assessment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-ayush-600/30 bg-white p-6 shadow-xs space-y-6">
      <div className="border-b border-surface-200 pb-4">
        <div className="flex items-center gap-2 text-xs font-bold text-ayush-700 uppercase tracking-wider mb-1">
          <Feather className="h-4 w-4" />
          Ministry of Ayush / AIIA Structured Framework
        </div>
        <h2 className="text-lg font-bold text-slate-900">Dashavidha Pariksha &amp; Ahara-Vihara Assessment</h2>
        <p className="text-xs text-slate-500">
          Clinician-verified constitutional analysis (Tenfold Examination). Not autonomously inferred by AI.
        </p>
      </div>

      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>AYUSH Dashavidha Pariksha assessment saved successfully.</span>
        </div>
      )}

      {/* Grid: 10 Parameters of Dashavidha Pariksha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* 1. Prakriti */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">1. Prakriti (Deha Prakriti)</label>
          <select
            value={data.prakriti}
            onChange={(e) => setData({ ...data, prakriti: e.target.value as any })}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-xs font-medium focus:border-ayush-600 focus:ring-1 focus:ring-ayush-600"
          >
            <option value="Vata">Vata</option>
            <option value="Pitta">Pitta</option>
            <option value="Kapha">Kapha</option>
            <option value="Vata-Pitta">Vata-Pitta</option>
            <option value="Pitta-Kapha">Pitta-Kapha</option>
            <option value="Vata-Kapha">Vata-Kapha</option>
            <option value="Tridosha / Sama">Tridosha / Sama</option>
          </select>
        </div>

        {/* 2. Vikriti */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">2. Vikriti (Pathological Doshic Imbalance)</label>
          <input
            type="text"
            value={data.vikriti}
            onChange={(e) => setData({ ...data, vikriti: e.target.value })}
            placeholder="e.g. Pitta Pradhana Tridosha, Mandagni"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 3. Sara */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">3. Sara (Dhatu Excellence)</label>
          <select
            value={data.sara}
            onChange={(e) => setData({ ...data, sara: e.target.value as any })}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-xs"
          >
            <option value="Pravara (Superior)">Pravara (Superior)</option>
            <option value="Madhyama (Medium)">Madhyama (Medium)</option>
            <option value="Avara (Inferior)">Avara (Inferior)</option>
          </select>
        </div>

        {/* 4. Samhanana */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">4. Samhanana (Compactness of Body)</label>
          <input
            type="text"
            value={data.samhanana}
            onChange={(e) => setData({ ...data, samhanana: e.target.value })}
            placeholder="e.g. Madhyama Samhanana"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 5. Pramana */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">5. Pramana (Anthropometry / Body Proportions)</label>
          <input
            type="text"
            value={data.pramana}
            onChange={(e) => setData({ ...data, pramana: e.target.value })}
            placeholder="e.g. Pramana yukta"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 6. Satmya */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">6. Satmya (Habituation / Adaptability)</label>
          <input
            type="text"
            value={data.satmya}
            onChange={(e) => setData({ ...data, satmya: e.target.value })}
            placeholder="e.g. Madhyama Satmya, Shad-rasa satmya"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 7. Sattva */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">7. Sattva (Mental Temperament)</label>
          <select
            value={data.sattva}
            onChange={(e) => setData({ ...data, sattva: e.target.value as any })}
            className="block w-full rounded-lg border border-surface-200 p-2.5 text-xs"
          >
            <option value="Pravara (High Mental Strength)">Pravara (High Mental Strength)</option>
            <option value="Madhyama (Moderate)">Madhyama (Moderate)</option>
            <option value="Avara (Low/Anxious)">Avara (Low/Anxious)</option>
          </select>
        </div>

        {/* 8. Ahara Shakti */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">8. Ahara Shakti (Digestive Power / Agni)</label>
          <input
            type="text"
            value={data.ahara_shakti}
            onChange={(e) => setData({ ...data, ahara_shakti: e.target.value })}
            placeholder="e.g. Abhyavaharana: Avara, Jarana: Mandagni"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 9. Vyayama Shakti */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">9. Vyayama Shakti (Physical Capacity)</label>
          <input
            type="text"
            value={data.vyayama_shakti}
            onChange={(e) => setData({ ...data, vyayama_shakti: e.target.value })}
            placeholder="e.g. Madhyama / Avara"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>

        {/* 10. Vaya */}
        <div>
          <label className="block font-bold text-slate-800 mb-1">10. Vaya (Age Group)</label>
          <input
            type="text"
            value={data.vaya}
            onChange={(e) => setData({ ...data, vaya: e.target.value })}
            placeholder="e.g. Madhyama Vaya (35 years)"
            className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>
      </div>

      {/* Ahara & Vihara Section */}
      <div className="space-y-4 pt-4 border-t border-surface-200">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ahara-Vihara (Diet &amp; Lifestyle Regimen)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ahara (Dietary Patterns &amp; Food Timing)</label>
            <textarea
              rows={2}
              value={data.ahara_vihara.dietary_habits}
              onChange={(e) =>
                setData({
                  ...data,
                  ahara_vihara: { ...data.ahara_vihara, dietary_habits: e.target.value },
                })
              }
              placeholder="e.g. Katu-Amla rasa pradhana, irregular meal timings, Viruddha Ahara"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Vihara (Daily Regimen, Sleep &amp; Activity)</label>
            <textarea
              rows={2}
              value={data.ahara_vihara.daily_routine}
              onChange={(e) =>
                setData({
                  ...data,
                  ahara_vihara: { ...data.ahara_vihara, daily_routine: e.target.value },
                })
              }
              placeholder="e.g. Ratri Jagarana (sleep after 1 AM), Divaswapna (daytime sleep), stress"
              className="block w-full rounded-lg border border-surface-200 p-2 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-surface-200">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ayush-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-ayush-900 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Saving Assessment..." : "Save AYUSH Assessment"}
        </button>
      </div>
    </form>
  );
}
