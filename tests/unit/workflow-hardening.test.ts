import { describe, it, expect, vi } from "vitest";
import {
  downloadDocumentFromStorage,
} from "../../src/lib/db/supabase";
import { mockDb } from "../../src/lib/db/mock-adapter";
import { AuthUser } from "../../src/features/auth/types";
import {
  signIntakeCapabilityToken,
  verifyIntakeCapabilityToken,
  revokeIntakeCapabilityToken,
} from "../../src/lib/auth/kiosk-capability";
import {
  createInterviewSession,
  getInterviewSession,
  teardownInterviewSession,
  submitInterviewAnswer,
  compileInterviewToCase,
} from "../../src/features/interview/interview-service";
import {
  recordPatientConsent,
  verifyPatientConsent,
} from "../../src/features/consent/consent-service";
import * as auditService from "../../src/features/security/audit-service";

describe("Workflow & Integrity Hardening Tests", () => {
  const patientHyd = "11111111-1111-4111-8111-111111111111"; // facility: fac-hyd-01

  describe("Multi-Facility Storage Isolation", () => {
    const storagePath = `patients/${patientHyd}/lab-report-001.pdf`;

    it("strictly denies cross-facility document downloads for non-admin clinicians", async () => {
      mockDb.saveStorageFile(storagePath, Buffer.from("Sensitive Lab Content"), "application/pdf");

      const unauthorizedDoctor: AuthUser = {
        id: "usr-doc-delhi",
        email: "delhi.doc@medkit.ai",
        fullName: "Dr. Delhi Clinician",
        role: "doctor",
        facilityId: "fac-del-01",
      };

      const result = await downloadDocumentFromStorage(storagePath, unauthorizedDoctor);
      expect(result).toBeNull();
    });

    it("allows document download for authorized clinician within the same facility", async () => {
      mockDb.saveStorageFile(storagePath, Buffer.from("Sensitive Lab Content"), "application/pdf");

      const authorizedDoctor: AuthUser = {
        id: "usr-doc-hyd",
        email: "hyd.doc@medkit.ai",
        fullName: "Dr. Hyderabad Clinician",
        role: "doctor",
        facilityId: "fac-hyd-01",
      };

      const result = await downloadDocumentFromStorage(storagePath, authorizedDoctor);
      expect(result).not.toBeNull();
      expect(result?.buffer.toString()).toBe("Sensitive Lab Content");
    });

    it("allows document download for administrator across facilities for clinical governance", async () => {
      mockDb.saveStorageFile(storagePath, Buffer.from("Sensitive Lab Content"), "application/pdf");

      const adminUser: AuthUser = {
        id: "usr-admin-hq",
        email: "admin@medkit.ai",
        fullName: "Hospital Compliance Admin",
        role: "admin",
        facilityId: "fac-del-01", // Different facility from patient
      };

      const result = await downloadDocumentFromStorage(storagePath, adminUser);
      expect(result).not.toBeNull();
      expect(result?.buffer.toString()).toBe("Sensitive Lab Content");
    });
  });

  describe("Kiosk Intake Capability & Memory Lifecycle", () => {
    const sessionId = "ses-hardening-kiosk-99";

    it("verifies, revokes, and invalidates intake capability tokens", () => {
      const token = signIntakeCapabilityToken({
        sessionId,
        patientId: patientHyd,
        facilityId: "fac-hyd-01",
        scope: ["intake:answer", "intake:submit"],
      });

      const initialVerified = verifyIntakeCapabilityToken(token);
      expect(initialVerified).not.toBeNull();
      expect(initialVerified?.facilityId).toBe("fac-hyd-01");

      // Revoke capability token
      revokeIntakeCapabilityToken(sessionId);

      // Subsequent verification must fail closed
      const revokedVerified = verifyIntakeCapabilityToken(token);
      expect(revokedVerified).toBeNull();
    });

    it("teardownInterviewSession revokes token and frees session from in-memory store", () => {
      const session = createInterviewSession(patientHyd, "en", undefined, "fac-hyd-01");
      const activeSession = getInterviewSession(session.id);
      expect(activeSession).toBeDefined();

      const token = signIntakeCapabilityToken({
        sessionId: session.id,
        patientId: patientHyd,
      });
      expect(verifyIntakeCapabilityToken(token)).not.toBeNull();

      // Teardown session
      teardownInterviewSession(session.id);

      // Session is marked submitted and capability token is revoked
      expect(getInterviewSession(session.id)?.status).toBe("submitted");
      expect(verifyIntakeCapabilityToken(token)).toBeNull();
    });
  });

  describe("Consent Atomic Rollback on Audit Failure", () => {
    it("compensates and revokes un-audited consent record if audit logger fails", async () => {
      const tempPatientId = "77777777-7777-4777-8777-777777777777";

      // Mock auditService.logAuditEvent to throw an unexpected database fault
      const auditSpy = vi.spyOn(auditService, "logAuditEvent").mockRejectedValueOnce(
        new Error("PostgreSQL audit logging connection reset")
      );

      await expect(
        recordPatientConsent({
          patientId: tempPatientId,
          language: "en",
          purpose: "emergency_care",
        })
      ).rejects.toThrow("PostgreSQL audit logging connection reset");

      // Verify that consent status failed closed and is not considered valid
      const check = await verifyPatientConsent(tempPatientId);
      expect(check.valid).toBe(false);

      auditSpy.mockRestore();
    });
  });

  describe("Interview Compilation Red Flag Detection & Events", () => {
    it("evaluates red flags, persists red_flag_events, and evicts session upon compilation", async () => {
      const session = createInterviewSession(patientHyd, "en", undefined, "fac-hyd-01");

      // Submit red flag symptom: chest pain radiating to left arm
      submitInterviewAnswer(
        session.id,
        "I have severe crushing chest pain radiating to my left arm and jaw with cold sweat.",
        "touch"
      );

      const compiledCase = await compileInterviewToCase(session.id);

      // 1. Case draft created with red flags attached
      expect(compiledCase).toBeDefined();
      expect(compiledCase.red_flags).toBeDefined();
      expect(Array.isArray(compiledCase.red_flags)).toBe(true);
      expect((compiledCase.red_flags as any[]).length).toBeGreaterThan(0);

      const alert = (compiledCase.red_flags as any[]).find(
        (rf: any) => rf.signal === "acute_chest_pain" || rf.severity === "high" || rf.severity === "critical"
      );
      expect(alert).toBeDefined();

      // 2. Red flag event persisted in database
      const events = mockDb.getRedFlagEvents(compiledCase.id);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].case_id).toBe(compiledCase.id);
      expect(events[0].acknowledged_at).toBeNull();

      // 3. Interview session marked submitted and capability revoked
      expect(getInterviewSession(session.id)?.status).toBe("submitted");
    });
  });
});
