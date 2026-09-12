import { NextResponse } from "next/server";
import { createInterviewSession, getCurrentQuestion } from "@/features/interview/interview-service";
import { recordPatientConsent } from "@/features/consent/consent-service";
import { signIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { requirePatientAccess } from "@/lib/auth/object-guard";
import { getSupabaseClient, getServiceSupabaseClient } from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";
import { env } from "@/config/env";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";

const DEMO_PATIENT_ID = "11111111-1111-4111-8111-111111111111";

export async function POST(request: Request) {
  try {
    const clinicianUser = await authenticateApiRequest(request);
    const body = await request.json().catch(() => ({}));
    const requestedPatientId = body.patientId;
    const language = body.language === "te" ? "te" : "en";

    // 1. Unauthenticated callers attempting to bind to arbitrary patient IDs must be rejected with 403
    if (requestedPatientId) {
      if (clinicianUser) {
        const patientCheck = await requirePatientAccess(clinicianUser, requestedPatientId);
        if (!patientCheck.authorized) {
          return patientCheck.errorResponse;
        }
      } else if (requestedPatientId !== DEMO_PATIENT_ID || !env.isDemoMode) {
        return NextResponse.json(
          { error: "Clinician authorization required to bind intake session to an existing patient" },
          { status: 403 }
        );
      }
    }

    // 2. Empty unauthenticated kiosk requests cannot begin intake or fabricate consent/demographics
    if (!clinicianUser && (!body || Object.keys(body).length === 0)) {
      return NextResponse.json(
        { error: "Kiosk intake requires explicit initialization and consent acknowledgment." },
        { status: 400 }
      );
    }

    // 3. Server-side strict consent enforcement (Blocker 6)
    if (!clinicianUser && body.consentAcknowledged !== true) {
      return NextResponse.json(
        { error: "CONSENT_REQUIRED: Kiosk intake requires explicit patient consent acknowledgment" },
        { status: 400 }
      );
    }

    let patientId: string;
    let consentId = body.consentId;
    let sessionId: string | undefined;
    let resolvedFacilityId: string;
    let resolvedCredential: { kioskId: string; kioskSecret: string } | null = null;

    if (requestedPatientId) {
      patientId = requestedPatientId;
      resolvedFacilityId = clinicianUser?.facilityId || (env.isDemoMode ? "fac-hyd-01" : "");
      if (!resolvedFacilityId) {
        return NextResponse.json(
          { error: "FACILITY_REQUIRED: Clinician requires assigned facility identity" },
          { status: 400 }
        );
      }

      if (!consentId) {
        const consentRecord = await recordPatientConsent({
          patientId,
          language,
          consentMethod: body.consentMethod || "touch_acknowledgement",
          scope: ["voice_recording", "document_extraction", "ai_summary"],
          actorOrToken: clinicianUser,
          actorId: clinicianUser?.id,
          actorRole: clinicianUser?.role || "clinician",
        });
        consentId = consentRecord.id;
      }
    } else {
      // Independent kiosk intake: resolve kiosk credentials using centralized resolver
      const credential = resolveKioskCredential(request);
      if (!credential) {
        return NextResponse.json(
          {
            error: "KIOSK_NOT_PROVISIONED",
            message: "This device is not registered for hospital intake. Please contact hospital staff to register this terminal."
          },
          { status: 401 }
        );
      }

      resolvedCredential = credential;
      const { kioskId, kioskSecret } = credential;

      if (!env.isDemoMode) {
        // In non-demo mode, use restricted atomic RPC rpc_kiosk_bootstrap_intake
        const supabase = getSupabaseClient() || getServiceSupabaseClient();
        if (!supabase) {
          throw new Error("Database unavailable: Supabase client is not configured.");
        }
        const { data, error } = await supabase.rpc("rpc_kiosk_bootstrap_intake", {
          p_kiosk_id: kioskId,
          p_kiosk_secret: kioskSecret,
          p_full_name: body.fullName?.trim() || null,
          p_language: language,
          p_consent_acknowledged: true,
          p_consent_method: body.consentMethod || "touch_acknowledgement",
          p_date_of_birth: body.dateOfBirth || null,
          p_gender: body.gender || null,
        });

        if (error) {
          console.error("Supabase rpc_kiosk_bootstrap_intake error:", error);
          const status = error.message.includes("UNAUTHORIZED") ? 401 : 400;
          return NextResponse.json({ error: error.message }, { status });
        }

        const bootstrap = data as {
          patientId: string;
          patientCode: string;
          sessionId: string;
          consentId: string;
          facilityId: string;
        };
        patientId = bootstrap.patientId;
        consentId = bootstrap.consentId;
        sessionId = bootstrap.sessionId;
        resolvedFacilityId = bootstrap.facilityId;
      } else {
        const bootstrap = await mockDb.bootstrapKioskIntake({
          kioskId,
          kioskSecret,
          fullName: body.fullName,
          language,
          consentAcknowledged: true,
          consentMethod: body.consentMethod,
          dateOfBirth: body.dateOfBirth,
          gender: body.gender,
        });
        patientId = bootstrap.patientId;
        consentId = bootstrap.consentId;
        sessionId = bootstrap.sessionId;
        resolvedFacilityId = bootstrap.facilityId;
      }
    }

    const session = await createInterviewSession(patientId, language, consentId, resolvedFacilityId, {
      sessionId,
      skipDbInsert: Boolean(sessionId),
      actorOrToken: clinicianUser,
    });
    const initialQuestion = getCurrentQuestion(session);

    // Issue cryptographic short-lived capability token scoped to this patient intake session
    const intakeToken = signIntakeCapabilityToken({
      sessionId: session.id,
      patientId,
      facilityId: resolvedFacilityId,
      consentId,
      scope: ["intake:answer", "intake:submit", "voice:transcribe", "consent:grant"],
    });

    const response = NextResponse.json({
      sessionId: session.id,
      consentId,
      session,
      currentQuestion: initialQuestion,
      intakeToken,
    });

    if (resolvedCredential) {
      const cookiePayload = JSON.stringify({
        kioskId: resolvedCredential.kioskId,
        kioskSecret: resolvedCredential.kioskSecret,
      });
      response.cookies.set("medkit_kiosk_credential", cookiePayload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 86400 * 30, // 30 days
      });
    }

    return response;
  } catch (err: any) {
    console.error("POST /api/interviews error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to start interview session" },
      { status: 500 }
    );
  }
}
