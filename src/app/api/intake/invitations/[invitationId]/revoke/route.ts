import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { revokeRemoteInvitation } from "@/features/intake/remote-intake-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "staff", "admin"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { invitationId } = await params;
    if (!invitationId || invitationId.trim().length === 0) {
      return NextResponse.json({ error: "Missing invitation ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await revokeRemoteInvitation(invitationId.trim(), auth.user, body?.reason);

    return NextResponse.json({
      success: true,
      revoked: true,
      message: "Remote intake invitation revoked successfully",
      revokedAt: result.revokedAt,
    });
  } catch (err: any) {
    console.error("POST /api/intake/invitations/[invitationId]/revoke error:", err);
    const msg = err.message || "";
    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("INVITATION_NOT_FOUND")) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg || "Failed to revoke invitation" }, { status: 500 });
  }
}
