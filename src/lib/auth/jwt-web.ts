import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

export const SESSION_COOKIE_NAME = "medkit_session_token";

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  facilityId?: string | null;
  supabaseToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  aal?: "aal1" | "aal2";
  mfaEnrolled?: boolean;
  iat: number;
  exp: number;
}

function getWebSessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is required");
  }
  return value;
}

/**
 * Edge-compatible JWT verification using standard WebCrypto (crypto.subtle)
 * Zero Node.js dependencies — safe for Edge Middleware and browser environments.
 */
export async function verifySessionTokenWeb(token: string, secret?: string): Promise<AuthUser | null> {
  if (!token || typeof token !== "string") return null;

  // Reject legacy demo tokens in production
  if (token.startsWith("demo-session-")) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.APP_MODE === "production";
    const isDemoMode = process.env.APP_MODE === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (isProduction || !isDemoMode) return null;
    try {
      const payloadBase64 = token.replace("demo-session-", "");
      let b64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const jsonStr = atob(b64);
      const parsed = JSON.parse(jsonStr);
      if (parsed.id && parsed.email && parsed.role) {
        return {
          id: parsed.id,
          email: parsed.email,
          fullName: parsed.fullName || "Clinical Staff",
          role: parsed.role,
          facilityId: parsed.facilityId || null,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let keySecret: string;
  try {
    keySecret = secret || getWebSessionSecret();
  } catch {
    return null;
  }

  const [encodedHeader, encodedPayload, sig] = parts;
  try {
    const enc = new TextEncoder();
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let b64Sig = sig.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Sig.length % 4) b64Sig += "=";
    const rawSig = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));
    const data = enc.encode(`${encodedHeader}.${encodedPayload}`);

    const isValid = await globalThis.crypto.subtle.verify("HMAC", cryptoKey, rawSig, data);
    if (!isValid) return null;

    let b64Header = encodedHeader.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Header.length % 4) b64Header += "=";
    const header = JSON.parse(atob(b64Header));
    if (header.typ !== "JWT") return null;

    let b64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Payload.length % 4) b64Payload += "=";
    const payloadJson = atob(b64Payload);
    const parsed: JwtPayload = JSON.parse(payloadJson);
    if (!parsed.sub || !parsed.role) return null;

    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < now) return null;

    return {
      id: parsed.sub,
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role,
      facilityId: parsed.facilityId || null,
      supabaseToken: parsed.supabaseToken,
      refreshToken: parsed.refreshToken,
      tokenExpiresAt: parsed.tokenExpiresAt,
      aal: parsed.aal || "aal1",
      mfaEnrolled: parsed.mfaEnrolled ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Edge-compatible signing using standard WebCrypto (crypto.subtle).
 */
export async function signSessionTokenWeb(
  user: AuthUser,
  expiresInSeconds: number = 7 * 24 * 60 * 60,
  customSecret?: string
): Promise<string> {
  const secret = customSecret || getWebSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    facilityId: user.facilityId || null,
    supabaseToken: user.supabaseToken,
    refreshToken: user.refreshToken,
    tokenExpiresAt: user.tokenExpiresAt,
    aal: user.aal !== undefined ? user.aal : "aal2",
    mfaEnrolled: user.mfaEnrolled ?? (user.aal === "aal1" ? true : false),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const enc = new TextEncoder();
  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const b64Payload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = `${b64Header}.${b64Payload}`;

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${b64Sig}`;
}

/**
 * Inspect session token state and detect expiration or near-expiration.
 */
export async function inspectSessionTokenWeb(
  token: string,
  secret?: string
): Promise<{
  valid: boolean;
  user: AuthUser | null;
  isExpired: boolean;
  willExpireSoon: boolean;
  refreshToken?: string;
}> {
  if (!token || typeof token !== "string") {
    return { valid: false, user: null, isExpired: false, willExpireSoon: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, user: null, isExpired: false, willExpireSoon: false };
  }

  let keySecret: string;
  try {
    keySecret = secret || getWebSessionSecret();
  } catch {
    return { valid: false, user: null, isExpired: false, willExpireSoon: false };
  }

  const [encodedHeader, encodedPayload, sig] = parts;
  try {
    const enc = new TextEncoder();
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let b64Sig = sig.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Sig.length % 4) b64Sig += "=";
    const rawSig = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));
    const data = enc.encode(`${encodedHeader}.${encodedPayload}`);

    const isValid = await globalThis.crypto.subtle.verify("HMAC", cryptoKey, rawSig, data);
    if (!isValid) {
      return { valid: false, user: null, isExpired: false, willExpireSoon: false };
    }

    let b64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Payload.length % 4) b64Payload += "=";
    const payloadJson = atob(b64Payload);
    const parsed: JwtPayload = JSON.parse(payloadJson);

    if (!parsed.sub || !parsed.role) {
      return { valid: false, user: null, isExpired: false, willExpireSoon: false };
    }

    const now = Math.floor(Date.now() / 1000);
    // Align expiration check strictly with embedded Supabase tokenExpiresAt
    const effectiveExp = parsed.tokenExpiresAt
      ? Math.min(parsed.exp, parsed.tokenExpiresAt)
      : parsed.exp;
    const isExpired = Boolean(effectiveExp && effectiveExp <= now);
    const willExpireSoon = Boolean(effectiveExp && effectiveExp - now < 300);

    const user: AuthUser = {
      id: parsed.sub,
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role,
      facilityId: parsed.facilityId || null,
      supabaseToken: parsed.supabaseToken,
      refreshToken: parsed.refreshToken,
      tokenExpiresAt: parsed.tokenExpiresAt,
    };

    return {
      valid: true,
      user,
      isExpired,
      willExpireSoon,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return { valid: false, user: null, isExpired: false, willExpireSoon: false };
  }
}

/**
 * Edge-compatible Supabase session refresh via standard Fetch API.
 */
export async function refreshClinicianSessionWeb(
  refreshToken: string
): Promise<{ user: AuthUser; token: string } | null> {
  const isDemo = process.env.APP_MODE === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (isDemo || !refreshToken) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || supabaseUrl.includes("your-project.supabase.co")) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      return null;
    }

    const authData = await res.json();
    if (!authData.access_token || !authData.user) {
      return null;
    }

    // Verify active clinician profile
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${authData.user.id}&select=full_name,role,facility_id,is_active`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${authData.access_token}`,
        },
      }
    );

    if (!profileRes.ok) {
      return null;
    }

    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    if (
      !profile ||
      !profile.role ||
      profile.is_active !== true ||
      !["doctor", "clinician", "staff", "admin"].includes(profile.role)
    ) {
      return null;
    }

    const refreshedUser: AuthUser = {
      id: authData.user.id,
      email: authData.user.email || "",
      fullName: profile.full_name || "Clinician",
      role: profile.role,
      facilityId: profile.facility_id || null,
      supabaseToken: authData.access_token,
      refreshToken: authData.refresh_token,
      tokenExpiresAt: authData.expires_at,
    };

    const newSessionToken = await signSessionTokenWeb(refreshedUser);
    return { user: refreshedUser, token: newSessionToken };
  } catch (err) {
    console.error("Notice: Edge session refresh exception:", err);
    return null;
  }
}
