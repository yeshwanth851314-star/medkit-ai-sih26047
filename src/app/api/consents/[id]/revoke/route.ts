import { NextResponse } from "next/server";
import { revokePatientConsent } from "@/features/consent/consent-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "staff", "admin"],
  });
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Derive actor identity strictly from authenticated server context, NEVER client body
    const actorId = auth.user.id;
    const reason = body.reason || "Patient requested consent revocation";

    const revokedConsent = await revokePatientConsent(id, actorId, reason);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CONSENT_REVOKED",
      resourceType: "consents",
      resourceId: id,
      metadata: { reason },
    });

    return NextResponse.json({
      success: true,
      consent: revokedConsent,
    });
  } catch (err: any) {
    console.error("POST /api/consents/[id]/revoke error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to revoke patient consent" },
      { status: 500 }
    );
  }
}
