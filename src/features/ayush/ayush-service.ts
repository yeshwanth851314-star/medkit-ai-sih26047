import { AyushAssessmentInput, ayushAssessmentSchema } from "./types";
import { getCaseById, updateCase } from "@/lib/db/supabase";
import { ClinicalCase } from "@/types/database";

export async function attachAyushAssessmentToCase(
  caseId: string,
  input: AyushAssessmentInput,
  clinicianName?: string
): Promise<ClinicalCase> {
  const existing = await getCaseById(caseId);
  if (!existing) throw new Error("Case not found");

  if (existing.status === "final") {
    throw new Error("CANNOT_MUTATE_FINAL: Case is already finalized");
  }

  const validated = ayushAssessmentSchema.parse({
    ...input,
    verifiedBy: clinicianName || "Attending Vaidya",
    verifiedAt: new Date().toISOString(),
  });

  const updated = await updateCase(caseId, {
    case_type: "ayush",
    ayush_assessment: validated as any,
  });

  if (!updated) throw new Error("Failed to save AYUSH assessment");
  return updated;
}

export function getDefaultAyushAssessment(): AyushAssessmentInput {
  return {
    prakriti: "Pitta-Vata",
    vikriti: "Pitta Pradhana Tridosha Dushti",
    sara: "Madhyama (Medium)",
    samhanana: "Madhyama (Moderate compact body frame)",
    pramana: "Pramana yukta (Normal anthropometry)",
    satmya: "Madhyama Satmya",
    sattva: "Madhyama (Moderate)",
    ahara_shakti: "Abhyavaharana: Madhyama, Jarana: Mandagni (Sluggish digestion)",
    vyayama_shakti: "Madhyama",
    vaya: "Madhyama Vaya (Adult)",
    ahara_vihara: {
      dietary_habits: "Irregular meal times, intake of Katu (spicy) and Amla (sour) foods",
      daily_routine: "Ratri Jagarana (late night awakeness), sedentary desk work",
    },
    source: "clinician",
  };
}
