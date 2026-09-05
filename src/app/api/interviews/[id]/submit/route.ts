import { NextResponse } from "next/server";
import { compileInterviewToCase } from "@/features/interview/interview-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clinicalCase = await compileInterviewToCase(id);

    return NextResponse.json({
      success: true,
      case: clinicalCase,
    });
  } catch (err: any) {
    console.error("POST /api/interviews/[id]/submit error:", err);
    return NextResponse.json({ error: err.message || "Failed to finalize interview to case" }, { status: 500 });
  }
}
