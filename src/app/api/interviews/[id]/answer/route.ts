import { NextResponse } from "next/server";
import { submitInterviewAnswer } from "@/features/interview/interview-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { answer, inputMode } = body;

    if (!answer || typeof answer !== "string") {
      return NextResponse.json({ error: "Answer text is required" }, { status: 400 });
    }

    const result = submitInterviewAnswer(id, answer, inputMode || "touch");

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
