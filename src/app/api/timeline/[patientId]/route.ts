import { NextResponse } from "next/server";
import { buildPatientTimeline, compareConsecutiveVisits } from "@/features/timeline/timeline-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
    const { searchParams } = new URL(request.url);
    const targetCaseId = searchParams.get("caseId") || undefined;

    const [milestones, comparison] = await Promise.all([
      buildPatientTimeline(patientId),
      compareConsecutiveVisits(patientId, targetCaseId),
    ]);

    return NextResponse.json({
      milestones,
      comparison,
    });
  } catch (err) {
    console.error("GET /api/timeline/[patientId] error:", err);
    return NextResponse.json({ error: "Failed to construct patient timeline" }, { status: 500 });
  }
}
