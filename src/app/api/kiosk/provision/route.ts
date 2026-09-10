import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { registerKioskInstance } from "@/lib/db/supabase";

export async function POST(request: Request) {
  // Blocker 1: Only authenticated staff and admins can provision kiosks (doctors without provisioning permission are denied)
  const auth = await requireApiAuth(request, {
    allowedRoles: ["admin", "staff"],
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

    const expiresInDays = Number(body.expiresInDays) || 365;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Generate cryptographically secure 256-bit random secret server-side
    const rawSecret = crypto.randomBytes(32).toString("hex");
    // Hash before database storage — store ONLY the hash, never plaintext
    const secretHash = crypto.createHash("sha256").update(rawSecret).digest("hex");

    // Register kiosk instance via secure RPC (facility is derived strictly from caller profile in database)
    const kiosk = await registerKioskInstance({
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

    // Set HttpOnly device credential cookie for the kiosk browser
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
      { status: err.message?.includes("FORBIDDEN") ? 403 : 500 }
    );
  }
}
