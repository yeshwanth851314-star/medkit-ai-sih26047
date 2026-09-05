import { NextResponse } from "next/server";
import { createInterviewSession, getCurrentQuestion } from "@/features/interview/interview-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const patientId = body.patientId || "11111111-1111-4111-8111-111111111111"; // Fallback to synthetic demo patient if needed
    const language = body.language === "te" ? "te" : "en";

    const session = createInterviewSession(patientId, language);
    const initialQuestion = getCurrentQuestion(session);

    return NextResponse.json({
      sessionId: session.id,
      session,
      currentQuestion: initialQuestion,
    });
  } catch (err: any) {
    console.error("POST /api/interviews error:", err);
    return NextResponse.json({ error: "Failed to start interview session" }, { status: 500 });
  }
}
