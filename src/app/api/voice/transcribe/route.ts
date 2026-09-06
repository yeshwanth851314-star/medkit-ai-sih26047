import { NextResponse } from "next/server";
import { getSpeechProvider } from "@/features/voice/speech-provider";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { checkRateLimit, createRateLimitResponse, getRateLimitKey } from "@/lib/security/rate-limiter";

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/x-m4a",
]);

const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const auth = await requireIntakeOrClinicalAuth(request, {
    requiredScope: "voice:transcribe",
  });
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  // Rate limiting: 30 requests per minute per actor / session
  const actorId = auth.user?.id || auth.capability?.sessionId;
  const rateLimitKey = getRateLimitKey(request, "voice_transcribe", actorId);
  const rateCheck = checkRateLimit(rateLimitKey, { windowMs: 60 * 1000, maxRequests: 30 });
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck.resetTimeMs, "Voice transcription rate limit exceeded. Please wait a moment.");
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Check MIME type if provided
    if (body.mimeType && !ALLOWED_AUDIO_MIMES.has(body.mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported audio MIME type: ${body.mimeType}. Allowed formats: webm, wav, ogg, mp4, mpeg` },
        { status: 415 }
      );
    }

    // Check payload size if base64 provided
    if (body.audioBase64) {
      const approximateBytes = Math.ceil((body.audioBase64.length * 3) / 4);
      if (approximateBytes > MAX_AUDIO_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Audio payload exceeds maximum 10MB limit" },
          { status: 413 }
        );
      }
    }

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
