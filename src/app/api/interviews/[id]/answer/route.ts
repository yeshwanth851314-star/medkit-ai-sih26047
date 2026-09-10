import { NextResponse } from "next/server";
import { submitInterviewAnswerAsync } from "@/features/interview/interview-service";
import { requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";

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

    const result = await submitInterviewAnswerAsync(id, answer, inputMode || "touch");

    return NextResponse.json({
      session: result.session,
      nextQuestion: result.nextQuestion,
      isComplete: result.isComplete,
    });
  } catch (err: any) {
    console.error("POST /api/interviews/[id]/answer error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit answer" }, { status: 500 });
  }
}
