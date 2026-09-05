import crypto from "crypto";
import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "medkit-clinical-defense-session-secret-sih26047-key";

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

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
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
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS
): string {
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

  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest("binary"));

  return `${signatureInput}.${signature}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) {
    // Check for legacy demo token format for graceful transition
    if (token.startsWith("demo-session-")) {
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
    }
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verify HMAC signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest("binary"));

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
