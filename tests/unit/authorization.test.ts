import { describe, it, expect } from "vitest";
import { signSessionToken, verifySessionToken } from "../../src/lib/auth/jwt";
import { requireApiAuth, extractBearerOrCookieToken } from "../../src/lib/auth/api-guard";
import { AuthUser } from "../../src/features/auth/types";
import { SESSION_COOKIE_NAME } from "../../src/lib/auth/session";

describe("Phase 1: API & Session Authorization Security Invariants", () => {
  const doctorUser: AuthUser = {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const staffUser: AuthUser = {
    id: "usr-stf-0001",
    email: "staff@medkit.ai",
    fullName: "Kiran Reddy (Triage Nurse)",
    role: "staff",
    facilityId: "fac-hyd-01",
  };

  describe("HMAC-SHA256 Token Signing & Timing-Safe Verification", () => {
    it("signs and verifies valid clinical session token", () => {
      const token = signSessionToken(doctorUser);
      expect(token).toBeDefined();
      expect(token.split(".").length).toBe(3);

      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(doctorUser.id);
      expect(verified?.email).toBe(doctorUser.email);
      expect(verified?.role).toBe("doctor");
    });

    it("rejects forged or tampered token signatures", () => {
      const validToken = signSessionToken(doctorUser);
      const parts = validToken.split(".");
      
      // Tamper with payload (middle segment)
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "hacker", role: "admin", exp: Date.now() + 100000 })
      ).toString("base64url");
      
      const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });

    it("rejects tokens with forged signature component", () => {
      const validToken = signSessionToken(doctorUser);
      const parts = validToken.split(".");
      const forgedToken = `${parts[0]}.${parts[1]}.invalidsignature12345`;
      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });

    it("rejects expired tokens strictly", () => {
      // Create token with negative expiresIn
      const expiredToken = signSessionToken(doctorUser, -3600);
      const verified = verifySessionToken(expiredToken);
      expect(verified).toBeNull();
    });
  });

  describe("Token Extraction from Headers and Cookies", () => {
    it("extracts token from Authorization Bearer header", () => {
      const token = signSessionToken(doctorUser);
      const req = new Request("http://localhost:3000/api/cases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const extracted = extractBearerOrCookieToken(req);
      expect(extracted).toBe(token);
    });

    it("extracts token from session cookie", () => {
      const token = signSessionToken(doctorUser);
      const req = new Request("http://localhost:3000/api/cases", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${token}; other_cookie=123`,
        },
      });

      const extracted = extractBearerOrCookieToken(req);
      expect(extracted).toBe(token);
    });

    it("returns null when no token is present", () => {
      const req = new Request("http://localhost:3000/api/cases");
      const extracted = extractBearerOrCookieToken(req);
      expect(extracted).toBeNull();
    });
  });

  describe("Server-Side API Guard & Role Enforcement", () => {
    it("returns 401 Unauthorized when token is missing", async () => {
      const req = new Request("http://localhost:3000/api/cases");
      const result = await requireApiAuth(req);

      expect("errorResponse" in result).toBe(true);
      if ("errorResponse" in result) {
        expect(result.errorResponse.status).toBe(401);
      }
    });

    it("returns 401 Unauthorized when token is forged or invalid", async () => {
      const req = new Request("http://localhost:3000/api/cases", {
        headers: {
          Authorization: "Bearer invalid.fake.token",
        },
      });
      const result = await requireApiAuth(req);

      expect("errorResponse" in result).toBe(true);
      if ("errorResponse" in result) {
        expect(result.errorResponse.status).toBe(401);
      }
    });

    it("allows authorized doctor for general clinical endpoint", async () => {
      const token = signSessionToken(doctorUser);
      const req = new Request("http://localhost:3000/api/cases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await requireApiAuth(req, {
        allowedRoles: ["doctor", "clinician", "staff"],
      });

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.id).toBe(doctorUser.id);
        expect(result.user.role).toBe("doctor");
      }
    });

    it("enforces role restriction: rejects staff on doctor-only clinical actions with 403", async () => {
      const staffToken = signSessionToken(staffUser);
      const req = new Request("http://localhost:3000/api/cases/case-123/summary", {
        headers: {
          Authorization: `Bearer ${staffToken}`,
        },
      });

      // Endpoint requiring doctor or clinician only (e.g. final summary approval or red flag acknowledgement)
      const result = await requireApiAuth(req, {
        allowedRoles: ["doctor", "clinician"],
      });

      expect("errorResponse" in result).toBe(true);
      if ("errorResponse" in result) {
        expect(result.errorResponse.status).toBe(403);
      }
    });

    it("permits staff on triage endpoints", async () => {
      const staffToken = signSessionToken(staffUser);
      const req = new Request("http://localhost:3000/api/patients", {
        headers: {
          Authorization: `Bearer ${staffToken}`,
        },
      });

      const result = await requireApiAuth(req, {
        allowedRoles: ["doctor", "clinician", "staff"],
      });

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.role).toBe("staff");
      }
    });
  });
});
