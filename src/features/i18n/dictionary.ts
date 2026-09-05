import { SupportedLanguage } from "./types";

export interface TranslationDictionary {
  appName: string;
  appTagline: string;
  selectLanguage: string;
  intakeTitle: string;
  intakeSubtitle: string;
  startIntake: string;
  recording: string;
  stopRecording: string;
  tapToSpeak: string;
  speakPrompt: string;
  reviewTranscript: string;
  editTranscript: string;
  confirmAndProceed: string;
  chiefComplaint: string;
  duration: string;
  severity: string;
  associatedSymptoms: string;
  redFlagWarning: string;
  aiSummaryDisclaimer: string;
  auditPreservationNotice: string;
  doctorVerificationRequired: string;
  verifiedByDoctor: string;
  emergencyAlert: string;
  immediateAssessment: string;
}

export const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: "MedKit AI",
    appTagline: "Intelligent Multimodal Clinical Intake & Physician Copilot",
    selectLanguage: "Select Preferred Language",
    intakeTitle: "Patient Clinical Intake",
    intakeSubtitle: "Please describe your health symptoms clearly in your comfortable language.",
    startIntake: "Start Intake",
    recording: "Recording in progress... please speak clearly",
    stopRecording: "Stop Recording",
    tapToSpeak: "Tap to Speak",
    speakPrompt: "Tell us what symptoms or discomfort you are feeling today...",
    reviewTranscript: "Review Voice Transcription",
    editTranscript: "Edit Transcript if needed",
    confirmAndProceed: "Confirm & Proceed to Next Step",
    chiefComplaint: "Chief Complaint",
    duration: "Duration / Onset",
    severity: "Severity Level",
    associatedSymptoms: "Associated Symptoms",
    redFlagWarning: "Potential red flag detected — immediate clinical assessment recommended.",
    aiSummaryDisclaimer: "AI-assisted summary — clinician review required.",
    auditPreservationNotice: "Original transcript preserved verbatim for clinical audit.",
    doctorVerificationRequired: "Pending Clinician Review",
    verifiedByDoctor: "Verified by Clinician",
    emergencyAlert: "Clinical Emergency Alert",
    immediateAssessment: "Immediate medical staff attention requested.",
  },
  te: {
    appName: "మెడ్‌కిట్ AI",
    appTagline: "ఇంటెలిజెంట్ క్లినికల్ ఇన్‌టేక్ & వైద్యుల సహాయక వ్యవస్థ",
    selectLanguage: "మీ భాషను ఎంచుకోండి",
    intakeTitle: "రోగి ఆరోగ్య వివరాల నమోదు (ఇన్‌టేక్)",
    intakeSubtitle: "మీరు ఎదుర్కొంటున్న ఆరోగ్య సమస్యలను స్పష్టంగా తెలియజేయండి.",
    startIntake: "ప్రారంభించండి",
    recording: "రికార్డింగ్ జరుగుతోంది... దయచేసి మాట్లాడండి",
    stopRecording: "రికార్డింగ్ ఆపండి",
    tapToSpeak: "మాట్లాడటానికి తాకండి",
    speakPrompt: "ఈ రోజు మీ సమస్య ఏమిటో, ఎక్కడ నొప్పిగా ఉందో చెప్పండి...",
    reviewTranscript: "మాటల లిఖిత రూపం సమీక్షించండి",
    editTranscript: "అవసరమైతే మార్పులు చేయండి",
    confirmAndProceed: "ధృవీకరించి ముందుకు సాగండి",
    chiefComplaint: "ప్రధాన సమస్య",
    duration: "సమస్య ఎంత కాలం నుండి ఉంది?",
    severity: "తీవ్రత స్థాయి",
    associatedSymptoms: "ఇతర లక్షణాలు",
    redFlagWarning: "ప్రమాదకర లక్షణం గుర్తించబడింది — వెంటనే వైద్యుల పర్యవేక్షణ అవసరం.",
    aiSummaryDisclaimer: "కృత్రిమ మేధస్సు సారాంశం — వైద్యుల సమీక్ష తప్పనిసరి.",
    auditPreservationNotice: "వైద్యుల పరిశీలన మరియు ఆడిట్ కోసం అసలైన తెలుగు మాటలు భద్రపరచబడ్డాయి.",
    doctorVerificationRequired: "వైద్యుల సమీక్ష కోసం వేచి ఉంది",
    verifiedByDoctor: "వైద్యులచే ధృవీకరించబడింది",
    emergencyAlert: "అత్యవసర ఆరోగ్య హెచ్చరిక",
    immediateAssessment: "తక్షణ వైద్య సహాయం అందించవలసిందిగా సిఫార్సు చేయబడింది.",
  },
  hi: {
    appName: "मेडकिट AI",
    appTagline: "इंटेलिजेंट क्लीनिकल इनटेक एवं चिकित्सक को-पायलट",
    selectLanguage: "अपनी भाषा चुनें",
    intakeTitle: "रोगी क्लीनिकल इनटेक",
    intakeSubtitle: "कृपया अपनी स्वास्थ्य समस्याओं का स्पष्ट रूप से वर्णन करें।",
    startIntake: "शुरू करें",
    recording: "रिकॉर्डिंग जारी है... कृपया स्पष्ट बोलें",
    stopRecording: "रिकॉर्डिंग रोकें",
    tapToSpeak: "बोलने के लिए टैप करें",
    speakPrompt: "आज आप क्या समस्या महसूस कर रहे हैं, हमें बताएं...",
    reviewTranscript: "वॉइस ट्रांसक्रिप्शन की समीक्षा करें",
    editTranscript: "यदि आवश्यक हो तो संपादन करें",
    confirmAndProceed: "पुष्टि करें और आगे बढ़ें",
    chiefComplaint: "मुख्य समस्या",
    duration: "अवधि / शुरुआत",
    severity: "गंभीरता का स्तर",
    associatedSymptoms: "संबंधित लक्षण",
    redFlagWarning: "संभावित रेड फ्लैग का पता चला — तत्काल क्लीनिकल मूल्यांकन की सिफारिश की जाती है।",
    aiSummaryDisclaimer: "AI-सहायता प्राप्त सारांश — चिकित्सक समीक्षा आवश्यक है।",
    auditPreservationNotice: "क्लीनिकल ऑडिट के लिए मूल प्रतिलेख सुरक्षित रखा गया है।",
    doctorVerificationRequired: "चिकित्सक समीक्षा लंबित",
    verifiedByDoctor: "चिकित्सक द्वारा सत्यापित",
    emergencyAlert: "आपातकालीन चिकित्सा चेतावनी",
    immediateAssessment: "तत्काल चिकित्सा कर्मचारियों के ध्यान का अनुरोध किया गया है।",
  },
};

export function t(key: keyof TranslationDictionary, lang: SupportedLanguage = "en"): string {
  const dict = DICTIONARIES[lang] || DICTIONARIES.en;
  return dict[key] || DICTIONARIES.en[key] || key;
}
