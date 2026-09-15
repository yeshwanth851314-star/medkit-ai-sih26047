import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import {
  initiateClinicianMfaEnrollment,
  verifyClinicianMfaChallenge,
} from "@/features/onboarding/clinician-onboarding-service";

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Valid applicant session required for MFA enrollment." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, userId, verificationCode, secret, factorId } = body;

    // Security invariant: never trust client-supplied userId
    if (userId && userId !== user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN: You cannot configure or verify MFA for another applicant." },
        { status: 403 }
      );
    }

    if (action === "enroll") {
      const enrollment = await initiateClinicianMfaEnrollment(user);
      return NextResponse.json(enrollment, { status: 200 });
    }

    // Verification step (action === "verify" or direct code submission)
    if (!verificationCode) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: verificationCode is required for challenge verification" },
        { status: 400 }
      );
    }

    const result = await verifyClinicianMfaChallenge(user, verificationCode, secret, factorId);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Clinician MFA enrollment/verification error:", err);
    const message = err?.message || "Internal server error during MFA operation";
    const status = message.startsWith("PROFILE_NOT_FOUND")
      ? 404
      : message.startsWith("INVALID_ONBOARDING_STATE")
      ? 409
      : message.startsWith("INVALID_MFA_CODE")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
