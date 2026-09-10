import { NextResponse } from "next/server";
import { submitInterviewAnswerAsync } from "@/features/interview/interview-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";
import { env } from "@/config/env";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireIntakeOrClinicalAuth(request, {
    requiredScope: "intake:answer",
    targetSessionId: id,
  });
  if (!auth.authorized) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { answer, inputMode } = body;

    if (!answer || typeof answer !== "string") {
      return NextResponse.json({ error: "Answer text is required" }, { status: 400 });
    }

    // Resolve kiosk credential from HttpOnly device cookie
    const credential = resolveKioskCredential(request);
    if (!auth.user && !credential && !env.isDemoMode) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Kiosk device credential cookie required to submit answers" },
        { status: 401 }
      );
    }

    const result = await submitInterviewAnswerAsync(
      id,
      answer,
      inputMode || "touch",
      credential ? { kioskId: credential.kioskId, kioskSecret: credential.kioskSecret } : undefined
    );

    return NextResponse.json({
      session: result.session,
      nextQuestion: result.nextQuestion,
      isComplete: result.isComplete,
    });
  } catch (err: any) {
    console.error("POST /api/interviews/[id]/answer error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to submit answer" },
      { status: err.message?.includes("UNAUTHORIZED") ? 401 : err.message?.includes("FORBIDDEN") ? 403 : 500 }
    );
  }
}
