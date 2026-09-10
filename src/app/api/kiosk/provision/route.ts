import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { registerKioskInstance } from "@/lib/db/supabase";

export async function POST(request: Request) {
  // Only authenticated clinicians and admins can provision kiosks
  const auth = await requireApiAuth(request, {
    allowedRoles: ["admin", "doctor", "clinician"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length < 3) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: A valid kiosk name (at least 3 characters) is required." },
        { status: 400 }
      );
    }

    // Determine assigned facility: non-admins are strictly bound to their facility
    let facilityId = auth.user.facilityId;
    if (auth.user.role === "admin" && body.facilityId) {
      facilityId = String(body.facilityId).trim();
    }

    if (!facilityId) {
      return NextResponse.json(
        { error: "FACILITY_REQUIRED: Facility identity is required to provision a kiosk." },
        { status: 400 }
      );
    }

    const expiresInDays = Number(body.expiresInDays) || 365;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Generate cryptographically secure 256-bit random secret
    const rawSecret = crypto.randomBytes(32).toString("hex");
    const secretHash = crypto.createHash("sha256").update(rawSecret).digest("hex");

    // Register kiosk instance in database
    const kiosk = await registerKioskInstance({
      facility_id: facilityId,
      name,
      secretHash,
      status: "active",
      expiresAt: expiresAt.toISOString(),
      actorOrToken: auth.user,
    });

    const response = NextResponse.json({
      success: true,
      message: "Kiosk successfully provisioned.",
      kioskId: kiosk.id,
      facilityId: kiosk.facility_id,
      name: kiosk.name,
      expiresAt: kiosk.expires_at,
      credentialConfigured: true,
    });

    // Set HttpOnly signed device credential cookie for the kiosk browser
    response.cookies.set({
      name: "medkit_kiosk_credential",
      value: JSON.stringify({
        kioskId: kiosk.id,
        kioskSecret: rawSecret,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresInDays * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error("Kiosk provisioning error:", err);
    return NextResponse.json(
      { error: `Failed to provision kiosk: ${err.message || "Internal error"}` },
      { status: 500 }
    );
  }
}
