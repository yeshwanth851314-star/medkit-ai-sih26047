import { NextResponse } from "next/server";
import { compileInterviewToCase } from "@/features/interview/interview-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";

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
    const body = await request.json().catch(() => ({}));
    const kioskId = body.kioskId || request.headers.get("x-kiosk-id") || undefined;
    const kioskSecret = body.kioskSecret || request.headers.get("x-kiosk-secret") || undefined;

    const clinicalCase = await compileInterviewToCase(id, { kioskId, kioskSecret });

    return NextResponse.json({
      success: true,
      case: clinicalCase,
    });
  } catch (err: any) {
    console.error("POST /api/interviews/[id]/submit error:", err);
    return NextResponse.json({ error: err.message || "Failed to finalize interview to case" }, { status: 500 });
  }
}
