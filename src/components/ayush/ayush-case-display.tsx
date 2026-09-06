import { AyushAssessment } from "@/types/database";
import { Sparkles, ShieldCheck, CheckCircle2, Leaf, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AyushCaseDisplayProps {
  assessment: AyushAssessment;
}

export function AyushCaseDisplay({ assessment }: AyushCaseDisplayProps) {
  const parikshaItems = [
    { label: "Prakriti (Constitutional Type)", value: assessment.prakriti },
    { label: "Vikriti (Current Dosha Imbalance)", value: assessment.vikriti },
    { label: "Sara (Tissue / Dhatu Excellence)", value: assessment.sara },
    { label: "Samhanana (Compactness / Physique)", value: assessment.samhanana },
    { label: "Pramana (Anthropometric Proportion)", value: assessment.pramana },
    { label: "Satmya (Dietary & Habitual Adaptability)", value: assessment.satmya },
    { label: "Sattva (Mental Strength & Resilience)", value: assessment.sattva },
    { label: "Ahara Shakti (Digestive Capacity - Agni)", value: assessment.ahara_shakti },
    { label: "Vyayama Shakti (Physical Work Capacity)", value: assessment.vyayama_shakti },
    { label: "Vaya (Chronological & Biological Age)", value: assessment.vaya },
  ].filter((item) => Boolean(item.value));

  const aharaVihara = assessment.ahara_vihara;

  return (
    <div className="rounded-2xl border border-ayush-200 bg-linear-to-br from-white to-ayush-50/30 p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-ayush-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ayush-100 text-ayush-700">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              AYUSH Dashavidha Pariksha &amp; Ahara-Vihara
            </h2>
            <p className="text-xs text-slate-500">
              Ten-fold clinical examination &amp; lifestyle assessment under Ministry of Ayush / AIIA guidelines
            </p>
          </div>
        </div>

        <span className="rounded-md bg-ayush-100 border border-ayush-300 px-2.5 py-1 text-[11px] font-bold text-ayush-800 uppercase tracking-wider self-start sm:self-auto">
          Ayurvedic OPD Examination
        </span>
      </div>

      {/* 10-fold Pariksha Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Dashavidha Pariksha Parameters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {parikshaItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-surface-200 bg-white p-3.5 shadow-2xs space-y-1"
            >
              <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
                {item.label}
              </span>
              <span className="text-xs font-bold text-slate-900 block">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ahara & Vihara Lifestyle Factors */}
      {aharaVihara && (aharaVihara.dietary_habits || aharaVihara.daily_routine) && (
        <div className="rounded-xl bg-white p-4 border border-surface-200 space-y-3 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Ahara-Vihara (Diet &amp; Regimen Analysis)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {aharaVihara.dietary_habits && (
              <div>
                <span className="font-semibold text-slate-500 block mb-1">Dietary Habits (Ahara):</span>
                <p className="text-slate-800 leading-relaxed bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                  {aharaVihara.dietary_habits}
                </p>
              </div>
            )}
            {aharaVihara.daily_routine && (
              <div>
                <span className="font-semibold text-slate-500 block mb-1">Daily Regimen &amp; Sleep (Vihara):</span>
                <p className="text-slate-800 leading-relaxed bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                  {aharaVihara.daily_routine}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinician Verification Stamp */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-ayush-200 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>Vaidya / Clinician Verified Assessment</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-ayush-600" />
          <span>Compliant with National Commission for Indian System of Medicine (NCISM) standards</span>
        </div>
      </div>
    </div>
  );
}
