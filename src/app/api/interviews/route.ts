import { NextResponse } from "next/server";
import { createInterviewSession, getCurrentQuestion } from "@/features/interview/interview-service";
import { recordPatientConsent } from "@/features/consent/consent-service";
import { signIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { requirePatientAccess } from "@/lib/auth/object-guard";

const DEMO_PATIENT_ID = "11111111-1111-4111-8111-111111111111";

export async function POST(request: Request) {
  try {
    const clinicianUser = await authenticateApiRequest(request);
    const body = await request.json().catch(() => ({}));
    const requestedPatientId = body.patientId;
    const language = body.language === "te" ? "te" : "en";

    let patientId: string;
    if (requestedPatientId) {
      if (clinicianUser) {
        const patientCheck = await requirePatientAccess(clinicianUser, requestedPatientId);
        if (!patientCheck.authorized) {
          return patientCheck.errorResponse;
        }
        patientId = requestedPatientId;
      } else if (requestedPatientId === DEMO_PATIENT_ID) {
        patientId = DEMO_PATIENT_ID;
      } else {
        // Unauthenticated kiosk calls cannot bind to arbitrary patient IDs
        return NextResponse.json(
          { error: "Clinician authorization required to bind intake session to an existing patient" },
          { status: 403 }
        );
      }
    } else {
      // Default anonymous / kiosk demo intake context
      patientId = DEMO_PATIENT_ID;
    }

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

