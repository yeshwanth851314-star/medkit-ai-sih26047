import { NextResponse } from "next/server";
import { getSpeechProvider } from "@/features/voice/speech-provider";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";

export async function POST(request: Request) {
  const auth = await requireIntakeOrClinicalAuth(request, {
    requiredScope: "voice:transcribe",
  });
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const speechProvider = getSpeechProvider();

    const result = await speechProvider.transcribe({
      audioBase64: body.audioBase64,
      mimeType: body.mimeType,
      language: body.language || "en",
      mockId: body.mockId,
    });

    return NextResponse.json({ success: true, transcription: result });
  } catch (err: any) {
    console.error("POST /api/voice/transcribe error:", err);
    return NextResponse.json(
      {
        error: err.message || "Failed to transcribe speech audio",
        requiresManualEntry: true,
      },
      { status: 502 }
    );
  }
}
