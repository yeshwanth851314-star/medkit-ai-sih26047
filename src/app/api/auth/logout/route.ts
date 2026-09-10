import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { extractIntakeToken, verifyIntakeCapabilityToken, revokeIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { signOutClinician } from "@/features/auth/auth-service";
import { env } from "@/config/env";

export async function POST(request: Request) {
  let clinicianUser = null;
  // 1. If clinical user is signed in with Supabase access token, sign out
  try {
    clinicianUser = await authenticateApiRequest(request);
    if (clinicianUser?.supabaseToken) {
      await signOutClinician(clinicianUser.supabaseToken);
    }
  } catch (err) {
    console.warn("Notice: Error during clinician sign-out:", err);
  }

  // 2. If intake capability token is provided, revoke it durably
  const intakeToken = extractIntakeToken(request);
  if (intakeToken) {
    const payload = verifyIntakeCapabilityToken(intakeToken);
    if (payload?.sessionId) {
      const credential = resolveKioskCredential(request);
      if (!env.isDemoMode && !credential && !clinicianUser) {
        return NextResponse.json(
          {
            error: "UNAUTHORIZED",
            message: "Kiosk credentials or clinician authorization required to revoke intake session",
          },
          { status: 401 }
        );
      }

      try {
        await revokeIntakeCapabilityToken(payload.sessionId, {
          kioskId: credential?.kioskId,
          kioskSecret: credential?.kioskSecret,
          reason: "kiosk_logout",
          targetStatus: "abandoned",
          actorOrToken: clinicianUser,
        });
      } catch (err: any) {
        console.error("Failed to durably revoke intake session during logout:", err);
        return NextResponse.json(
          {
            error: "REVOCATION_FAILED",
            message: err.message || "Failed to durably revoke intake session",
          },
          { status: 500 }
        );
      }
    }
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
