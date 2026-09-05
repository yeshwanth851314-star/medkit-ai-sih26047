import { NextResponse } from "next/server";
import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";
import { verifySessionToken } from "./jwt";
import { SESSION_COOKIE_NAME } from "./session";

export function extractBearerOrCookieToken(request: Request): string | null {
  // 1. Check Authorization header
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // 2. Check Cookie header
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

export async function authenticateApiRequest(request: Request): Promise<AuthUser | null> {
  const token = extractBearerOrCookieToken(request);
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireApiAuth(
  request: Request,
  options?: {
    allowedRoles?: UserRole[];
  }
): Promise<{ user: AuthUser } | { errorResponse: NextResponse }> {
  const user = await authenticateApiRequest(request);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Missing or invalid clinical authentication session" },
        { status: 401 }
      ),
    };
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(user.role)) {
      return {
        errorResponse: NextResponse.json(
          {
            error: `FORBIDDEN: Role '${user.role}' is not authorized for this clinical operation`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user };
}
