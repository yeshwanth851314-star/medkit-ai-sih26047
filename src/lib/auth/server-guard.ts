import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "./jwt";
import { SESSION_COOKIE_NAME } from "./session";
import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

export async function requireServerAuth(options?: {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}): Promise<AuthUser> {
  const headerList = await headers();
  const forwardedToken = headerList.get("x-medkit-session-token");

  const cookieStore = await cookies();
  const token = forwardedToken || cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect(options?.redirectTo || "/login");
  }

  const user = verifySessionToken(token);
  if (!user) {
    redirect(options?.redirectTo || "/login");
  }

  let activeUser = user;

  const now = Math.floor(Date.now() / 1000);
  if (user.refreshToken && user.tokenExpiresAt && user.tokenExpiresAt - now < 300) {
    const { refreshClinicianSession } = await import("@/features/auth/auth-service");
    const refreshed = await refreshClinicianSession(user.refreshToken);
    if (refreshed) {
      activeUser = refreshed.user;
    } else if (user.tokenExpiresAt < now) {
      // Access token is already expired and refresh failed: redirect to login
      redirect(options?.redirectTo || "/login?error=session_expired");
    }
  }

  try {
    const { verifyActiveClinicalProfile } = await import("@/lib/db/supabase");
    const verified = await verifyActiveClinicalProfile(activeUser);
    if (!verified) {
      redirect(options?.redirectTo || "/login?error=inactive_profile");
    }
    activeUser = verified;
  } catch {
    redirect(options?.redirectTo || "/login?error=profile_verification_failed");
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(activeUser.role)) {
      redirect("/login?error=unauthorized_role");
    }
  }

  return activeUser;
}
