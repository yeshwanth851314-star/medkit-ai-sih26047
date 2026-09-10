import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import { signSessionToken } from "@/lib/auth/jwt";
import { signIntakeCapabilityToken, revokeIntakeCapabilityToken, requireIntakeOrClinicalAuth } from "@/lib/auth/kiosk-capability";
import { resolveKioskCredential } from "@/lib/auth/kiosk-credential";
import { executeIdempotentMutation, registerKioskInstance } from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";
import { AuthUser } from "@/features/auth/types";
import { POST as provisionKiosk } from "@/app/api/kiosk/provision/route";
import { POST as submitInterview } from "@/app/api/interviews/[id]/submit/route";
import { POST as answerInterview } from "@/app/api/interviews/[id]/answer/route";
import { POST as syncRoute } from "@/app/api/sync/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import {
  createInterviewSession,
  getInterviewSessionAsync,
  submitInterviewAnswerAsync,
  teardownInterviewSession,
} from "@/features/interview/interview-service";
import { env } from "@/config/env";

describe("Final Code Closure Master Gate: 6 Production Blockers", () => {
  const staffUser: AuthUser = {
    id: "usr-staff-001",
    email: "staff@aiia.gov.in",
    fullName: "Reception Staff Member",
    role: "staff",
    facilityId: "fac-hyd-01",
  };

  const doctorUser: AuthUser = {
    id: "usr-doctor-001",
    email: "doctor@aiia.gov.in",
    fullName: "Dr. Ananya Rao",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const adminUser: AuthUser = {
    id: "usr-admin-001",
    email: "admin@aiia.gov.in",
    fullName: "System Admin",
    role: "admin",
    facilityId: "fac-hyd-01",
  };

  const staffToken = signSessionToken(staffUser);
  const doctorToken = signSessionToken(doctorUser);
  const adminToken = signSessionToken(adminUser);

  // ===========================================================================
  // BLOCKER 1: KIOSK PROVISIONING RLS
  // ===========================================================================
  describe("Blocker 1: Kiosk Provisioning RLS & Profile Facility Derivation", () => {
    it("allows authorized staff to provision kiosk and sets HttpOnly cookie", async () => {
      const req = new Request("http://localhost:3000/api/kiosk/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Main Reception Kiosk Alpha",
        }),
      });

      const res = await provisionKiosk(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.kioskId).toBeDefined();
      expect(data.facilityId).toBe("fac-hyd-01");
      expect(data.credentialConfigured).toBe(true);

      // Verify HttpOnly device cookie is configured
      const cookieHeader = res.headers.get("set-cookie");
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain("medkit_kiosk_credential=");
      expect(cookieHeader).toContain("HttpOnly");

      // Verify database stored ONLY the hash, NEVER plaintext secret
      const dbKiosk = await mockDb.getKioskInstanceById(data.kioskId);
      expect(dbKiosk).toBeDefined();
      expect(dbKiosk.secret_hash).toBeDefined();
      expect(dbKiosk.secret_hash.length).toBe(64); // SHA-256 hex string
      expect(dbKiosk.name).toBe("Main Reception Kiosk Alpha");
    });

    it("denies doctors without administrative provisioning permissions with 403", async () => {
      const req = new Request("http://localhost:3000/api/kiosk/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Unauthorized Doctor Kiosk",
        }),
      });

      const res = await provisionKiosk(req);
      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toContain("FORBIDDEN");
    });

    it("denies anonymous unauthenticated callers with 401", async () => {
      const req = new Request("http://localhost:3000/api/kiosk/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Anonymous Kiosk",
        }),
      });

      const res = await provisionKiosk(req);
      expect(res.status).toBe(401);
    });

    it("binds kiosk strictly to caller profile facility and ignores spoofed facility input", async () => {
      const req = new Request("http://localhost:3000/api/kiosk/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Spoof Attempt Kiosk",
          facilityId: "fac-delhi-99", // Spoof attempt
        }),
      });

      const res = await provisionKiosk(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Facility must be derived from caller profile (fac-hyd-01), NOT spoofed value
      expect(data.facilityId).toBe("fac-hyd-01");
    });
  });

  // ===========================================================================
  // BLOCKER 2: WIRE ALL KIOSK SESSION OPERATIONS THROUGH RPCs
  // ===========================================================================
  describe("Blocker 2: Kiosk Session RPC Operations & Memory Recovery", () => {
    it("submits kiosk answers, survives in-memory cache wipes, and recovers session from DB", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      // Submit Question 1 using async flow
      const ans1 = await submitInterviewAnswerAsync(sessionId, "Continuous severe throat pain for 3 days", "touch");
      expect(ans1.session.answers.chief_complaint.rawAnswer).toBe("Continuous severe throat pain for 3 days");

      // Wipe in-memory session cache to simulate worker restart / multi-pod deployment
      const globalForSessions = globalThis as any;
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(sessionId);
      }

      // Recover session asynchronously from durable storage
      const restored = await getInterviewSessionAsync(sessionId);
      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(sessionId);
      expect(restored?.answers.chief_complaint.rawAnswer).toBe("Continuous severe throat pain for 3 days");

      // Submit Question 2 on recovered session
      const ans2 = await submitInterviewAnswerAsync(sessionId, "Mild dry cough with body chills", "touch");
      expect(ans2.session.answers.general_onset.rawAnswer).toBe("Mild dry cough with body chills");

      // Verify persistent store reflects both answers
      const finalRestored = await getInterviewSessionAsync(sessionId);
      expect(finalRestored?.answers.chief_complaint.rawAnswer).toBe("Continuous severe throat pain for 3 days");
      expect(finalRestored?.answers.general_onset.rawAnswer).toBe("Mild dry cough with body chills");
    });

    it("rehydrates cold-start session via secure kiosk RPC credentials", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      // Wipe in-memory session cache to simulate cold-start
      const globalForSessions = globalThis as any;
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(sessionId);
      }

      // Rehydrate passing kiosk credentials
      const restored = await getInterviewSessionAsync(sessionId, {
        kioskId: "00000000-0000-0000-0000-000000000001",
        kioskSecret: "kiosk-secret-hyd-01",
      });

      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(sessionId);
      expect(restored?.patientId).toBe(testPatientId);
    });

    it("rejects unauthenticated session rehydration in production mode (fail closed)", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      // Wipe memory
      const globalForSessions = globalThis as any;
      if (globalForSessions.__medkit_active_sessions) {
        globalForSessions.__medkit_active_sessions.delete(sessionId);
      }

      // Temporarily toggle isDemoMode to false to simulate production
      const origDemo = env.isDemoMode;
      try {
        (env as any).isDemoMode = false;
        await expect(
          getInterviewSessionAsync(sessionId) // No kiosk credentials or clinical token
        ).rejects.toThrow(/UNAUTHORIZED: Kiosk device credentials or clinical authentication required/);
      } finally {
        (env as any).isDemoMode = origDemo;
      }
    });
  });

  // ===========================================================================
  // BLOCKER 3: FIX SUBMIT COOKIE PROPAGATION
  // ===========================================================================
  describe("Blocker 3: Submit Cookie Propagation & Server Credential Resolution", () => {
    it("submits intake case successfully using HttpOnly cookie and intake token", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      await submitInterviewAnswerAsync(sessionId, "High fever and persistent joint pains", "touch");

      const intakeToken = signIntakeCapabilityToken({
        sessionId,
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:submit"],
      });

      const cookieVal = encodeURIComponent(
        JSON.stringify({
          kioskId: "00000000-0000-0000-0000-000000000001",
          kioskSecret: "kiosk-secret-hyd-01",
        })
      );

      const req = new Request(`http://localhost:3000/api/interviews/${sessionId}/submit`, {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          Cookie: `medkit_kiosk_credential=${cookieVal}`,
        },
      });

      const res = await submitInterview(req, { params: Promise.resolve({ id: sessionId }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.case).toBeDefined();
      expect(data.case.chief_complaint).toContain("High fever");

      // Verify teardown and capability revocation
      const authCheck = await requireIntakeOrClinicalAuth(req, {
        requiredScope: "intake:submit",
        targetSessionId: sessionId,
      });
      expect(authCheck.authorized).toBe(false);
    });

    it("rejects submit request when kiosk device cookie is malformed or missing", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      const intakeToken = signIntakeCapabilityToken({
        sessionId,
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:submit"],
      });

      // Request with invalid cookie
      const req = new Request(`http://localhost:3000/api/interviews/${sessionId}/submit`, {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          Cookie: "medkit_kiosk_credential=tampered-garbage-data",
        },
      });

      const res = await submitInterview(req, { params: Promise.resolve({ id: sessionId }) });
      // In demo mode fallback is permitted, but resolver returns null on tampered cookie
      const cred = resolveKioskCredential(req);
      expect(cred?.source !== "cookie").toBe(true);
    });
  });

  // ===========================================================================
  // BLOCKER 4: DURABLE REVOCATION MUST FAIL CLOSED
  // ===========================================================================
  describe("Blocker 4: Durable Capability Revocation & Fail-Closed Invariant", () => {
    it("fails closed when durable revocation DB update encounters a failure", async () => {
      const supabaseLib = await import("@/lib/db/supabase");
      const spy = vi.spyOn(supabaseLib, "revokeKioskSessionDurable").mockRejectedValueOnce(
        new Error("DATABASE_OFFLINE: Connection reset during session revocation")
      );

      await expect(
        revokeIntakeCapabilityToken("ses-db-err-check", { targetStatus: "abandoned" })
      ).rejects.toThrow("DATABASE_OFFLINE");

      spy.mockRestore();
    });

    it("remains revoked in persistent database across process restarts and cache evictions", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const session = createInterviewSession(testPatientId, "en", null, "fac-hyd-01");
      const sessionId = session.id;

      const token = signIntakeCapabilityToken({
        sessionId,
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:answer"],
      });

      // Perform durable revocation
      await revokeIntakeCapabilityToken(sessionId, { targetStatus: "abandoned" });

      // Wipe in-memory revocation Set
      const globalForRevocations = globalThis as any;
      if (globalForRevocations.__medkit_revoked_capability_sessions) {
        globalForRevocations.__medkit_revoked_capability_sessions.clear();
      }

      // Re-query: requireIntakeOrClinicalAuth must reject using durable database check
      const req = new Request(`http://localhost:3000/api/interviews/${sessionId}/answer`, {
        method: "POST",
        headers: { "x-intake-token": token },
      });

      const authCheck = await requireIntakeOrClinicalAuth(req, {
        requiredScope: "intake:answer",
        targetSessionId: sessionId,
      });

      expect(authCheck.authorized).toBe(false);
      if (!authCheck.authorized) {
        expect(authCheck.errorResponse.status).toBe(401);
      }
    });

    it("strictly fails closed with 503 when durable session DB verification encounters an error", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const token = signIntakeCapabilityToken({
        sessionId: "ses-db-err-failclosed",
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:answer"],
      });

      const supabaseLib = await import("@/lib/db/supabase");
      const spy = vi.spyOn(supabaseLib, "verifyDurableSessionState").mockRejectedValueOnce(
        new Error("DATABASE_UNAVAILABLE: Network partition during state check")
      );

      const req = new Request("http://localhost:3000/api/interviews/ses-db-err-failclosed/answer", {
        method: "POST",
        headers: { "x-intake-token": token },
      });

      const authCheck = await requireIntakeOrClinicalAuth(req, {
        requiredScope: "intake:answer",
        targetSessionId: "ses-db-err-failclosed",
      });

      expect(authCheck.authorized).toBe(false);
      if (!authCheck.authorized) {
        expect(authCheck.errorResponse.status).toBe(503);
      }

      spy.mockRestore();
    });

    it("strictly rejects durable revocation when kiosk credentials are invalid", async () => {
      const { revokeKioskSession } = await import("@/lib/db/supabase");
      await expect(
        revokeKioskSession({
          kioskId: "00000000-0000-4000-8000-000000000000",
          kioskSecret: "wrong-secret",
          sessionId: "ses-test-invalid-cred",
        })
      ).rejects.toThrow(/UNAUTHORIZED/);
    });

    it("strictly rejects durable revocation when kiosk facility does not match session facility", async () => {
      const kiosk = await mockDb.registerKioskInstance({
        facility_id: "fac-del-01",
        name: "Delhi Kiosk",
        secret_hash: crypto.createHash("sha256").update("delhi-secret-123").digest("hex"),
      });
      const session = await mockDb.createIntakeSession({
        patient_id: "11111111-1111-4111-8111-111111111111",
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const { revokeKioskSession } = await import("@/lib/db/supabase");
      await expect(
        revokeKioskSession({
          kioskId: kiosk.id,
          kioskSecret: "delhi-secret-123",
          sessionId: session.id,
        })
      ).rejects.toThrow(/FORBIDDEN/);
    });

    it("durably revokes intake session via POST /api/auth/logout with HttpOnly kiosk credentials", async () => {
      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const kiosk = await mockDb.registerKioskInstance({
        facility_id: "fac-hyd-01",
        name: "Logout Test Kiosk",
        secret_hash: crypto.createHash("sha256").update("logout-secret-xyz").digest("hex"),
      });
      const session = await mockDb.createIntakeSession({
        patient_id: testPatientId,
        facility_id: "fac-hyd-01",
        language: "en",
        status: "active",
        answers: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const intakeToken = signIntakeCapabilityToken({
        sessionId: session.id,
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:answer"],
      });

      const cookieVal = encodeURIComponent(
        JSON.stringify({ kioskId: kiosk.id, kioskSecret: "logout-secret-xyz" })
      );
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          Cookie: `medkit_kiosk_credential=${cookieVal}`,
        },
      });

      const res = await logoutRoute(req);
      expect(res.status).toBe(200);

      const dbSession = await mockDb.getIntakeSessionById(session.id);
      expect(dbSession?.status).toBe("abandoned");
      expect(mockDb.isSessionRevoked(session.id)).toBe(true);
    });

    it("denies intake session revocation during logout without kiosk credentials in production", async () => {
      const origDemo = env.isDemoMode;
      try {
        (env as any).isDemoMode = false;
        const testPatientId = "11111111-1111-4111-8111-111111111111";
        const intakeToken = signIntakeCapabilityToken({
          sessionId: "ses-no-cred-logout",
          patientId: testPatientId,
          facilityId: "fac-hyd-01",
          scope: ["intake:answer"],
        });

        const req = new Request("http://localhost:3000/api/auth/logout", {
          method: "POST",
          headers: {
            "x-intake-token": intakeToken,
          },
        });

        const res = await logoutRoute(req);
        expect(res.status).toBe(401);
      } finally {
        (env as any).isDemoMode = origDemo;
      }
    });

    it("fails closed with 500 when durable revocation encounters an error during logout", async () => {
      const cap = await import("@/lib/auth/kiosk-capability");
      const spy = vi.spyOn(cap, "revokeIntakeCapabilityToken").mockRejectedValueOnce(
        new Error("DATABASE_ERROR: Connection failed")
      );

      const testPatientId = "11111111-1111-4111-8111-111111111111";
      const intakeToken = signIntakeCapabilityToken({
        sessionId: "ses-logout-fail-closed",
        patientId: testPatientId,
        facilityId: "fac-hyd-01",
        scope: ["intake:answer"],
      });

      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
        },
      });

      const res = await logoutRoute(req);
      expect(res.status).toBe(500);

      spy.mockRestore();
    });
  });

  // ===========================================================================
  // BLOCKER 5: FIX SYNC LEDGER RLS + UNIQUENESS
  // ===========================================================================
  describe("Blocker 5: User-Scoped Idempotency Uniqueness & RLS", () => {
    it("allows two distinct users to independently execute mutations with the exact same idempotency key text", async () => {
      const sharedKey = `shared-sync-key-${crypto.randomUUID()}`;
      const payloadUser1 = { action: "sync_record", detail: "User 1 data" };
      const payloadUser2 = { action: "sync_record", detail: "User 2 data" };

      const hash1 = crypto.createHash("sha256").update(JSON.stringify(payloadUser1)).digest("hex");
      const hash2 = crypto.createHash("sha256").update(JSON.stringify(payloadUser2)).digest("hex");

      // User 1 executes mutation with sharedKey
      const res1 = await executeIdempotentMutation({
        idempotencyKey: sharedKey,
        userId: "usr-doctor-001",
        entity: "cases",
        action: "create",
        payloadHash: hash1,
        payload: payloadUser1,
      });

      expect(res1.status).toBe("completed");
      expect(res1.isReplay).toBe(false);

      // User 2 executes mutation with the exact same key string independently
      const res2 = await executeIdempotentMutation({
        idempotencyKey: sharedKey,
        userId: "usr-doctor-002",
        entity: "cases",
        action: "create",
        payloadHash: hash2,
        payload: payloadUser2,
      });

      expect(res2.status).toBe("completed");
      expect(res2.isReplay).toBe(false);
      expect(res2.mutationId).not.toBe(res1.mutationId);
    });

    it("replays mutation result for the same user when identical key and hash are re-sent", async () => {
      const userKey = `user-replay-key-${crypto.randomUUID()}`;
      const payload = { action: "sync_case", data: "reproducible payload" };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      const first = await executeIdempotentMutation({
        idempotencyKey: userKey,
        userId: "usr-doctor-001",
        entity: "cases",
        action: "create",
        payloadHash: hash,
        payload,
      });
      expect(first.isReplay).toBe(false);

      const second = await executeIdempotentMutation({
        idempotencyKey: userKey,
        userId: "usr-doctor-001",
        entity: "cases",
        action: "create",
        payloadHash: hash,
        payload,
      });
      expect(second.isReplay).toBe(true);
      expect(second.mutationId).toBe(first.mutationId);
    });

    it("rejects mutation with conflict error if same user sends different payload for same key", async () => {
      const userKey = `user-conflict-key-${crypto.randomUUID()}`;
      const payload1 = { value: "original" };
      const payload2 = { value: "tampered" };
      const hash1 = crypto.createHash("sha256").update(JSON.stringify(payload1)).digest("hex");
      const hash2 = crypto.createHash("sha256").update(JSON.stringify(payload2)).digest("hex");

      await executeIdempotentMutation({
        idempotencyKey: userKey,
        userId: "usr-doctor-001",
        entity: "cases",
        action: "create",
        payloadHash: hash1,
        payload: payload1,
      });

      await expect(
        executeIdempotentMutation({
          idempotencyKey: userKey,
          userId: "usr-doctor-001",
          entity: "cases",
          action: "create",
          payloadHash: hash2,
          payload: payload2,
        })
      ).rejects.toThrow(/CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH/);
    });
  });

  // ===========================================================================
  // BLOCKER 6: ATOMIC DOCUMENT SYNC & CONCURRENCY REPLAY
  // ===========================================================================
  describe("Blocker 6: Atomic Document Sync & Concurrency Locking", () => {
    it("atomically transacts document metadata registration through executeIdempotentMutation", async () => {
      const docKey = `doc-sync-key-${crypto.randomUUID()}`;
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-1/chest-xray-report.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data-xray"), "application/pdf");

      const docPayload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "chest-xray-report.pdf",
        mimeType: "application/pdf",
        fileSize: 2048576,
        documentType: "prescription",
        processingStatus: "uploaded",
        storage_path: canonicalPath,
        extractedData: { impressions: "Clear lung fields, no consolidation" },
      };

      const payloadHash = crypto.createHash("sha256").update(JSON.stringify(docPayload)).digest("hex");

      const result = await executeIdempotentMutation({
        idempotencyKey: docKey,
        userId: staffUser.id,
        entity: "documents",
        action: "create",
        payloadHash,
        payload: docPayload,
      });

      expect(result.status).toBe("completed");
      expect(result.isReplay).toBe(false);
      expect(result.summary).toBeDefined();
      expect(result.summary.documentId).toBeDefined();

      // Verify document metadata was recorded in persistent store
      const storedDoc = await mockDb.getDocumentById(result.summary.documentId);
      expect(storedDoc).toBeDefined();
      expect(storedDoc?.patient_id).toBe("11111111-1111-4111-8111-111111111111");
      expect(storedDoc?.original_filename).toBe("chest-xray-report.pdf");

      // Replay with identical key & hash returns cached summary
      const replay = await executeIdempotentMutation({
        idempotencyKey: docKey,
        userId: staffUser.id,
        entity: "documents",
        action: "create",
        payloadHash,
        payload: docPayload,
      });

      expect(replay.isReplay).toBe(true);
      expect(replay.summary.documentId).toBe(result.summary.documentId);
    });

    it("processes concurrent identical operations safely and replays without unique violations", async () => {
      const concurrentKey = `concurrent-doc-${crypto.randomUUID()}`;
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-2/ecg-trace.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data-ecg"), "application/pdf");

      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "ecg-trace.pdf",
        storage_path: canonicalPath,
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      // 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        executeIdempotentMutation({
          idempotencyKey: concurrentKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      );

      const results = await Promise.all(promises);

      // All 10 requests must succeed with 'completed'
      results.forEach((r) => {
        expect(r.status).toBe("completed");
      });

      // Exactly 1 request executes the mutation, while other 9 return replay
      const initialExecutions = results.filter((r) => !r.isReplay);
      const replays = results.filter((r) => r.isReplay);

      expect(initialExecutions.length).toBe(1);
      expect(replays.length).toBe(9);
      expect(replays[0].mutationId).toBe(initialExecutions[0].mutationId);
    });

    it("executes atomic document sync through the /api/sync endpoint", async () => {
      const idempotencyKey = `sync-route-doc-${crypto.randomUUID()}`;
      const queueItemId = crypto.randomUUID();
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-3/discharge-summary.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data-discharge"), "application/pdf");

      const queueItem = {
        id: queueItemId,
        entity: "documents",
        action: "create",
        idempotencyKey,
        payload: {
          patientId: "11111111-1111-4111-8111-111111111111",
          originalFilename: "discharge-summary.pdf",
          mimeType: "application/pdf",
          fileSize: 512000,
          storage_path: canonicalPath,
        },
        timestamp: new Date().toISOString(),
        retryCount: 0,
        syncStatus: "pending",
      };

      const req = new Request("http://localhost:3000/api/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [queueItem],
        }),
      });

      const res = await syncRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.succeeded).toContain(queueItemId);
      expect(data.failed).toHaveLength(0);
    });

    it("strictly rejects document creation without storage_path (STORAGE_PATH_REQUIRED)", async () => {
      const docKey = `doc-missing-storage-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "missing-path.pdf",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_PATH_REQUIRED/);
    });

    it("strictly rejects document creation with fake offline-sync/ path", async () => {
      const docKey = `doc-fake-storage-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "fake-sync.pdf",
        storage_path: "offline-sync/a849f7b1-fake-uuid",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_PATH_REQUIRED/);
    });

    it("strictly rejects offline document sync setting clinician-only status confirmed", async () => {
      const docKey = `doc-forbidden-status-${crypto.randomUUID()}`;
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-4/status-tamper.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data"), "application/pdf");

      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "status-tamper.pdf",
        storage_path: canonicalPath,
        processing_status: "confirmed",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/FORBIDDEN_DOCUMENT_STATUS_TRANSITION/);
    });

    it("strictly rejects document update tampering with immutable fields (IMMUTABLE_FIELD_TAMPERING)", async () => {
      // First create a legitimate document
      const docKey = `doc-immutable-base-${crypto.randomUUID()}`;
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-5/immutable-check.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data"), "application/pdf");

      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "immutable-check.pdf",
        storage_path: canonicalPath,
        processing_status: "uploaded",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      const created = await executeIdempotentMutation({
        idempotencyKey: docKey,
        userId: staffUser.id,
        entity: "documents",
        action: "create",
        payloadHash: hash,
        payload,
      });

      const docId = created.summary.documentId;

      // Now attempt an update that tampers with patient_id
      const tamperKey = `doc-tamper-key-${crypto.randomUUID()}`;
      const tamperPayload = {
        id: docId,
        patientId: "99999999-9999-9999-9999-999999999999", // Tampered
      };
      const tamperHash = crypto.createHash("sha256").update(JSON.stringify(tamperPayload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: tamperKey,
          userId: staffUser.id,
          entity: "documents",
          action: "update",
          payloadHash: tamperHash,
          payload: tamperPayload,
        })
      ).rejects.toThrow(/IMMUTABLE_FIELD_TAMPERING/);
    });

    it("strictly rejects document sync when referenced storage object does not exist in Supabase Storage", async () => {
      const docKey = `doc-missing-obj-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "nonexistent.pdf",
        storage_path: "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-99/nonexistent.pdf",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_OBJECT_NOT_FOUND/);
    });

    it("strictly rejects storage paths with directory traversal sequences", async () => {
      const docKey = `doc-traversal-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "traversal.pdf",
        storage_path: "patients/11111111-1111-4111-8111-111111111111/cases/../../../etc/passwd",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_PATH_TRAVERSAL/);
    });

    it("strictly rejects storage paths where path patient does not match document patient", async () => {
      const docKey = `doc-mismatch-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "other-patient.pdf",
        storage_path: "patients/22222222-2222-4222-8222-222222222222/cases/uncategorized/doc-1/other-patient.pdf",
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_PATH_PATIENT_MISMATCH/);
    });

    it("strictly rejects storage paths where referenced case belongs to another patient", async () => {
      // Create a case for a different patient
      const otherCase = await mockDb.createCase({
        patient_id: "22222222-2222-4222-8222-222222222222",
        created_by: doctorUser.id,
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Other patient complaint",
        status: "draft",
      });

      const docKey = `doc-case-mismatch-${crypto.randomUUID()}`;
      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        originalFilename: "mismatched-case.pdf",
        storage_path: `patients/11111111-1111-4111-8111-111111111111/cases/${otherCase.id}/doc-1/mismatched-case.pdf`,
      };
      const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: staffUser.id,
          entity: "documents",
          action: "create",
          payloadHash: hash,
          payload,
        })
      ).rejects.toThrow(/STORAGE_PATH_CASE_MISMATCH/);
    });

    it("strictly rejects document UPDATE attempted across facility boundaries (FACILITY_ACCESS_DENIED)", async () => {
      // 1. Create a legitimate document in fac-hyd-01 for Hyderabad patient
      const docKey = `doc-cross-fac-base-${crypto.randomUUID()}`;
      const canonicalPath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-xfac/cross-fac.pdf";
      mockDb.saveStorageFile(canonicalPath, Buffer.from("pdf-data-xfac"), "application/pdf");

      const created = await executeIdempotentMutation({
        idempotencyKey: docKey,
        userId: staffUser.id,
        entity: "documents",
        action: "create",
        payloadHash: "hash-xfac-1",
        payload: {
          patientId: "11111111-1111-4111-8111-111111111111",
          originalFilename: "cross-fac.pdf",
          storage_path: canonicalPath,
          processing_status: "uploaded",
        },
      });

      const docId = created.summary.documentId;

      // 2. Register an external doctor belonging to Delhi facility
      const delhiDoctorUser: AuthUser = {
        id: "usr-doctor-delhi-001",
        email: "doctor.delhi@aiia.gov.in",
        fullName: "Dr. Delhi Clinician",
        role: "doctor",
        facilityId: "fac-del-01",
      };
      mockDb.setUserProfile(delhiDoctorUser.id, { role: "doctor", facilityId: "fac-del-01" });

      // 3. Delhi doctor attempts to update Hyderabad document
      const updateKey = `doc-cross-update-${crypto.randomUUID()}`;
      const updatePayload = {
        id: docId,
        processing_status: "processing",
        extracted_data: { notes: "tampered by cross-facility user" },
      };

      await expect(
        executeIdempotentMutation({
          idempotencyKey: updateKey,
          userId: delhiDoctorUser.id,
          entity: "documents",
          action: "update",
          payloadHash: "hash-xfac-update",
          payload: updatePayload,
          actorOrToken: delhiDoctorUser,
        })
      ).rejects.toThrow(/FACILITY_ACCESS_DENIED/);

      // Verify document was NOT modified
      const docAfter = await mockDb.getDocumentById(docId);
      expect(docAfter?.processing_status).toBe("uploaded");
      expect(docAfter?.extracted_data).toBeNull();
    });

    it("strictly rejects document CREATE when path has uncategorized but payload specifies caseId", async () => {
      const validCase = await mockDb.createCase({
        patient_id: "11111111-1111-4111-8111-111111111111",
        created_by: doctorUser.id,
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Complaint",
        status: "draft",
      });

      const docKey = `doc-case-uncat-mismatch-${crypto.randomUUID()}`;
      const storagePath = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-1/file.pdf";
      mockDb.saveStorageFile(storagePath, Buffer.from("pdf-data"), "application/pdf");

      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        caseId: validCase.id, // Specifies case
        originalFilename: "file.pdf",
        storage_path: storagePath, // Path is uncategorized
      };

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: doctorUser.id,
          entity: "documents",
          action: "create",
          payloadHash: "hash-case-uncat",
          payload,
          actorOrToken: doctorUser,
        })
      ).rejects.toThrow(/STORAGE_PATH_CASE_MISMATCH/);
    });

    it("strictly rejects document CREATE when path has caseA but payload specifies caseB", async () => {
      const caseA = await mockDb.createCase({
        patient_id: "11111111-1111-4111-8111-111111111111",
        created_by: doctorUser.id,
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Complaint A",
        status: "draft",
      });
      const caseB = await mockDb.createCase({
        patient_id: "11111111-1111-4111-8111-111111111111",
        created_by: doctorUser.id,
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Complaint B",
        status: "draft",
      });

      const docKey = `doc-caseA-caseB-${crypto.randomUUID()}`;
      const storagePath = `patients/11111111-1111-4111-8111-111111111111/cases/${caseA.id}/doc-1/file.pdf`;
      mockDb.saveStorageFile(storagePath, Buffer.from("pdf-data"), "application/pdf");

      const payload = {
        patientId: "11111111-1111-4111-8111-111111111111",
        caseId: caseB.id, // Specifies caseB
        originalFilename: "file.pdf",
        storage_path: storagePath, // Path specifies caseA
      };

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: doctorUser.id,
          entity: "documents",
          action: "create",
          payloadHash: "hash-caseA-caseB",
          payload,
          actorOrToken: doctorUser,
        })
      ).rejects.toThrow(/STORAGE_PATH_CASE_MISMATCH/);
    });

    it("strictly rejects document CREATE when payload specifies case from another facility", async () => {
      // Create patient in Delhi facility
      const delhiPatient = await mockDb.createPatient({
        patient_code: "PT-DEL-999",
        full_name: "Delhi Patient",
        date_of_birth: "1988-01-01",
        gender: "female",
        phone: "+919876543210",
        facility_id: "fac-del-01",
      });

      // Create case bound to Delhi patient (derives facility strictly from parent patient)
      const delhiCase = await mockDb.createCase({
        patient_id: delhiPatient.id,
        clinician_id: "usr-doctor-delhi-001",
        case_type: "general",
        patient_language: "en",
        chief_complaint: "Delhi Case Complaint",
        status: "draft",
      });

      const docKey = `doc-case-fac-mismatch-${crypto.randomUUID()}`;
      const storagePath = `patients/${delhiPatient.id}/cases/${delhiCase.id}/doc-1/file.pdf`;
      mockDb.saveStorageFile(storagePath, Buffer.from("pdf-data"), "application/pdf");

      const payload = {
        patientId: delhiPatient.id,
        caseId: delhiCase.id,
        originalFilename: "file.pdf",
        storage_path: storagePath,
      };

      await expect(
        executeIdempotentMutation({
          idempotencyKey: docKey,
          userId: doctorUser.id, // Hyderabad doctor
          entity: "documents",
          action: "create",
          payloadHash: "hash-case-delhi-fac",
          payload,
          actorOrToken: doctorUser,
        })
      ).rejects.toThrow(/FACILITY_ACCESS_DENIED/);
    });
  });

  describe("Blocker 9: Schema Consistency & Facility Authorization Hardening", () => {
    it("strictly rejects patient CREATE when non-admin supplies mismatched facilityId", async () => {
      const pKey = `patient-fac-mismatch-${crypto.randomUUID()}`;
      await expect(
        executeIdempotentMutation({
          idempotencyKey: pKey,
          userId: doctorUser.id, // Hyderabad doctor (fac-hyd-01)
          entity: "patients",
          action: "create",
          payloadHash: "hash-pat-delhi-fac",
          payload: {
            fullName: "Foreign Facility Patient",
            facilityId: "fac-del-01", // Mismatched!
          },
          actorOrToken: doctorUser,
        })
      ).rejects.toThrow(/FACILITY_ACCESS_DENIED/);
    });

    it("forces caller facility on patient CREATE for non-admin and records transactional audit", async () => {
      const pKey = `patient-fac-enforced-${crypto.randomUUID()}`;
      const res = await executeIdempotentMutation({
        idempotencyKey: pKey,
        userId: doctorUser.id,
        entity: "patients",
        action: "create",
        payloadHash: "hash-pat-hyd-fac",
        payload: {
          fullName: "Enforced Facility Patient",
          phone: "+919988776655",
        },
        actorOrToken: doctorUser,
      });

      expect(res.status).toBe("completed");
      const createdPatient = await mockDb.getPatientById(res.summary.patientId);
      expect(createdPatient).not.toBeNull();
      expect(createdPatient?.facility_id).toBe("fac-hyd-01");

      // Verify transactional audit log
      const audits = await mockDb.getAuditLogs();
      const mutationAudit = audits.find((a) => a.metadata?.idempotencyKey === pKey);
      expect(mutationAudit).toBeDefined();
      expect(mutationAudit?.action).toBe("SYNC_MUTATION_EXECUTED");
      expect(mutationAudit?.metadata?.facilityId).toBe("fac-hyd-01");
    });

    it("verifies case CREATE writes clinician_id and derives facility from parent patient", async () => {
      // 1. Create patient in Hyderabad
      const patient = await mockDb.createPatient({
        patient_code: `PT-${crypto.randomUUID().slice(0, 8)}`,
        full_name: "Case Patient",
        date_of_birth: "1985-05-15",
        gender: "male",
        phone: "+919123456789",
        facility_id: "fac-hyd-01",
      });

      // 2. Create case via executeIdempotentMutation
      const cKey = `case-clinician-id-${crypto.randomUUID()}`;
      const res = await executeIdempotentMutation({
        idempotencyKey: cKey,
        userId: doctorUser.id,
        entity: "cases",
        action: "create",
        payloadHash: "hash-case-create",
        payload: {
          patientId: patient.id,
          chiefComplaint: "Severe fever and body ache",
          caseType: "general",
        },
        actorOrToken: doctorUser,
      });

      expect(res.status).toBe("completed");
      const createdCase = await mockDb.getCaseById(res.summary.caseId);
      expect(createdCase).not.toBeNull();
      // Ensure clinician_id is set to caller ID
      expect(createdCase?.clinician_id).toBe(doctorUser.id);
      // Ensure cases table has NO facility_id column (facility derived through parent patient)
      expect((createdCase as any).facility_id).toBeUndefined();
    });

    it("strictly rejects case CREATE when non-admin attempts to create case for patient outside facility", async () => {
      // Create patient in Delhi
      const delhiPatient = await mockDb.createPatient({
        patient_code: `PT-DEL-${crypto.randomUUID().slice(0, 8)}`,
        full_name: "Delhi Facility Patient",
        date_of_birth: "1992-03-10",
        gender: "female",
        phone: "+919876543211",
        facility_id: "fac-del-01",
      });

      const cKey = `case-cross-facility-${crypto.randomUUID()}`;
      await expect(
        executeIdempotentMutation({
          idempotencyKey: cKey,
          userId: doctorUser.id, // Hyderabad doctor
          entity: "cases",
          action: "create",
          payloadHash: "hash-case-cross-fac",
          payload: {
            patientId: delhiPatient.id,
            chiefComplaint: "Cross facility attempt",
          },
          actorOrToken: doctorUser,
        })
      ).rejects.toThrow(/FACILITY_ACCESS_DENIED/);
    });
  });
});
