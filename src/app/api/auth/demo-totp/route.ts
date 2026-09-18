import { NextResponse } from "next/server";
import { DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";
import { generateTotpCode, getTotpRemainingSeconds } from "@/lib/auth/totp";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email") || DEMO_QUICK_ACCESS.doctor.email;

    // Only allow for demo doctor account
    if (email.toLowerCase().trim() !== DEMO_QUICK_ACCESS.doctor.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Demo TOTP is only available for demo clinician accounts" },
        { status: 400 }
      );
    }

    const secret = DEMO_QUICK_ACCESS.doctor.totpSecret;
    const totpCode = await generateTotpCode(secret);
    const remainingSeconds = getTotpRemainingSeconds();

    return NextResponse.json({
      email,
      totpCode,
      remainingSeconds,
      secretDisplay: "MEDKIT...34567",
    });
  } catch (err: any) {
    console.error("Demo TOTP error:", err);
    return NextResponse.json(
      { error: "Failed to generate demo TOTP code" },
      { status: 500 }
    );
  }
}
