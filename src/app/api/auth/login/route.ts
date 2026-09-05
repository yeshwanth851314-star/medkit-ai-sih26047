import { NextResponse } from "next/server";
import { loginSchema } from "@/features/auth/types";
import { authenticateClinician } from "@/features/auth/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid credentials format", details: validated.error.format() },
        { status: 400 }
      );
    }

    const authResult = await authenticateClinician(validated.data);
    if (!authResult) {
      // Safe, non-enumerating generic clinical error message as required by 04_APP_FLOW.md
      return NextResponse.json(
        { error: "Invalid email or password. Please verify your clinical credentials." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: authResult.user,
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: authResult.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Login API internal error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during authentication." },
      { status: 500 }
    );
  }
}
