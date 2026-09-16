import { NextResponse } from "next/server";
import {
  validateRemoteInvitation,
  consumeRemoteInvitation,
} from "@/features/intake/remote-intake-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.trim().length === 0) {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
    }

    const validation = await validateRemoteInvitation(token);
    if (!validation.valid) {
      if (validation.reason === "INVITATION_EXPIRED" || validation.reason === "INVITATION_CONSUMED") {
        return NextResponse.json(
          { error: `Invitation is no longer active: ${validation.reason}` },
          { status: 410 }
        );
      }
      if (validation.reason === "INVITATION_REVOKED") {
        return NextResponse.json(
          { error: "Invitation has been revoked by facility administration" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: validation.invitationId,
        facilityId: validation.facilityId,
        patientId: validation.patientId,
        purpose: validation.purpose,
        expiresAt: validation.expiresAt,
        remainingUses: validation.remainingUses,
      },
    });
  } catch (err: any) {
    console.error("GET /api/intake/invite/[token] error:", err);
    return NextResponse.json({ error: err.message || "Failed to validate invitation" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.trim().length === 0) {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
    }

    const result = await consumeRemoteInvitation(token);
    return NextResponse.json({
      success: true,
      consumed: result.consumed,
      facilityId: result.facilityId,
      patientId: result.patientId,
      invitationId: result.invitationId,
    });
  } catch (err: any) {
    console.error("POST /api/intake/invite/[token] error:", err);
    const msg = err.message || "";
    if (msg.includes("INVITATION_CONSUMED") || msg.includes("INVITATION_EXPIRED")) {
      return NextResponse.json({ error: msg }, { status: 410 });
    }
    if (msg.includes("INVITATION_REVOKED")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("INVITATION_NOT_FOUND")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg || "Failed to consume invitation" }, { status: 500 });
  }
}
