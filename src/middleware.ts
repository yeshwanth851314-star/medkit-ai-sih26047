import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifySessionTokenWeb,
  inspectSessionTokenWeb,
  refreshClinicianSessionWeb,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/jwt-web";

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

    // Inspect session: signature validity, expiration, and refresh token presence
    const inspection = await inspectSessionTokenWeb(sessionCookie);

    if (!inspection.valid) {
      // Check legacy demo token fallback if in demo mode
      const demoUser = await verifySessionTokenWeb(sessionCookie);
      if (!demoUser || !["doctor", "clinician", "staff", "admin"].includes(demoUser.role)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirectTo", pathname);
        loginUrl.searchParams.set("error", "invalid_session");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
      }
      return NextResponse.next();
    }

    let activeUser = inspection.user!;
    let rotatedToken: string | null = null;

    // If token is expired or will expire within 5 minutes, attempt transparent refresh
    if ((inspection.isExpired || inspection.willExpireSoon) && inspection.refreshToken) {
      const refreshed = await refreshClinicianSessionWeb(inspection.refreshToken);
      if (refreshed) {
        activeUser = refreshed.user;
        rotatedToken = refreshed.token;
      } else if (inspection.isExpired) {
        // Token is expired and refresh failed: invalidate session cookie and redirect to login
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirectTo", pathname);
        loginUrl.searchParams.set("error", "session_expired");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
      }
    }

    // Verify authorized role
    if (!["doctor", "clinician", "staff", "admin"].includes(activeUser.role)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      loginUrl.searchParams.set("error", "unauthorized_role");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Forward active user identity in request headers to downstream Server Components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-medkit-user-id", activeUser.id);
    requestHeaders.set("x-medkit-user-role", activeUser.role);
    if (activeUser.facilityId) {
      requestHeaders.set("x-medkit-user-facility", activeUser.facilityId);
    }
    if (rotatedToken) {
      requestHeaders.set("x-medkit-session-token", rotatedToken);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // If session was refreshed, persist new session token cookie on the outgoing response
    if (rotatedToken) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: rotatedToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/doctor/:path*"],
};
