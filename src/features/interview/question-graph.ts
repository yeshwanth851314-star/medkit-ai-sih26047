import { QuestionNode } from "./types";

export const QUESTION_GRAPH: Record<string, QuestionNode> = {
  Q_CHIEF_COMPLAINT: {
    id: "Q_CHIEF_COMPLAINT",
    key: "chief_complaint",
    promptEn: "What is your main health concern or symptom today?",
    promptTe: "ఈ రోజు మీకు ఉన్న ప్రధాన ఆరోగ్య సమస్య లేదా లక్షణం ఏమిటి?",
    type: "choice",
    options: [
      { value: "Chest pain / discomfort", labelEn: "Chest pain or pressure", labelTe: "ఛాతీలో నొప్పి లేదా ఒత్తిడి" },
      { value: "Cough and cold", labelEn: "Cough or throat irritation", labelTe: "దగ్గు లేదా గొంతు మంట" },
      { value: "Fever and body aches", labelEn: "Fever and body aches", labelTe: "జ్వరం మరియు ఒంటి నొప్పులు" },
      { value: "Stomach pain / acidity", labelEn: "Abdominal pain or acidity", labelTe: "కడుపు నొప్పి లేదా ఎసిడిటీ" },
      { value: "General weakness", labelEn: "General fatigue or dizziness", labelTe: "నీరసం లేదా కళ్ళు తిరగడం" },
    ],
    nextQuestionId: (answer: string) => {
      const lower = answer.toLowerCase();
      if (lower.includes("chest") || lower.includes("ఛాతీ")) return "Q_CHEST_ONSET";
      if (lower.includes("cough") || lower.includes("దగ్గు")) return "Q_COUGH_TYPE";
      return "Q_GEN_ONSET";
    },
  },

  // --- Acute Chest Pain Branch ---
  Q_CHEST_ONSET: {
    id: "Q_CHEST_ONSET",
    key: "chest_onset",
    promptEn: "When and how did this chest discomfort start?",
    promptTe: "ఈ ఛాతీ నొప్పి ఎప్పుడు మరియు ఎలా మొదలైంది?",
    type: "choice",
    options: [
      { value: "Sudden onset during exertion / stairs", labelEn: "Sudden onset during activity", labelTe: "పని చేస్తున్నప్పుడు లేదా మెట్లు ఎక్కుతున్నప్పుడు అకస్మాత్తుగా" },
      { value: "Sudden onset at rest", labelEn: "Sudden onset while resting", labelTe: "విశ్రాంతిలో ఉండగా అకస్మాత్తుగా" },
      { value: "Gradual discomfort over days", labelEn: "Gradual discomfort over several days", labelTe: "కొన్ని రోజులుగా నెమ్మదిగా వస్తోంది" },
    ],
    nextQuestionId: "Q_CHEST_RADIATION",
  },

  Q_CHEST_RADIATION: {
    id: "Q_CHEST_RADIATION",
    key: "chest_radiation",
    promptEn: "Does the pain spread or radiate to any of these areas?",
    promptTe: "ఈ నొప్పి ఇతర భాగాలకు వ్యాపిస్తోందా?",
    type: "choice",
    options: [
      { value: "Left arm / shoulder and jaw", labelEn: "Radiates to left shoulder or jaw", labelTe: "ఎడమ చేయి / భుజం లేదా దవడకు లాగుతోంది" },
      { value: "Upper back", labelEn: "Radiates to upper back", labelTe: "వీపు పైభాగానికి లాగుతోంది" },
      { value: "Localized to chest center only", labelEn: "Strictly in the center, does not spread", labelTe: "ఛాతీ మధ్యలో మాత్రమే ఉంది, ఎక్కడికీ పాకట్లేదు" },
    ],
    nextQuestionId: "Q_CHEST_ASSOCIATED",
  },

  Q_CHEST_ASSOCIATED: {
    id: "Q_CHEST_ASSOCIATED",
    key: "chest_associated",
    promptEn: "Are you experiencing any of these accompanying symptoms?",
    promptTe: "దీనితో పాటు ఈ క్రింది లక్షణాలు ఏమైనా ఉన్నాయా?",
    type: "choice",
    options: [
      { value: "Profuse sweating and shortness of breath", labelEn: "Heavy cold sweating and breathlessness", labelTe: "విపరీతమైన చమటలు మరియు ఆయాసం" },
      { value: "Nausea or lightheadedness", labelEn: "Nausea or dizziness", labelTe: "వాంతి వచ్చేలా ఉండటం లేదా కళ్ళు తిరగడం" },
      { value: "None of these", labelEn: "None of these symptoms", labelTe: "ఇవేవీ లేవు" },
    ],
    nextQuestionId: "Q_PAST_CONDITIONS",
  },

  // --- Respiratory / Cough Branch ---
  Q_COUGH_TYPE: {
    id: "Q_COUGH_TYPE",
    key: "cough_type",
    promptEn: "What kind of cough are you experiencing?",
    promptTe: "మీకు వస్తున్న దగ్గు ఎలాంటి రకానికి చెందినది?",
    type: "choice",
    options: [
      { value: "Dry, hacking cough", labelEn: "Dry cough without phlegm", labelTe: "పొడి దగ్గు (కఫం లేకుండా)" },
      { value: "Productive with yellow/green phlegm", labelEn: "Wet cough with yellow/green phlegm", labelTe: "తెమడ / కఫంతో కూడిన దగ్గు" },
      { value: "Cough with blood specks", labelEn: "Blood streaks in sputum", labelTe: "దగ్గినప్పుడు రక్తం చారికలు" },
    ],
    nextQuestionId: "Q_COUGH_FEVER",
  },

  Q_COUGH_FEVER: {
    id: "Q_COUGH_FEVER",
    key: "cough_fever",
    promptEn: "Do you have an accompanying fever?",
    promptTe: "దగ్గుతో పాటు జ్వరం కూడా ఉందా?",
    type: "choice",
    options: [
      { value: "High grade fever with chills", labelEn: "High fever with chills", labelTe: "వణుకుతో కూడిన తీవ్రమైన జ్వరం" },
      { value: "Low grade fever (100 F)", labelEn: "Mild low-grade fever", labelTe: "తేలికపాటి జ్వరం" },
      { value: "No fever", labelEn: "No fever reported", labelTe: "జ్వరం లేదు" },
    ],
    nextQuestionId: "Q_COUGH_DURATION",
  },

  Q_COUGH_DURATION: {
    id: "Q_COUGH_DURATION",
    key: "cough_duration",
    promptEn: "How long has this cough persisted?",
    promptTe: "ఈ దగ్గు ఎంతకాలంగా ఉంది?",
    type: "choice",
    options: [
      { value: "Less than 1 week", labelEn: "Less than 1 week", labelTe: "ఒక వారం కంటే తక్కువ" },
      { value: "1 to 3 weeks", labelEn: "1 to 3 weeks", labelTe: "1 నుండి 3 వారాలు" },
      { value: "More than 3 weeks (chronic)", labelEn: "More than 3 weeks (chronic)", labelTe: "3 వారాల కంటే ఎక్కువ" },
    ],
    nextQuestionId: "Q_PAST_CONDITIONS",
  },

  // --- General Symptoms Branch ---
  Q_GEN_ONSET: {
    id: "Q_GEN_ONSET",
    key: "general_onset",
    promptEn: "How long have you been feeling unwell?",
    promptTe: "మీకు అనారోగ్యంగా అనిపించి ఎంతకాలం అయ్యింది?",
    type: "choice",
    options: [
      { value: "Started today / yesterday", labelEn: "Just started (1-2 days)", labelTe: "నిన్న లేదా ఈ రోజే మొదలైంది" },
      { value: "About a week", labelEn: "About 1 week", labelTe: "దాదాపు ఒక వారం" },
      { value: "Several weeks or months", labelEn: "Chronic (several weeks/months)", labelTe: "చాలా వారాలు లేదా నెలలుగా" },
    ],
    nextQuestionId: "Q_PAST_CONDITIONS",
  },

  // --- Shared Terminal Question ---
  Q_PAST_CONDITIONS: {
    id: "Q_PAST_CONDITIONS",
    key: "past_conditions",
    promptEn: "Do you have any ongoing health conditions?",
    promptTe: "మీకు ఇప్పటికే ఉన్న దీర్ఘకాలిక వ్యాధులు ఏమైనా ఉన్నాయా?",
    type: "choice",
    options: [
      { value: "Hypertension (High BP)", labelEn: "Hypertension (High BP)", labelTe: "బీపీ (రక్తపోటు)" },
      { value: "Diabetes Mellitus", labelEn: "Diabetes (Sugar)", labelTe: "షుగర్ (మధుమేహం)" },
      { value: "Asthma or breathing trouble", labelEn: "Asthma / Allergy", labelTe: "ఆస్తమా లేదా శ్వాస సమస్యలు" },
      { value: "None / Healthy", labelEn: "No known chronic illnesses", labelTe: "ఎటువంటి వ్యాధులు లేవు" },
    ],
    nextQuestionId: null, // End of interview graph
  },
};
