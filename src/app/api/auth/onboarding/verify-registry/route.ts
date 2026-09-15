import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { verifyClinicianCredentials } from "@/features/onboarding/clinician-onboarding-service";

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Valid applicant session required for council verification." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, fullName } = body;

    // Security invariant: never trust client-supplied userId
    if (userId && userId !== user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN: You cannot verify credentials for another applicant." },
        { status: 403 }
      );
    }

    const result = await verifyClinicianCredentials(user, fullName);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Clinician registry verification error:", err);
    const message = err?.message || "Internal server error during verification";
    const status = message.startsWith("PROFILE_NOT_FOUND")
      ? 404
      : message.startsWith("INVALID_ONBOARDING_STATE")
      ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
