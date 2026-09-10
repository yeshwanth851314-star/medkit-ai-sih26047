import { env } from "@/config/env";

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
 */
export function resolveKioskCredential(request: Request): KioskCredential | null {
  // 1. Primary secure production path: HttpOnly device cookie 'medkit_kiosk_credential'
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)medkit_kiosk_credential=([^;]*)/);
    if (match) {
      try {
        const raw = decodeURIComponent(match[1]);
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

  // 2. Strict restriction: Header fallback is strictly restricted to development/test configurations
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

  // 3. In demo mode only, fallback to known demo kiosk credentials if no cookie present
  if (env.isDemoMode) {
    return {
      kioskId: "00000000-0000-0000-0000-000000000001",
      kioskSecret: "kiosk-secret-hyd-01",
      source: "test_header",
    };
  }

  return null;
}
