import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/db/supabase";
import { AuthUser, LoginCredentials } from "./types";

import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

let testMockUsers: Record<string, any> | null = null;

/**
 * Test-only hook to inject mock users for isolated unit testing.
 * Strictly no-op in production environments.
 */
export function setTestMockUsers(users: Record<string, any> | null): void {
  if (process.env.NODE_ENV !== "production") {
    testMockUsers = users;
  }
}

export async function authenticateClinician(credentials: LoginCredentials): Promise<{ user: AuthUser; token: string } | null> {
  // Production authentication path (Strictly Supabase Auth + Verified Active Profiles)
  if (process.env.NODE_ENV === "production" || !env.isDemoMode) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error("Authentication failed: Supabase client is not configured in production mode.");
      return null;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error || !data.user) {
      return null;
    }

    // Fetch profile role from profiles table using request-bound client with user access token
    const authenticatedClient = getSupabaseClient(data.session?.access_token);
    if (!authenticatedClient) {
      return null;
    }

    const { data: profile, error: profileError } = await authenticatedClient
      .from("profiles")
      .select("full_name, role, facility_id, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.role ||
      profile.is_active !== true
    ) {
      console.error(`Authentication denied: Missing, inactive, or invalid profile for user ${data.user.id}`);
      return null; // Fail closed: never default to doctor or synthesize privileges
    }

    // Derive authoritative session AAL directly from Supabase Auth JWT claims
    let sessionAal: "aal1" | "aal2" = "aal1";
    if (data.session?.access_token) {
      try {
        const parts = data.session.access_token.split(".");
        if (parts.length === 3) {
          let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4) b64 += "=";
          const claims = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
          if (claims.aal === "aal2") {
            sessionAal = "aal2";
          }
        }
      } catch {}
    }

    // Query MFA enrollment metadata from clinician_professional_profiles
    const { data: profProfile } = await authenticatedClient
      .from("clinician_professional_profiles")
      .select("mfa_enrolled")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const mfaEnrolled = profProfile ? profProfile.mfa_enrolled === true : false;

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || credentials.email,
      fullName: profile.full_name || "Clinician",
      role: profile.role,
      facilityId: profile.facility_id || null,
      supabaseToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      tokenExpiresAt: data.session?.expires_at,
      aal: sessionAal,
      mfaEnrolled,
    };

    const token = signSessionToken(authUser);
    return {
      user: authUser,
      token,
    };
  }

  // Offline / Unit Test Execution with injected mock users (strictly reached only when not in production and in demo mode)
  let activeMockUsers = testMockUsers;
  if (!activeMockUsers) {
    try {
      const { DEMO_CLINICIAN_USERS } = require("@/lib/auth/demo-users");
      activeMockUsers = DEMO_CLINICIAN_USERS;
    } catch {}
  }
  if (activeMockUsers) {
    const mockUser = activeMockUsers[credentials.email.toLowerCase().trim()];
    if (mockUser && mockUser.password === credentials.password) {
      const { password, ...user } = mockUser;
      const token = signSessionToken(user);
      return {
        user,
        token,
      };
    }
  }

  return null;
}

/**
 * Executes supported Supabase session refresh using the refresh token,
 * verifies active profile status, and returns refreshed identity and rotated tokens.
 */
export async function refreshClinicianSession(
  refreshToken: string
): Promise<{ user: AuthUser; token: string } | null> {
  if (env.isDemoMode) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    console.warn("Notice: Failed to refresh Supabase session token:", error?.message);
    return null;
  }

  // Fetch updated profile
  const authenticatedClient = getSupabaseClient(data.session.access_token);
  if (!authenticatedClient) return null;

  const { data: profile, error: profileError } = await authenticatedClient
    .from("profiles")
    .select("full_name, role, facility_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.role ||
    profile.is_active !== true
  ) {
    console.error(`Session refresh denied: Inactive or invalid profile for user ${data.user.id}`);
    return null;
  }

  let sessionAal: "aal1" | "aal2" = "aal1";
  if (data.session.access_token) {
    try {
      const parts = data.session.access_token.split(".");
      if (parts.length === 3) {
        let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const claims = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
        if (claims.aal === "aal2") {
          sessionAal = "aal2";
        }
      }
    } catch {}
  }

  const { data: profProfile } = await authenticatedClient
    .from("clinician_professional_profiles")
    .select("mfa_enrolled")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const mfaEnrolled = profProfile ? profProfile.mfa_enrolled === true : false;

  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email || "",
    fullName: profile.full_name || "Clinician",
    role: profile.role,
    facilityId: profile.facility_id || null,
    supabaseToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    tokenExpiresAt: data.session.expires_at,
    aal: sessionAal,
    mfaEnrolled,
  };

  const token = signSessionToken(authUser);
  return { user: authUser, token };
}

export function parseSessionToken(token: string): AuthUser | null {
  return verifySessionToken(token);
}

export async function signOutClinician(supabaseToken?: string): Promise<void> {
  if (!supabaseToken || env.isDemoMode) return;
  const client = getSupabaseClient(supabaseToken);
  if (client) {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn("Notice: Supabase signOut failed:", err);
    }
  }
}
