import crypto from "crypto";
import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

let testSessionSecret: string | null = null;

export function setSessionSecretForTesting(secret: string | null): void {
  testSessionSecret = secret;
}

export function getSessionSecret(): string {
  if (testSessionSecret) return testSessionSecret;
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is required");
  }
  return value;
}

const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function signSessionToken(
  user: AuthUser,
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS,
  customSecret?: string
): string {
  const secret = customSecret || getSessionSecret();
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

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest());

  return `${signatureInput}.${signature}`;
}

export function verifySessionToken(token: string, customSecret?: string): AuthUser | null {
  if (!token || typeof token !== "string") return null;

  // Strict gating on legacy demo token: NEVER accepted in production
  if (token.startsWith("demo-session-")) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.APP_MODE === "production";
    const isDemoMode = process.env.APP_MODE === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (isProduction || !isDemoMode) {
      return null;
    }
    try {
      const payloadBase64 = token.replace("demo-session-", "");
      const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
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
  if (parts.length !== 3) {
    return null;
  }

  let secret: string;
  try {
    secret = customSecret || getSessionSecret();
  } catch {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verify HMAC signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return null;
  }
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isMatch) return null;

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.typ !== "JWT") {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.sub || !payload.role) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      facilityId: payload.facilityId || null,
      supabaseToken: payload.supabaseToken,
      refreshToken: payload.refreshToken,
      tokenExpiresAt: payload.tokenExpiresAt,
      aal: payload.aal || "aal1",
      mfaEnrolled: payload.mfaEnrolled ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Universal Web Crypto token verification for Edge Middleware and browser runtimes.
 */
export { verifySessionTokenWeb } from "./jwt-web";
