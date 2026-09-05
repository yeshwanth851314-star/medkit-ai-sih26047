import { RedFlagRule, RedFlagAlertItem } from "./types";
import { HPIStructure } from "@/types/database";

export const CLINICAL_RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: "RED_FLAG_ACUTE_CHEST_PAIN",
    version: "1.0",
    name: "Acute Ischemic / Coronary Red Flag",
    severity: "critical",
    triggers: {
      keywords: ["chest pain", "chest pressure", "crushing", "retrosternal", "ఛాతీలో నొప్పి", "ఛాతీ నొప్పి"],
      radiation: ["left arm", "shoulder", "jaw", "back", "ఎడమ చేయి", "దవడ"],
      associated: ["sweating", "diaphoresis", "cold sweat", "breathless", "ఆయాసం", "చెమటలు"],
    },
    message: "Potential red flag detected — acute crushing chest pain with radiation and diaphoresis. Immediate clinical assessment recommended.",
    clinicalRationale: "Symptom pattern warrants urgent ECG and cardiac evaluation to rule out Acute Coronary Syndrome.",
  },
  {
    id: "RED_FLAG_ACUTE_BREATHLESSNESS",
    version: "1.0",
    name: "Acute Respiratory Distress Red Flag",
    severity: "critical",
    triggers: {
      keywords: ["breathlessness", "cannot breathe", "stridor", "gasping", "ఆయాసం", "శ్వాస ఆడకపోవడం"],
      associated: ["cyanosis", "unable to speak", "blue lips", "gasping at rest"],
    },
    message: "Potential red flag detected — acute severe respiratory compromise. Immediate clinical assessment recommended.",
    clinicalRationale: "High risk of acute pulmonary embolism, severe bronchospasm, or tension pneumothorax.",
  },
  {
    id: "RED_FLAG_ACUTE_NEURO_DEFICIT",
    version: "1.0",
    name: "Acute Stroke / Neurological Deficit Red Flag",
    severity: "critical",
    triggers: {
      keywords: ["facial droop", "slurred speech", "arm weakness", "sudden numbness", "మాట తడబడటం", "ముఖం వంకర"],
      associated: ["sudden onset", "confusion", "loss of balance"],
    },
    message: "Potential red flag detected — sudden onset focal neurological deficit. Immediate clinical assessment recommended.",
    clinicalRationale: "Signs consistent with acute ischemic or hemorrhagic stroke; requires emergent brain imaging.",
  },
  {
    id: "RED_FLAG_ANAPHYLAXIS",
    version: "1.0",
    name: "Acute Anaphylaxis / Airway Compromise",
    severity: "critical",
    triggers: {
      keywords: ["throat swelling", "lip swelling", "tongue swelling", "గొంతు వాపు", "పెదవుల వాపు"],
      associated: ["urticaria", "hives", "dizziness after injection", "wheeze"],
    },
    message: "Potential red flag detected — acute airway compromise or systemic allergic reaction. Immediate clinical assessment recommended.",
    clinicalRationale: "Emergency airway risk requiring immediate intramuscular epinephrine evaluation.",
  },
];

export function evaluateClinicalRedFlags(input: {
  chiefComplaint: string;
  rawPatientComplaint?: string | null;
  hpi?: HPIStructure | null;
}): RedFlagAlertItem[] {
  const alerts: RedFlagAlertItem[] = [];
  const textCorpus = [
    input.chiefComplaint,
    input.rawPatientComplaint || "",
    input.hpi?.onset || "",
    input.hpi?.character || "",
    input.hpi?.location || "",
    input.hpi?.radiation || "",
    Array.isArray(input.hpi?.associated_symptoms) ? input.hpi.associated_symptoms.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  for (const rule of CLINICAL_RED_FLAG_RULES) {
    const hasKeyword = rule.triggers.keywords.some((kw) => textCorpus.includes(kw.toLowerCase()));
    if (!hasKeyword) continue;

    // Secondary corroborating factors
    let hasCorroboration = true;
    if (rule.triggers.radiation && rule.triggers.radiation.length > 0) {
      const hasRadiation = rule.triggers.radiation.some((rad) => textCorpus.includes(rad.toLowerCase()));
      const hasAssociated = rule.triggers.associated?.some((asc) => textCorpus.includes(asc.toLowerCase()));
      hasCorroboration = hasRadiation || Boolean(hasAssociated);
    } else if (rule.triggers.associated && rule.triggers.associated.length > 0) {
      hasCorroboration = rule.triggers.associated.some((asc) => textCorpus.includes(asc.toLowerCase()));
    }

    if (hasCorroboration) {
      alerts.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        severity: rule.severity,
        message: rule.message,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}
