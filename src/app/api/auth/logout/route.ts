import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { extractIntakeToken, verifyIntakeCapabilityToken, revokeIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { signOutClinician } from "@/features/auth/auth-service";

export async function POST(request: Request) {
  // 1. If clinical user is signed in with Supabase access token, sign out
  try {
    const clinicianUser = await authenticateApiRequest(request);
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
      await revokeIntakeCapabilityToken(payload.sessionId);
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
