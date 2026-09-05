import { NextResponse } from "next/server";
import { getCaseDetails, updateCaseDraft, finalizeCase } from "@/features/cases/case-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

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
    const clinicalCase = await getCaseDetails(id);

    if (!clinicalCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    return NextResponse.json({ case: clinicalCase });
  } catch (err) {
    console.error("GET /api/cases/[id] error:", err);
    return NextResponse.json({ error: "Failed to retrieve case details" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();

    // Finalization strictly requires doctor or clinician role
    if (body.action === "finalize") {
      if (!["doctor", "clinician"].includes(auth.user.role)) {
        return NextResponse.json(
          { error: "FORBIDDEN: Only doctors or clinicians can finalize medical cases" },
          { status: 403 }
        );
      }

      const finalized = await finalizeCase(id, auth.user.id);

      await logAuditEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "FINALIZE_CASE",
        resourceType: "cases",
        resourceId: id,
        metadata: { status: "final" },
      });

      return NextResponse.json({ success: true, case: finalized });
    }

    // Standard draft update
    const updated = await updateCaseDraft(id, body);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "UPDATE_CASE",
      resourceType: "cases",
      resourceId: id,
      metadata: { fields_updated: Object.keys(body) },
    });

    return NextResponse.json({ success: true, case: updated });
  } catch (err: any) {
    console.error("PATCH /api/cases/[id] error:", err);
    if (err.message && err.message.includes("CANNOT_MUTATE_FINAL")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Failed to update case" }, { status: 500 });
  }
}
