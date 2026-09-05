import { z } from "zod";

export const prakritiEnum = z.enum([
  "Vata",
  "Pitta",
  "Kapha",
  "Vata-Pitta",
  "Pitta-Vata",
  "Pitta-Kapha",
  "Kapha-Pitta",
  "Vata-Kapha",
  "Kapha-Vata",
  "Tridosha / Sama",
]);

export const dhatuSaraEnum = z.enum(["Pravara (Superior)", "Madhyama (Medium)", "Avara (Inferior)"]);
export const sattvaEnum = z.enum(["Pravara (High Mental Strength)", "Madhyama (Moderate)", "Avara (Low/Anxious)"]);

export const ayushAssessmentSchema = z.object({
  prakriti: prakritiEnum,
  vikriti: z.string().min(2, "Vikriti description is required"),
  sara: dhatuSaraEnum.default("Madhyama (Medium)"),
  samhanana: z.string().default("Madhyama (Moderate compact body frame)"),
  pramana: z.string().default("Pramana yukta (Normal anthropometry)"),
  satmya: z.string().default("Madhyama Satmya"),
  sattva: sattvaEnum.default("Madhyama (Moderate)"),
  ahara_shakti: z.string().min(2, "Ahara Shakti (Abhyavaharana & Jarana) is required"),
  vyayama_shakti: z.string().default("Madhyama"),
  vaya: z.string().min(1, "Vaya is required"),
  ahara_vihara: z.object({
    dietary_habits: z.string().min(2, "Dietary habits (Ahara) required"),
    daily_routine: z.string().min(2, "Daily routine/lifestyle (Vihara) required"),
  }),
  source: z.enum(["clinician", "patient", "ai"]).default("clinician"),
  verifiedBy: z.string().optional().nullable(),
  verifiedAt: z.string().optional().nullable(),
});

export type AyushAssessmentInput = z.infer<typeof ayushAssessmentSchema>;
