import { TranscriptionResult, transcriptionResponseSchema } from "./types";

export const SYNTHETIC_TRANSCRIPTS: TranscriptionResult[] = [
  {
    id: "tr-0001",
    mode: "voice",
    language: "en",
    rawTranscript: "I have been having this terrible dry cough for about two weeks now. It gets worse at night and whenever I drink cold water.",
    confidence: 0.97,
    status: "confirmed",
    requiresManualEdit: false,
    normalizedEntities: {
      complaint: "dry cough",
      duration: "2 weeks",
      aggravating_factors: ["night", "cold water"],
    },
  },
  {
    id: "tr-0002",
    mode: "voice",
    language: "te",
    rawTranscript: "ఛాతీలో తీవ్రమైన నొప్పి వస్తోంది, ఎడమ భుజం లాగుతోంది, చాలా చెమటలు పోస్తున్నాయి.",
    confidence: 0.94,
    status: "confirmed",
    requiresManualEdit: false,
    englishTranslation: "Severe chest pain is occurring, radiating to left shoulder, profuse sweating.",
    normalizedEntities: {
      complaint: "chest pain",
      severity: "severe",
      radiation: "left shoulder",
      associated_symptoms: ["profuse sweating"],
    },
  },
  {
    id: "tr-0003",
    mode: "voice",
    language: "en",
    rawTranscript: "[inaudible background noise] ... something in my stomach ... [muffled] ... burning maybe ...",
    confidence: 0.42,
    status: "needs_review",
    requiresManualEdit: true,
    warning: "Speech recognition confidence is low (42%). Please review and verify before submitting.",
    normalizedEntities: null,
  },
];

export async function processSpeechTranscription(options: {
  audioBase64?: string;
  language?: "en" | "te" | "hi";
  mockId?: string;
}): Promise<TranscriptionResult> {
  // If mock ID provided or in synthetic mode
  if (options.mockId) {
    const match = SYNTHETIC_TRANSCRIPTS.find((t) => t.id === options.mockId);
    if (match) return transcriptionResponseSchema.parse(match);
  }

  // Default demo behavior based on language
  if (options.language === "te") {
    return transcriptionResponseSchema.parse(SYNTHETIC_TRANSCRIPTS[1]);
  }

  // Default English speech result
  return transcriptionResponseSchema.parse(SYNTHETIC_TRANSCRIPTS[0]);
}
