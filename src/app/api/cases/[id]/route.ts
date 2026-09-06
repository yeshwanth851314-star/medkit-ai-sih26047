import { NextResponse } from "next/server";
import { getCaseDetails, updateCaseDraft, finalizeCase, addCaseAmendment } from "@/features/cases/case-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireCaseAccess } from "@/lib/auth/object-guard";
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
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }
    const clinicalCase = caseCheck.data;

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
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }
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

    // Amendment on finalized case
    if (body.action === "amend") {
      if (!["doctor", "clinician"].includes(auth.user.role)) {
        return NextResponse.json(
          { error: "FORBIDDEN: Only doctors or clinicians can amend finalized medical records" },
          { status: 403 }
        );
      }

      if (!body.reason || !body.notes) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR: Reason and amendment notes are required" },
          { status: 400 }
        );
      }

      const amended = await addCaseAmendment(id, {
        actorId: auth.user.id,
        actorName: auth.user.fullName || "Attending Physician",
        reason: body.reason,
        notes: body.notes,
      });

      return NextResponse.json({ success: true, case: amended });
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
