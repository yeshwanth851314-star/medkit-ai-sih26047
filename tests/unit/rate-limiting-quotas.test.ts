import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "../../src/lib/security/rate-limiter";
import { POST as postVoiceTranscribe } from "../../src/app/api/voice/transcribe/route";
import { POST as postDocExtract } from "../../src/app/api/documents/[id]/extract/route";
import { POST as postCaseSummary } from "../../src/app/api/cases/[id]/summary/route";
import { signSessionToken } from "../../src/lib/auth/jwt";
import { signIntakeCapabilityToken } from "../../src/lib/auth/kiosk-capability";
import { AuthUser } from "../../src/features/auth/types";

describe("Phase 4: Request Abuse & Quota Protection", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  const doctorUser: AuthUser = {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const doctorToken = signSessionToken(doctorUser);
  const intakeToken = signIntakeCapabilityToken({
    sessionId: "ses-quota-100",
    patientId: "11111111-1111-4111-8111-111111111111",
    scope: ["voice:transcribe"],
  });

  describe("Sliding Window Rate Limiter Engine", () => {
    it("permits requests under the limit and tracks remaining requests", () => {
      const key = "test-client-1";
      const opts = { windowMs: 1000, maxRequests: 3 };

      const r1 = checkRateLimit(key, opts);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(key, opts);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(key, opts);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      const r4 = checkRateLimit(key, opts);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });
  });

  describe("POST /api/voice/transcribe Quota & Abuse Protections", () => {
    it("rejects unsupported audio MIME type with 415", async () => {
      const req = new Request("http://localhost:3000/api/voice/transcribe", {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mimeType: "application/x-malicious-binary",
          audioBase64: "dGVzdA==",
        }),
      });

      const res = await postVoiceTranscribe(req);
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.error).toContain("Unsupported audio MIME type");
    });

    it("rejects oversized audio payload exceeding 10MB limit with 413", async () => {
      // 10MB base64 is ~13.3 million chars. Create a mock large string
      const oversizedBase64 = "A".repeat(15 * 1024 * 1024);
      const req = new Request("http://localhost:3000/api/voice/transcribe", {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mimeType: "audio/webm",
          audioBase64: oversizedBase64,
        }),
      });

      const res = await postVoiceTranscribe(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toContain("exceeds");
    });

    it("enforces rate limiting when requests exceed max quota", async () => {
      const makeReq = () =>
        new Request("http://localhost:3000/api/voice/transcribe", {
          method: "POST",
          headers: {
            "x-intake-token": intakeToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mockId: "sample_cardiac_en",
          }),
        });

      // Max is 30 in a minute. Loop 30 allowed requests
      for (let i = 0; i < 30; i++) {
        const res = await postVoiceTranscribe(makeReq());
        expect(res.status).toBe(200);
      }

      // 31st request should be rejected with 429
      const throttledRes = await postVoiceTranscribe(makeReq());
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.headers.get("Retry-After")).toBeDefined();
    });
  });

  describe("POST /api/documents/[id]/extract Quota & Abuse Protections", () => {
    it("rejects unsupported document MIME type with 415", async () => {
      const req = new Request("http://localhost:3000/api/documents/doc-0001/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mimeType: "application/zip",
          imageBase64: "dGVzdA==",
        }),
      });

      const res = await postDocExtract(req, {
        params: Promise.resolve({ id: "doc-0001" }),
      });
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.error).toContain("Unsupported document MIME type");
    });

    it("rejects oversized document payload exceeding 15MB with 413", async () => {
      const oversizedBase64 = "B".repeat(22 * 1024 * 1024);
      const req = new Request("http://localhost:3000/api/documents/doc-0001/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mimeType: "image/jpeg",
          imageBase64: oversizedBase64,
        }),
      });

      const res = await postDocExtract(req, {
        params: Promise.resolve({ id: "doc-0001" }),
      });
      expect(res.status).toBe(413);
    });

    it("enforces rate limiting when extraction quota is exceeded", async () => {
      const makeReq = () =>
        new Request("http://localhost:3000/api/documents/doc-0001/extract", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${doctorToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mockId: "doc-0001",
          }),
        });

      // Max is 20 per minute
      for (let i = 0; i < 20; i++) {
        const res = await postDocExtract(makeReq(), {
          params: Promise.resolve({ id: "doc-0001" }),
        });
        expect(res.status).toBe(200);
      }

      // 21st should return 429
      const throttledRes = await postDocExtract(makeReq(), {
        params: Promise.resolve({ id: "doc-0001" }),
      });
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.headers.get("Retry-After")).toBeDefined();
    });
  });

  describe("POST /api/cases/[id]/summary Quota & Abuse Protections", () => {
    it("enforces rate limiting on repeated summary generation requests", async () => {
      const caseId = "c1111111-1111-4111-8111-111111111111";
      const makeReq = () =>
        new Request(`http://localhost:3000/api/cases/${caseId}/summary`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${doctorToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "deterministic",
          }),
        });

      // Max is 15 generation requests per minute
      for (let i = 0; i < 15; i++) {
        const res = await postCaseSummary(makeReq(), {
          params: Promise.resolve({ id: caseId }),
        });
        expect(res.status).toBe(200);
      }

      // 16th should return 429
      const throttledRes = await postCaseSummary(makeReq(), {
        params: Promise.resolve({ id: caseId }),
      });
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.headers.get("Retry-After")).toBeDefined();
    });
  });
});
