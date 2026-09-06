import { NextResponse } from "next/server";
import { recordPatientConsent, verifyPatientConsent } from "@/features/consent/consent-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { requirePatientAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId query parameter is required" }, { status: 400 });
    }

    const auth = await requireIntakeOrClinicalAuth(request, {
      targetPatientId: patientId,
    });
    if (!auth.authorized) {
      return auth.errorResponse;
    }

    if (auth.user) {
      const patientCheck = await requirePatientAccess(auth.user, patientId);
      if (!patientCheck.authorized) {
        return patientCheck.errorResponse;
      }
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

    const auth = await requireIntakeOrClinicalAuth(request, {
      targetPatientId: patientId,
      requiredScope: "consent:grant",
    });
    if (!auth.authorized) {
      return auth.errorResponse;
    }

    if (auth.user) {
      const patientCheck = await requirePatientAccess(auth.user, patientId);
      if (!patientCheck.authorized) {
        return patientCheck.errorResponse;
      }
    }

    const consent = await recordPatientConsent({
      patientId,
      language: language || "en",
      consentMethod: consentMethod || "touch_acknowledgement",
      scope: scope || ["voice_recording", "document_extraction", "ai_summary"],
      purpose: purpose || "clinical_care_and_case_taking",
    });

    await logAuditEvent({
      actorId: auth.user?.id || `kiosk:${auth.capability?.sessionId || "anonymous"}`,
      actorRole: auth.user?.role || "patient",
      action: "CONSENT_RECORDED",
      resourceType: "consents",
      resourceId: consent.id,
      metadata: { patientId, language, consentMethod },
    });

    return NextResponse.json({ success: true, consent }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/consents error:", err);
    return NextResponse.json({ error: err.message || "Failed to record consent" }, { status: 500 });
  }
}
