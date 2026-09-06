import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

export const SESSION_COOKIE_NAME = "medkit_session_token";

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  facilityId?: string | null;
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
    };
  } catch {
    return null;
  }
}
