import { NextResponse } from "next/server";
import { processSpeechTranscription } from "@/features/voice/voice-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await processSpeechTranscription({
      audioBase64: body.audioBase64,
      language: body.language || "en",
      mockId: body.mockId,
    });

    return NextResponse.json({ success: true, transcription: result });
  } catch (err: any) {
    console.error("POST /api/voice/transcribe error:", err);
    return NextResponse.json({ error: "Failed to transcribe speech audio" }, { status: 500 });
  }
}
