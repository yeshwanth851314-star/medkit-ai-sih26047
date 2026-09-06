import { describe, it, expect, vi } from "vitest";
import { signSessionToken, verifySessionToken } from "../../src/lib/auth/jwt";
import { signIntakeCapabilityToken, verifyIntakeCapabilityToken } from "../../src/lib/auth/kiosk-capability";
import { requireApiAuth } from "../../src/lib/auth/api-guard";
import { requirePatientAccess, requireCaseAccess } from "../../src/lib/auth/object-guard";
import { AuthUser } from "../../src/features/auth/types";

describe("Phase 12: Rigorous Security Negative & Fail-Closed Tests", () => {
  const doctorHyd: AuthUser = {
    id: "usr-doc-hyd",
    email: "doctor.hyd@medkit.ai",
    fullName: "Dr. Ananya Rao",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const staffHyd: AuthUser = {
    id: "usr-stf-hyd",
    email: "nurse.hyd@medkit.ai",
    fullName: "Kiran Staff",
    role: "staff",
    facilityId: "fac-hyd-01",
  };

  const doctorBlr: AuthUser = {
    id: "usr-doc-blr",
    email: "doctor.blr@medkit.ai",
    fullName: "Dr. Vikram Joshi",
    role: "doctor",
    facilityId: "fac-blr-02",
  };

  describe("1. HMAC Token Tampering & Expiry Defense", () => {
    it("rejects token when header is altered", () => {
      const validToken = signSessionToken(doctorHyd);
      const parts = validToken.split(".");
      const alteredHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const tampered = `${alteredHeader}.${parts[1]}.${parts[2]}`;

      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("rejects token when payload claims (such as role) are modified", () => {
      const validToken = signSessionToken(staffHyd);
      const parts = validToken.split(".");
      const decodedPayload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      decodedPayload.role = "doctor"; // Privilege escalation attempt
      const forgedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
      const tampered = `${parts[0]}.${forgedPayload}.${parts[2]}`;

      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("rejects token with corrupted signature bytes", () => {
      const validToken = signSessionToken(doctorHyd);
      const parts = validToken.split(".");
      const corruptedSig = parts[2].substring(0, parts[2].length - 4) + "XXXX";
      const tampered = `${parts[0]}.${parts[1]}.${corruptedSig}`;

      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("rejects expired clinical tokens strictly", () => {
      const expiredToken = signSessionToken(doctorHyd, -10); // Expired 10 seconds ago
      expect(verifySessionToken(expiredToken)).toBeNull();
    });
  });

  describe("2. Kiosk Capability Token Isolation & Privilege Separation", () => {
    it("prevents kiosk token from masquerading as a clinician session token", () => {
      const kioskToken = signIntakeCapabilityToken({
        sessionId: "ses-test-1001",
        patientId: "pat-12345",
        scope: ["record_voice", "answer_interview", "upload_document"],
      });

      // Verification via session token verifier must fail
      const sessionAttempt = verifySessionToken(kioskToken);
      expect(sessionAttempt).toBeNull();
    });

    it("rejects expired kiosk capability token", () => {
      const expiredKiosk = signIntakeCapabilityToken(
        {
          sessionId: "ses-test-1001",
          patientId: "pat-12345",
          scope: ["record_voice"],
        },
        -50
      );

      expect(verifyIntakeCapabilityToken(expiredKiosk)).toBeNull();
    });

    it("rejects kiosk token when required capability is missing", () => {
      const restrictedKiosk = signIntakeCapabilityToken({
        sessionId: "ses-test-1001",
        patientId: "pat-12345",
        scope: ["record_voice"],
      });

      const verifiedWithRequired = verifyIntakeCapabilityToken(restrictedKiosk, "answer_interview");
      expect(verifiedWithRequired).toBeNull();
    });
  });

  describe("3. Object-Level Cross-Facility Authorization Rejections", () => {
    it("blocks clinician from facility A accessing patient restricted to facility B with 403", async () => {
      // Patient 11111111-1111-4111-8111-111111111111 is in fac-hyd-01
      const crossFacilityResult = await requirePatientAccess(
        doctorBlr, // Dr. Vikram Joshi from Bangalore facility
        "11111111-1111-4111-8111-111111111111"
      );

      expect(crossFacilityResult.authorized).toBe(false);
      if (!crossFacilityResult.authorized) {
        expect(crossFacilityResult.errorResponse.status).toBe(403);
      }
    });

    it("returns 404 when patient ID does not exist in any facility", async () => {
      const missingResult = await requirePatientAccess(
        doctorHyd,
        "00000000-0000-0000-0000-000000000000"
      );

      expect(missingResult.authorized).toBe(false);
      if (!missingResult.authorized) {
        expect(missingResult.errorResponse.status).toBe(404);
      }
    });
  });

  describe("4. Route-Level Role Guards & Case Finalization Invariant", () => {
    it("rejects unauthenticated request to requireApiAuth with 401", async () => {
      const unauthReq = new Request("http://localhost:3000/api/cases/c111/summary", {
        method: "POST",
      });
      const auth = await requireApiAuth(unauthReq);

      expect("errorResponse" in auth).toBe(true);
      if ("errorResponse" in auth) {
        expect(auth.errorResponse.status).toBe(401);
      }
    });

    it("rejects staff (nurse) attempting doctor-only clinical actions with 403", async () => {
      const staffToken = signSessionToken(staffHyd);
      const req = new Request("http://localhost:3000/api/cases/c111/summary", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });

      const auth = await requireApiAuth(req, { allowedRoles: ["doctor", "clinician"] });
      expect("errorResponse" in auth).toBe(true);
      if ("errorResponse" in auth) {
        expect(auth.errorResponse.status).toBe(403);
      }
    });
  });

  describe("5. Clinical Audio Safety: Refusal of Synthetic Fallback on Real Audio", () => {
    it("fails closed on real patient audio failure and never returns synthetic demo text", async () => {
      const { ResilientSpeechProvider, DeterministicDemoSpeechProvider } = await import(
        "../../src/features/voice/speech-provider"
      );

      const failingPrimary = {
        name: "gemini-audio" as const,
        transcribe: vi.fn().mockRejectedValue(new Error("Downstream STT network timeout")),
      };

      const fallback = new DeterministicDemoSpeechProvider();
      const resilient = new ResilientSpeechProvider(failingPrimary, fallback, 1000);

      const realAudioBytes = Buffer.alloc(500, "a").toString("base64"); // 500 bytes real audio

      await expect(
        resilient.transcribe({
          audioBase64: realAudioBytes,
          mimeType: "audio/webm",
          language: "te",
        })
      ).rejects.toThrow(/live audio cannot fall back to synthetic text/i);
    });

    it("permits deterministic fallback strictly in simulation mode when no real audio is present", async () => {
      const { ResilientSpeechProvider, DeterministicDemoSpeechProvider } = await import(
        "../../src/features/voice/speech-provider"
      );

      const failingPrimary = {
        name: "gemini-audio" as const,
        transcribe: vi.fn().mockRejectedValue(new Error("Temporary network timeout")),
      };

      const fallback = new DeterministicDemoSpeechProvider();
      const resilient = new ResilientSpeechProvider(failingPrimary, fallback, 1000);

      // Simulation mode without audioBase64 - triggers primary error and resilient fallback
      const result = await resilient.transcribe({
        language: "en",
      });

      expect(result).toBeDefined();
      expect(result.providerMeta.fallbackUsed).toBe(true);
      expect(result.providerMeta.provider).toBe("deterministic-demo");
    });
  });

  describe("6. Edge Cases & Request Input Validation", () => {
    it("rejects empty or whitespace patient identifier with 400", async () => {
      const result = await requirePatientAccess(doctorHyd, "   ");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.errorResponse.status).toBe(400);
      }
    });

    it("rejects empty or whitespace case identifier with 400", async () => {
      const result = await requireCaseAccess(doctorHyd, "");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.errorResponse.status).toBe(400);
      }
    });

    it("rejects empty or whitespace document identifier with 400", async () => {
      const { requireDocumentAccess } = await import("../../src/lib/auth/object-guard");
      const result = await requireDocumentAccess(doctorHyd, " ");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.errorResponse.status).toBe(400);
      }
    });
  });
});
