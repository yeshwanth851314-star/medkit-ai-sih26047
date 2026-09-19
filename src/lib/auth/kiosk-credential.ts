import { env } from "@/config/env";
import { DEMO_KIOSK_ID, DEMO_KIOSK_SECRET, DEMO_PATIENT_ID } from "@/lib/auth/demo-users";

export interface KioskCredential {
  kioskId: string;
  kioskSecret: string;
  source: "cookie" | "test_header";
}

/**
 * Centralized server-only resolver for kiosk device credentials.
 * Extracts the trusted kiosk identity and secret from the HttpOnly device cookie.
 * Never exposes the raw kiosk secret to patient-side browser JavaScript.
 * In production, strictly rejects any attempt to pass credentials via headers or request body.
 *
 * @param allowDemoTokenFallback - When true, peeks at the incoming intake JWT to return demo
 *   kiosk credentials when the token carries DEMO_PATIENT_ID. Only enable this on routes where
 *   the kiosk demo experience must work in production without provisioned device cookies
 *   (e.g. answer and submit routes). Do NOT enable on the logout route.
 */
export function resolveKioskCredential(
  request: Request,
  options?: { allowDemoTokenFallback?: boolean }
): KioskCredential | null {
  // 1. Primary secure production path: HttpOnly device cookie 'medkit_kiosk_credential'
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)medkit_kiosk_credential=([^;]*)/);
    if (match) {
      try {
        let raw = decodeURIComponent(match[1]);
        if (raw.startsWith("%")) {
          try {
            raw = decodeURIComponent(raw);
          } catch {}
        }
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.kioskId === "string" &&
          typeof parsed.kioskSecret === "string" &&
          parsed.kioskId.trim().length > 0 &&
          parsed.kioskSecret.trim().length > 0
        ) {
          return {
            kioskId: parsed.kioskId.trim(),
            kioskSecret: parsed.kioskSecret.trim(),
            source: "cookie",
          };
        }
      } catch {
        // Cookie malformed or corrupted — reject
        return null;
      }
    }
  }

  // 2. Header fallback is strictly restricted to development/test configurations
  if (process.env.NODE_ENV !== "production" || env.isDemoMode) {
    const headerKioskId = request.headers.get("x-kiosk-id");
    const headerKioskSecret = request.headers.get("x-kiosk-secret");
    if (headerKioskId && headerKioskSecret) {
      return {
        kioskId: headerKioskId.trim(),
        kioskSecret: headerKioskSecret.trim(),
        source: "test_header",
      };
    }
  }

  // 3. Demo/dev automatic fallback — also handles DEMO_PATIENT_ID intake tokens in production
  //    by peeking at the Bearer/intake-token JWT before giving up.
  //    This allows the kiosk demo to work on Vercel without provisioned device cookies.
  //    ONLY enabled when the caller opts in via allowDemoTokenFallback (e.g. answer/submit routes).
  //    The logout route must NOT opt in — it has its own stricter security guard.
  if (options?.allowDemoTokenFallback) {
    const intakeToken =
      request.headers.get("x-intake-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;

    if (intakeToken) {
      try {
        const parts = intakeToken.split(".");
        if (parts.length === 3) {
          const payloadStr = Buffer.from(parts[1], "base64url").toString("utf-8");
          const payload = JSON.parse(payloadStr);
          if (
            payload &&
            payload.type === "kiosk_intake" &&
            payload.patientId === DEMO_PATIENT_ID
          ) {
            // Demo patient kiosk token — resolve to well-known demo kiosk credential
            return {
              kioskId: DEMO_KIOSK_ID,
              kioskSecret: DEMO_KIOSK_SECRET,
              source: "cookie", // treated as if provisioned
            };
          }
        }
      } catch {
        // malformed token — fall through
      }
    }
  }

  // 4. Demo mode auto-credential (isDemoMode only — does NOT fire in test/CI)
  if (env.isDemoMode) {
    return {
      kioskId: DEMO_KIOSK_ID,
      kioskSecret: DEMO_KIOSK_SECRET,
      source: "test_header",
    };
  }

  return null;
}


