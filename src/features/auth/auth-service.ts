import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/db/supabase";
import { AuthUser, LoginCredentials } from "./types";

import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

// Known synthetic demo clinical users for reliable hackathon presentation
export const DEMO_USERS: Record<string, AuthUser & { passwordHash: string }> = {
  "doctor@medkit.ai": {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
    passwordHash: "doctor123",
  },
  "ayush@medkit.ai": {
    id: "usr-doc-0002",
    email: "ayush@medkit.ai",
    fullName: "Vaidya Rajesh Sharma, BAMS",
    role: "doctor",
    facilityId: "fac-hyd-01",
    passwordHash: "doctor123",
  },
  "staff@medkit.ai": {
    id: "usr-stf-0001",
    email: "staff@medkit.ai",
    fullName: "Kiran Reddy (Triage Nurse)",
    role: "staff",
    facilityId: "fac-hyd-01",
    passwordHash: "staff123",
  },
};

export async function authenticateClinician(credentials: LoginCredentials): Promise<{ user: AuthUser; token: string } | null> {
  const supabase = getSupabaseClient();

  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error || !data.user) {
      return null;
    }

    // Fetch profile role from profiles table using request-bound client with user access token
    const authenticatedClient = getSupabaseClient(data.session?.access_token) || supabase;
    const { data: profile } = await authenticatedClient
      .from("profiles")
      .select("full_name, role, facility_id")
      .eq("id", data.user.id)
      .single();

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || credentials.email,
      fullName: profile?.full_name || "Doctor",
      role: profile?.role || "doctor",
      facilityId: profile?.facility_id || null,
    };

    const token = signSessionToken(authUser);
    return {
      user: authUser,
      token,
    };
  }

  // Demo Fallback Mode
  const demoAccount = DEMO_USERS[credentials.email.toLowerCase().trim()];
  if (demoAccount && demoAccount.passwordHash === credentials.password) {
    const { passwordHash, ...user } = demoAccount;
    const token = signSessionToken(user);
    return {
      user,
      token,
    };
  }

  return null;
}

export function parseSessionToken(token: string): AuthUser | null {
  return verifySessionToken(token);
}
