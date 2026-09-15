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
  if (process.env.NODE_ENV === "production" || !env.isDemoMode || !testMockUsers) {
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

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || credentials.email,
      fullName: profile.full_name || "Clinician",
      role: profile.role,
      facilityId: profile.facility_id || null,
      supabaseToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      tokenExpiresAt: data.session?.expires_at,
    };

    const token = signSessionToken(authUser);
    return {
      user: authUser,
      token,
    };
  }

  // Offline / Unit Test Execution with injected mock users (never accessible in production)
  if (testMockUsers) {
    const mockUser = testMockUsers[credentials.email.toLowerCase().trim()];
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

  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email || "",
    fullName: profile.full_name || "Clinician",
    role: profile.role,
    facilityId: profile.facility_id || null,
    supabaseToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    tokenExpiresAt: data.session.expires_at,
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
