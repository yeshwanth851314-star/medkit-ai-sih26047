import { NextResponse } from "next/server";
import { recordPatientConsent, verifyPatientConsent } from "@/features/consent/consent-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId query parameter is required" }, { status: 400 });
    }

    const verification = await verifyPatientConsent(patientId);
    return NextResponse.json(verification);
  } catch (err: any) {
    console.error("GET /api/consents error:", err);
    return NextResponse.json({ error: "Failed to verify patient consent" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { patientId, language, consentMethod, scope, purpose } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required to record consent" }, { status: 400 });
    }

    const consent = await recordPatientConsent({
      patientId,
      language: language || "en",
      consentMethod: consentMethod || "touch_acknowledgement",
      scope: scope || ["voice_recording", "document_extraction", "ai_summary"],
      purpose: purpose || "clinical_care_and_case_taking",
    });

    return NextResponse.json({ success: true, consent }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/consents error:", err);
    return NextResponse.json({ error: err.message || "Failed to record consent" }, { status: 500 });
  }
}
