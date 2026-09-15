import { NextResponse } from "next/server";
import { registerClinicianApplicant } from "@/features/onboarding/clinician-onboarding-service";
import { ClinicianRegistrationPayload } from "@/features/onboarding/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClinicianRegistrationPayload;
    const result = await registerClinicianApplicant(body);

    const response = NextResponse.json(
      {
        profile: result.profile,
        message: result.message,
      },
      { status: 201 }
    );

    // Attach authenticated session cookie so applicant can securely proceed through onboarding
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("Clinician registration error:", err);
    const message = err?.message || "Internal server error during registration";
    const status = message.startsWith("INVALID_REQUEST") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
