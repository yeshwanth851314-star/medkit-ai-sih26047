import { NextResponse } from "next/server";
import { compileInterviewToCase } from "@/features/interview/interview-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";
import { env } from "@/config/env";

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
    // Resolve kiosk credentials server-side from HttpOnly device cookie
    const credential = resolveKioskCredential(request);

    // In production non-demo mode, kiosk patient callers MUST have provisioned device cookie
    if (!auth.user && !credential && !env.isDemoMode) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Kiosk device credential cookie required for case compilation" },
        { status: 401 }
      );
    }

    const clinicalCase = await compileInterviewToCase(id, {
      kioskId: credential?.kioskId,
      kioskSecret: credential?.kioskSecret,
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
