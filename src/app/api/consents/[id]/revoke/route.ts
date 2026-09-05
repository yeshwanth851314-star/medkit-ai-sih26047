import { NextResponse } from "next/server";
import { revokePatientConsent } from "@/features/consent/consent-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const revokedConsent = await revokePatientConsent(id, body.actorId, body.reason);

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
