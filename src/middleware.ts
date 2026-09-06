import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenWeb, SESSION_COOKIE_NAME } from "@/lib/auth/jwt-web";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected paths requiring clinical authentication
  if (pathname.startsWith("/doctor")) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify session signature, expiration, and clinical role
    const user = await verifySessionTokenWeb(sessionCookie);
    if (!user || !["doctor", "clinician", "staff", "admin"].includes(user.role)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      loginUrl.searchParams.set("error", "invalid_session");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/doctor/:path*"],
};

