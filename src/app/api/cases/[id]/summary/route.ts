import { NextResponse } from "next/server";
import { generateDeterministicSummary } from "@/features/summaries/summary-service";
import { getAIProvider } from "@/features/ai/ai-provider";
import { requireApiAuth } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

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
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const useAI = body.type === "ai_assisted";

    const aiProvider = getAIProvider();
    const summary = useAI
      ? await aiProvider.generateClinicalSummary(id)
      : await generateDeterministicSummary(id);

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("POST summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}
