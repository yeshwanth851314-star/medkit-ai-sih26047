import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { extractIntakeToken, verifyIntakeCapabilityToken, revokeIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";

export async function POST(request: Request) {
  const intakeToken = extractIntakeToken(request);
  if (intakeToken) {
    const payload = verifyIntakeCapabilityToken(intakeToken);
    if (payload?.sessionId) {
      revokeIntakeCapabilityToken(payload.sessionId);
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
