import { NextResponse } from "next/server";
import { compileInterviewToCase } from "@/features/interview/interview-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";
import { env } from "@/config/env";
import { DEMO_PATIENT_ID, DEMO_KIOSK_ID, DEMO_KIOSK_SECRET } from "@/lib/auth/demo-users";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireIntakeOrClinicalAuth(request, {
    requiredScope: "intake:submit",
    targetSessionId: id,
  });
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  try {
    // Resolve kiosk credentials server-side from HttpOnly device cookie or allow demo patient capability
    const credential = resolveKioskCredential(request, { allowDemoTokenFallback: true });
    const isDemoPatientCapability = auth.capability?.patientId === DEMO_PATIENT_ID;

    // In production non-demo mode, kiosk patient callers MUST have provisioned device cookie or valid demo capability
    if (!auth.user && !credential && !env.isDemoMode && !isDemoPatientCapability) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Kiosk device credential cookie required for case compilation" },
        { status: 401 }
      );
    }

    const resolvedKioskId = credential?.kioskId || (isDemoPatientCapability || env.isDemoMode ? DEMO_KIOSK_ID : undefined);
    const resolvedKioskSecret = credential?.kioskSecret || (isDemoPatientCapability || env.isDemoMode ? DEMO_KIOSK_SECRET : undefined);
    // auth.user for clinician; raw Bearer JWT string for kiosk intake tokens
    const rawBearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    const resolvedActorOrToken = auth.user ?? rawBearerToken ?? null;

    const clinicalCase = await compileInterviewToCase(id, {
      kioskId: resolvedKioskId,
      kioskSecret: resolvedKioskSecret,
      actorOrToken: resolvedActorOrToken,
    });

    return NextResponse.json({
      success: true,
      case: clinicalCase,
    });
  } catch (err: any) {
    console.error("POST /api/interviews/[id]/submit error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to finalize interview to case" },
      { status: err.message?.includes("UNAUTHORIZED") ? 401 : err.message?.includes("FORBIDDEN") ? 403 : 500 }
    );
  }
}
