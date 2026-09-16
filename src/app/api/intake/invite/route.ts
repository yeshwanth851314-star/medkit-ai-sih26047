import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requirePatientAccess } from "@/lib/auth/object-guard";
import { createRemoteInvitation } from "@/features/intake/remote-intake-service";
import { z } from "zod";

const createInviteSchema = z.object({
  patientId: z.string().uuid().optional().nullable(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
  maxUses: z.number().int().min(1).max(10).default(1),
  purpose: z.string().default("patient_registration_and_intake"),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "staff", "admin"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const validated = createInviteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    if (validated.data.patientId) {
      const patientCheck = await requirePatientAccess(auth.user, validated.data.patientId);
      if (!patientCheck.authorized) {
        return patientCheck.errorResponse;
      }
    }

    const result = await createRemoteInvitation({
      patientId: validated.data.patientId,
      expiresInHours: validated.data.expiresInHours,
      maxUses: validated.data.maxUses,
      purpose: validated.data.purpose,
      actor: auth.user,
    });

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: result.invitation.id,
          facilityId: result.invitation.facility_id,
          patientId: result.invitation.patient_id,
          expiresAt: result.invitation.expires_at,
          maxUses: result.invitation.max_uses,
        },
        inviteUrl: result.inviteUrl,
        rawToken: result.rawToken,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/intake/invite error:", err);
    return NextResponse.json({ error: err.message || "Failed to create remote invitation" }, { status: 500 });
  }
}
