import { z } from "zod";

export const transcriptionResponseSchema = z.object({
  id: z.string(),
  mode: z.literal("voice"),
  language: z.enum(["en", "te", "hi"]),
  rawTranscript: z.string(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["confirmed", "needs_review"]),
  requiresManualEdit: z.boolean().default(false),
  warning: z.string().optional().nullable(),
  englishTranslation: z.string().optional().nullable(),
  normalizedEntities: z.record(z.any()).optional().nullable(),
});

export type TranscriptionResult = z.infer<typeof transcriptionResponseSchema>;

export interface VoiceRecordingState {
  isRecording: boolean;
  durationSeconds: number;
  hasPermission: boolean | null;
  error: string | null;
  audioBlob: Blob | null;
}
