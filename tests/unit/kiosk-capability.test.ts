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

  it("extracts and validates kiosk credentials strictly from HttpOnly cookie via resolveKioskCredential", async () => {
    const { resolveKioskCredential } = await import("../../src/lib/auth/kiosk-credential");
    const secret = "f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8";
    const kioskId = "kiosk-unit-001";
    const cookieVal = encodeURIComponent(JSON.stringify({ kioskId, kioskSecret: secret }));

    const reqWithCookie = new Request("http://localhost:3000/api/interviews/ses-test-1001/submit", {
      headers: {
        Cookie: `medkit_kiosk_credential=${cookieVal}`,
      },
    });

    const cred = resolveKioskCredential(reqWithCookie);
    expect(cred).not.toBeNull();
    expect(cred?.kioskId).toBe(kioskId);
    expect(cred?.kioskSecret).toBe(secret);
    expect(cred?.source).toBe("cookie");

    // Rejects tampered/malformed cookie
    const reqTampered = new Request("http://localhost:3000/api/interviews/ses-test-1001/submit", {
      headers: {
        Cookie: `medkit_kiosk_credential=malformed-json-here`,
      },
    });
    expect(resolveKioskCredential(reqTampered)).toBeNull();
  });

  it("fails closed when durable revocation database update fails", async () => {
    const { revokeIntakeCapabilityToken } = await import("../../src/lib/auth/kiosk-capability");
    const supabaseLib = await import("../../src/lib/db/supabase");
    const vi = (await import("vitest")).vi;

    // Simulate database failure during revocation
    const spy = vi.spyOn(supabaseLib, "revokeKioskSessionDurable").mockRejectedValueOnce(
      new Error("DB_FATAL: Connection dropped during session revocation")
    );

    await expect(
      revokeIntakeCapabilityToken("ses-failing-db", { targetStatus: "abandoned" })
    ).rejects.toThrow("DB_FATAL: Connection dropped during session revocation");

    spy.mockRestore();
  });

  it("persists revocation status across in-memory cache eviction via isIntakeCapabilityRevokedDurable", async () => {
    const {
      revokeIntakeCapabilityToken,
      isIntakeCapabilityRevokedDurable,
      verifyIntakeCapabilityToken,
    } = await import("../../src/lib/auth/kiosk-capability");

    const testSession = "ses-durable-evict-999";
    const testToken = signIntakeCapabilityToken({ sessionId: testSession, patientId });

    // Revoke successfully
    await revokeIntakeCapabilityToken(testSession, { targetStatus: "abandoned" });

    // Wipe in-memory revocation set to simulate server restart / worker cache eviction
    const globalForRevocations = globalThis as any;
    if (globalForRevocations.__medkit_revoked_capability_sessions) {
      globalForRevocations.__medkit_revoked_capability_sessions.clear();
    }

    // Durable check reloads revocation from database and rejects token
    const isRevoked = await isIntakeCapabilityRevokedDurable(testSession);
    expect(isRevoked).toBe(true);

    // After durable check repopulates in-memory set, verification returns null
    expect(verifyIntakeCapabilityToken(testToken)).toBeNull();
  });
});
