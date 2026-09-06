import { NextResponse } from "next/server";
import { createInterviewSession, getCurrentQuestion } from "@/features/interview/interview-service";
import { recordPatientConsent } from "@/features/consent/consent-service";
import { signIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const patientId = body.patientId || "11111111-1111-4111-8111-111111111111"; // Fallback to synthetic demo patient if needed
    const language = body.language === "te" ? "te" : "en";

    let consentId = body.consentId;
    if (!consentId) {
      const consentRecord = await recordPatientConsent({
        patientId,
        language,
        consentMethod: body.consentMethod || "touch_acknowledgement",
        scope: ["voice_recording", "document_extraction", "ai_summary"],
      });
      consentId = consentRecord.id;
    }

    const session = createInterviewSession(patientId, language, consentId);
    const initialQuestion = getCurrentQuestion(session);

    // Issue cryptographic short-lived capability token scoped to this patient intake session
    const intakeToken = signIntakeCapabilityToken({
      sessionId: session.id,
      patientId,
      scope: ["intake:answer", "intake:submit", "voice:transcribe", "consent:grant"],
    });

    return NextResponse.json({
      sessionId: session.id,
      consentId,
      session,
      currentQuestion: initialQuestion,
      intakeToken,
    });
  } catch (err: any) {
    console.error("POST /api/interviews error:", err);
    return NextResponse.json({ error: "Failed to start interview session" }, { status: 500 });
  }
}

