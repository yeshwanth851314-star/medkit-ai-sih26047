import { NextResponse } from "next/server";
import { buildPatientTimeline, compareConsecutiveVisits } from "@/features/timeline/timeline-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requirePatientAccess, requireCaseBelongsToPatient } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { patientId } = await params;
    const patientCheck = await requirePatientAccess(auth.user, patientId);
    if (!patientCheck.authorized) {
      return patientCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const targetCaseId = searchParams.get("caseId") || undefined;

    if (targetCaseId) {
      const matchCheck = await requireCaseBelongsToPatient(targetCaseId, patientId, auth.user);
      if (!matchCheck.authorized) {
        return matchCheck.errorResponse;
      }
    }

    const [milestones, comparison] = await Promise.all([
      buildPatientTimeline(patientId, auth.user),
      compareConsecutiveVisits(patientId, targetCaseId, auth.user),
    ]);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "READ_TIMELINE",
      resourceType: "patients",
      resourceId: patientId,
      metadata: { action: "view_timeline", targetCaseId },
      actorOrToken: auth.user,
    });

    return NextResponse.json({
      milestones,
      comparison,
    });
  } catch (err) {
    console.error("GET /api/timeline/[patientId] error:", err);
    return NextResponse.json({ error: "Failed to construct patient timeline" }, { status: 500 });
  }
}

