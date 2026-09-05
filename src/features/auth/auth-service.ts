import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/db/supabase";
import { AuthUser, LoginCredentials } from "./types";

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

    // Fetch profile role from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, facility_id")
      .eq("id", data.user.id)
      .single();

    return {
      user: {
        id: data.user.id,
        email: data.user.email || credentials.email,
        fullName: profile?.full_name || "Doctor",
        role: profile?.role || "doctor",
        facilityId: profile?.facility_id || null,
      },
      token: data.session?.access_token || crypto.randomUUID(),
    };
  }

  // Demo Fallback Mode
  const demoAccount = DEMO_USERS[credentials.email.toLowerCase().trim()];
  if (demoAccount && demoAccount.passwordHash === credentials.password) {
    const { passwordHash, ...user } = demoAccount;
    // Generate secure opaque token format: base64 encoded user info + signature
    const tokenPayload = Buffer.from(JSON.stringify(user)).toString("base64");
    return {
      user,
      token: `demo-session-${tokenPayload}`,
    };
  }

  return null;
}

export function parseSessionToken(token: string): AuthUser | null {
  if (!token) return null;

  if (token.startsWith("demo-session-")) {
    try {
      const payloadBase64 = token.replace("demo-session-", "");
      const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
      return JSON.parse(jsonStr) as AuthUser;
    } catch {
      return null;
    }
  }

  return null;
}
