import { describe, it, expect } from "vitest";
import {
  signIntakeCapabilityToken,
  verifyIntakeCapabilityToken,
  requireIntakeOrClinicalAuth,
} from "../../src/lib/auth/kiosk-capability";
import { signSessionToken } from "../../src/lib/auth/jwt";
import { AuthUser } from "../../src/features/auth/types";

describe("Phase 2: Secure Patient & Kiosk Intake Capabilities", () => {
  const sessionId = "ses-test-1001";
  const patientId = "11111111-1111-4111-8111-111111111111";

  const doctorUser: AuthUser = {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  it("generates and verifies valid cryptographic kiosk intake capability token", () => {
    const token = signIntakeCapabilityToken({
      sessionId,
      patientId,
      scope: ["intake:answer", "intake:submit", "voice:transcribe"],
    });

    expect(token).toBeDefined();
    expect(token.split(".").length).toBe(3);

    const capability = verifyIntakeCapabilityToken(token);
    expect(capability).not.toBeNull();
    expect(capability?.type).toBe("kiosk_intake");
    expect(capability?.sessionId).toBe(sessionId);
    expect(capability?.patientId).toBe(patientId);
    expect(capability?.scope).toContain("intake:answer");
    expect(capability?.scope).toContain("voice:transcribe");
  });

  it("rejects forged or tampered intake capability tokens", () => {
    const validToken = signIntakeCapabilityToken({ sessionId, patientId });
    const parts = validToken.split(".");

    const tamperedPayload = Buffer.from(
      JSON.stringify({ type: "kiosk_intake", sessionId: "ses-hacked", patientId, exp: Date.now() + 10000 })
    ).toString("base64url");

    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const verified = verifyIntakeCapabilityToken(forgedToken);
    expect(verified).toBeNull();
  });

  it("rejects expired intake capability tokens strictly", () => {
    const expiredToken = signIntakeCapabilityToken({ sessionId, patientId }, -60);
    const verified = verifyIntakeCapabilityToken(expiredToken);
    expect(verified).toBeNull();
  });

  it("permits intake operations when valid intake capability token is presented in x-intake-token", async () => {
    const token = signIntakeCapabilityToken({ sessionId, patientId, scope: ["intake:answer"] });
    const req = new Request("http://localhost:3000/api/interviews/ses-test-1001/answer", {
      headers: {
        "x-intake-token": token,
      },
    });

    const result = await requireIntakeOrClinicalAuth(req, {
      requiredScope: "intake:answer",
      targetSessionId: sessionId,
    });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.capability?.sessionId).toBe(sessionId);
    }
  });

  it("permits intake operations when authenticated clinician session is presented", async () => {
    const clinicianToken = signSessionToken(doctorUser);
    const req = new Request("http://localhost:3000/api/interviews/ses-test-1001/answer", {
      headers: {
        Authorization: `Bearer ${clinicianToken}`,
      },
    });

    const result = await requireIntakeOrClinicalAuth(req, {
      requiredScope: "intake:answer",
      targetSessionId: sessionId,
    });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user?.role).toBe("doctor");
    }
  });

  it("rejects request with 401 when neither clinician auth nor intake token is provided", async () => {
    const req = new Request("http://localhost:3000/api/voice/transcribe");
    const result = await requireIntakeOrClinicalAuth(req, {
      requiredScope: "voice:transcribe",
    });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.errorResponse.status).toBe(401);
    }
  });

  it("rejects request with 403 when intake capability lacks required scope", async () => {
    // Token has only answer scope, missing voice:transcribe
    const token = signIntakeCapabilityToken({ sessionId, patientId, scope: ["intake:answer"] });
    const req = new Request("http://localhost:3000/api/voice/transcribe", {
      headers: {
        "x-intake-token": token,
      },
    });

    const result = await requireIntakeOrClinicalAuth(req, {
      requiredScope: "voice:transcribe",
    });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.errorResponse.status).toBe(403);
    }
  });

  it("rejects request with 403 when intake capability session does not match target session", async () => {
    const token = signIntakeCapabilityToken({ sessionId: "ses-other", patientId });
    const req = new Request("http://localhost:3000/api/interviews/ses-test-1001/answer", {
      headers: {
        "x-intake-token": token,
      },
    });

    const result = await requireIntakeOrClinicalAuth(req, {
      requiredScope: "intake:answer",
      targetSessionId: sessionId, // Expected ses-test-1001
    });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.errorResponse.status).toBe(403);
    }
  });

  it("prevents kiosk token from accessing clinician-only doctor routes", async () => {
    const { verifySessionToken } = await import("../../src/lib/auth/jwt");
    const kioskToken = signIntakeCapabilityToken({ sessionId, patientId });

    // verifySessionToken strictly parses clinical session JWTs, not intake capabilities
    const sessionResult = verifySessionToken(kioskToken);
    expect(sessionResult).toBeNull();
  });
});
