import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionSecret } from "./jwt";
import { authenticateApiRequest } from "./api-guard";
import { AuthUser } from "@/features/auth/types";
import { env } from "@/config/env";

export interface IntakeCapabilityPayload {
  type: "kiosk_intake";
  sessionId: string;
  patientId: string;
  facilityId?: string | null;
  consentId?: string | null;
  scope: string[];
  iat: number;
  exp: number;
}

const DEFAULT_INTAKE_EXPIRATION = 2 * 60 * 60; // 2 hours

const globalForRevocations = globalThis as unknown as {
  __medkit_revoked_capability_sessions?: Set<string>;
};

if (!globalForRevocations.__medkit_revoked_capability_sessions) {
  globalForRevocations.__medkit_revoked_capability_sessions = new Set();
}

const revokedSessions: Set<string> = globalForRevocations.__medkit_revoked_capability_sessions;

export async function revokeIntakeCapabilityToken(
  sessionId: string,
  options?: { targetStatus?: "abandoned" | "submitted" }
): Promise<void> {
  revokedSessions.add(sessionId);
  const status = options?.targetStatus || "abandoned";
  // Durably mark intake session status in persistent store
  try {
    const { updateIntakeSession } = await import("@/lib/db/supabase");
    await updateIntakeSession(sessionId, { status });
  } catch (err) {
    console.error(`Failed to durably revoke intake session ${sessionId}:`, err);
  }
}

export function isIntakeCapabilityRevoked(sessionId: string): boolean {
  return revokedSessions.has(sessionId);
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

export function signIntakeCapabilityToken(
  data: {
    sessionId: string;
    patientId: string;
    facilityId?: string | null;
    consentId?: string | null;
    scope?: string[];
  },
  expiresInSeconds: number = DEFAULT_INTAKE_EXPIRATION,
  customSecret?: string
): string {
  const secret = customSecret || getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "INTAKE_CAPABILITY" };
  const payload: IntakeCapabilityPayload = {
    type: "kiosk_intake",
    sessionId: data.sessionId,
    patientId: data.patientId,
    facilityId: data.facilityId || null,
    consentId: data.consentId || null,
    scope: data.scope || ["intake:answer", "intake:submit", "voice:transcribe", "consent:grant"],
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

export function verifyIntakeCapabilityToken(
  token: string,
  customSecret?: string
): IntakeCapabilityPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let secret: string;
  try {
    secret = customSecret || getSessionSecret();
  } catch {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());

  if (signature.length !== expectedSignature.length) return null;
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!isMatch) return null;

  try {
    const payload: IntakeCapabilityPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.type !== "kiosk_intake") return null;

    // Check if capability token was revoked upon session completion or teardown
    if (isIntakeCapabilityRevoked(payload.sessionId)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function extractIntakeToken(request: Request): string | null {
  const headerToken = request.headers.get("x-intake-token");
  if (headerToken) return headerToken.trim();

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7).trim();
    const verified = verifyIntakeCapabilityToken(candidate);
    if (verified) return candidate;
  }

  return null;
}

export async function requireIntakeOrClinicalAuth(
  request: Request,
  options?: {
    requiredScope?: string;
    targetSessionId?: string;
    targetPatientId?: string;
  }
): Promise<
  | { authorized: true; user?: AuthUser; capability?: IntakeCapabilityPayload }
  | { authorized: false; errorResponse: NextResponse }
> {
  // 1. Check if caller is authenticated clinician
  const clinicianUser = await authenticateApiRequest(request);
  if (clinicianUser) {
    return { authorized: true, user: clinicianUser };
  }

  // 2. Otherwise check for intake capability token
  const intakeToken = extractIntakeToken(request);
  if (!intakeToken) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Active clinical session or kiosk intake capability required" },
        { status: 401 }
      ),
    };
  }

  const capability = verifyIntakeCapabilityToken(intakeToken);
  if (!capability) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Invalid or expired kiosk intake capability token" },
        { status: 401 }
      ),
    };
  }

  // Validate session boundary
  if (options?.targetSessionId && capability.sessionId !== options.targetSessionId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "FORBIDDEN: Intake capability token does not match target session" },
        { status: 403 }
      ),
    };
  }

  // Validate patient boundary
  if (options?.targetPatientId && capability.patientId !== options.targetPatientId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "FORBIDDEN: Intake capability token does not match target patient" },
        { status: 403 }
      ),
    };
  }

  // Validate scope boundary
  if (options?.requiredScope && !capability.scope.includes(options.requiredScope)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: `FORBIDDEN: Intake capability token lacks required scope '${options.requiredScope}'` },
        { status: 403 }
      ),
    };
  }

  // Validate durable session in persistent store
  const { getIntakeSessionById } = await import("@/lib/db/supabase");
  const dbSession = await getIntakeSessionById(capability.sessionId);
  if (!dbSession && !env.isDemoMode) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Kiosk intake session does not exist" },
        { status: 401 }
      ),
    };
  }
  if (dbSession && (dbSession.status !== "active" || new Date(dbSession.expires_at).getTime() < Date.now())) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Kiosk intake session has expired or been terminated" },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, capability };
}
