import { NextResponse } from "next/server";
import { caseInputSchema } from "@/features/cases/types";
import { createCaseDraft } from "@/features/cases/case-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const validated = caseInputSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const newCase = await createCaseDraft(validated.data, auth.user.id);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CREATE_CASE",
      resourceType: "cases",
      resourceId: newCase.id,
      metadata: { case_type: newCase.case_type, status: newCase.status },
    });

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (err) {
    console.error("POST /api/cases error:", err);
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
