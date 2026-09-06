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
    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
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
    };
  } catch {
    return null;
  }
}

/**
 * Universal Web Crypto token verification for Edge Middleware and browser runtimes.
 */
export async function verifySessionTokenWeb(token: string, secret?: string): Promise<AuthUser | null> {
  if (!token || typeof token !== "string") return null;

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
    keySecret = secret || getSessionSecret();
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

    let b64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Payload.length % 4) b64Payload += "=";
    const payloadJson = atob(b64Payload);
    const parsed: JwtPayload = JSON.parse(payloadJson);

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
