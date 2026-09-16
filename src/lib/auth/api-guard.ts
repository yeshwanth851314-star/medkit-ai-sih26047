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

  // 2. Check forwarded middleware token header
  const forwarded = request.headers.get("x-medkit-session-token");
  if (forwarded) {
    return forwarded.trim();
  }

  // 3. Check Cookie header
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
  const user = verifySessionToken(token);
  if (!user) return null;

  const now = Math.floor(Date.now() / 1000);
  if (user.refreshToken && user.tokenExpiresAt && user.tokenExpiresAt - now < 300) {
    const { refreshClinicianSession } = await import("@/features/auth/auth-service");
    const refreshed = await refreshClinicianSession(user.refreshToken);
    if (refreshed) {
      return refreshed.user;
    } else if (user.tokenExpiresAt < now) {
      // Expired access token and refresh failed
      return null;
    }
  }

  const url = new URL(request.url);
  const isOnboardingRoute = url.pathname.startsWith("/api/auth/onboarding/");

  if (isOnboardingRoute) {
    try {
      const { getServiceSupabaseClient } = await import("@/lib/db/supabase");
      const serviceClient = getServiceSupabaseClient();
      if (serviceClient) {
        const { data: profProfile } = await serviceClient
          .from("clinician_professional_profiles")
          .select("account_status, user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profProfile) {
          return {
            ...user,
            id: profProfile.user_id,
          };
        }
      }
      return user;
    } catch {
      return user;
    }
  }

  try {
    const { verifyActiveClinicalProfile } = await import("@/lib/db/supabase");
    return await verifyActiveClinicalProfile(user);
  } catch (err) {
    console.error("API authentication fail-closed during active-profile verification:", err);
    return null;
  }
}

const CLINICAL_DATA_PREFIXES = [
  "/api/patients",
  "/api/cases",
  "/api/documents",
  "/api/consents",
  "/api/timeline",
  "/api/sync",
];

export function isClinicalDataRoute(pathname: string): boolean {
  return CLINICAL_DATA_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function requireApiAuth(
  request: Request,
  options?: {
    allowedRoles?: UserRole[];
    requireAal2?: boolean;
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

  // Multi-Factor Assurance Level (AAL2) check for clinical data routes
  const url = new URL(request.url);
  const isClinical = isClinicalDataRoute(url.pathname) || options?.requireAal2 === true;

  if (isClinical) {
    // Facility assignment check (Prompt Step 3: Facility membership valid)
    if (!user.facilityId && user.role !== "admin") {
      return {
        errorResponse: NextResponse.json(
          {
            error: "FORBIDDEN: Clinician must be assigned to an active facility to access clinical data",
          },
          { status: 403 }
        ),
      };
    }

    // Phase B Target 1 (Step 4): Current-session AAL2 is strictly authoritative for clinical data access.
    // Fresh password-only logins at aal1 MUST receive HTTP 403 MFA_REQUIRED until TOTP challenge
    // upgrades session to aal2.
    if (user.aal !== "aal2") {
      return {
        errorResponse: NextResponse.json(
          {
            error: "MFA_REQUIRED",
            message: "Clinical data access requires AAL2 authentication. Complete MFA challenge.",
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user };
}
