import { NextResponse } from "next/server";
import { generateDeterministicSummary, generateAIAssistedSummary } from "@/features/summaries/summary-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const summary = await generateDeterministicSummary(id);
    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("GET summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const useAI = body.type === "ai_assisted";

    const summary = useAI
      ? await generateAIAssistedSummary(id)
      : await generateDeterministicSummary(id);

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("POST summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}
