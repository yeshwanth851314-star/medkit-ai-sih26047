import { describe, it, expect } from "vitest";
import {
  logAuditEvent,
  getAuditTrailForResource,
} from "../../src/features/security/audit-service";
import {
  maskPhone,
  maskAbhaId,
  maskName,
  deIdentifyPatientRecord,
  sanitizeErrorMessage,
} from "../../src/features/security/de-identification";
import * as fs from "fs";
import * as path from "path";

describe("Phase 14: Security, Privacy & Audit Trail Hardening Tests", () => {
  it("records immutable audit log entries for clinical actions", async () => {
    const testCaseId = "case-audit-test-01";
    const logged = await logAuditEvent({
      actorId: "doc-123",
      actorRole: "doctor",
      action: "FINALIZE_CASE",
      resourceType: "cases",
      resourceId: testCaseId,
      metadata: { reason: "Consultation completed, prescriptions confirmed" },
    });

    expect(logged).toBeDefined();
    expect(logged.id).toBeDefined();
    expect(logged.action).toBe("FINALIZE_CASE");
    expect(logged.resource_id).toBe(testCaseId);

    // Query back
    const logs = await getAuditTrailForResource("cases", testCaseId);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actor_id).toBe("doc-123");
    expect(logs[0].action).toBe("FINALIZE_CASE");
  });

  it("de-identifies patient PII correctly", () => {
    const phone = "+919876543210";
    const maskedP = maskPhone(phone);
    expect(maskedP).toContain("+91");
    expect(maskedP).toContain("3210");
    expect(maskedP).not.toContain("98765");

    const abha = "14-2345-6789-0123";
    const maskedA = maskAbhaId(abha);
    expect(maskedA).toBe("**-****-****-0123");

    const name = "Rajesh Varma";
    const maskedN = maskName(name);
    expect(maskedN).toBe("R***** V****");

    const deIdentified = deIdentifyPatientRecord({
      full_name: "Rajesh Varma",
      phone: "+919876543210",
      abha_id: "14-2345-6789-0123",
      patient_code: "MED-2026-0001",
    });

    expect(deIdentified.maskedName).toBe("R***** V****");
    expect(deIdentified.patientCode).toBe("MED-2026-0001");
  });

  it("sanitizes sensitive server errors and database strings from client exposure", () => {
    const dangerousDbError = new Error(
      'postgres://postgres:secret123@db.supabase.co:5432/postgres: relation "cases" does not exist'
    );
    const sanitizedDb = sanitizeErrorMessage(dangerousDbError);
    expect(sanitizedDb).toBe(
      "A secure server error occurred. The internal error has been logged securely."
    );
    expect(sanitizedDb).not.toContain("secret123");
    expect(sanitizedDb).not.toContain("postgres://");

    const pathError = new Error("File not found at D:\\SIH2026-winning-project\\src\\secrets.key");
    const sanitizedPath = sanitizeErrorMessage(pathError);
    expect(sanitizedPath).toBe(
      "A secure server error occurred. The internal error has been logged securely."
    );

    // Safe error message is retained
    const safeError = new Error("Patient code is invalid or missing");
    const sanitizedSafe = sanitizeErrorMessage(safeError);
    expect(sanitizedSafe).toBe("Patient code is invalid or missing");
  });

  it("verifies no live production secrets are checked into .env.example", () => {
    const envExamplePath = path.resolve(__dirname, "../../.env.example");
    const envContent = fs.readFileSync(envExamplePath, "utf-8");
    expect(envContent).toContain('NEXT_PUBLIC_DEMO_MODE="true"');
    expect(envContent).not.toContain("eyJhbGciOi"); // No real JWTs
    expect(envContent).toContain('GEMINI_API_KEY="your-gemini-api-key"'); // Safe placeholder
  });

  it("records audit events for consent revocation and offline sync with extended resource types", async () => {
    const consentLog = await logAuditEvent({
      actorId: "staff-777",
      actorRole: "staff",
      action: "CONSENT_REVOKED",
      resourceType: "consents",
      resourceId: "consent-uuid-1234",
      metadata: { reason: "Patient opted out" },
    });
    expect(consentLog.resource_type).toBe("consents");
    expect(consentLog.action).toBe("CONSENT_REVOKED");

    const syncLog = await logAuditEvent({
      actorId: "clinician-007",
      actorRole: "clinician",
      action: "SYNC_OFFLINE_OPERATION",
      resourceType: "transcripts",
      resourceId: "tr-9999",
      metadata: { recordCount: 1 },
    });
    expect(syncLog.resource_type).toBe("transcripts");
    expect(syncLog.action).toBe("SYNC_OFFLINE_OPERATION");
  });

  it("fails closed on critical audit logging failure in production mode", async () => {
    const { env } = await import("../../src/config/env");
    const { CRITICAL_AUDIT_ACTIONS } = await import("../../src/features/security/audit-service");

    expect(CRITICAL_AUDIT_ACTIONS.has("FINALIZE_CASE")).toBe(true);
    expect(CRITICAL_AUDIT_ACTIONS.has("AMEND_CASE")).toBe(true);
    expect(CRITICAL_AUDIT_ACTIONS.has("CONFIRM_DOCUMENT_OCR")).toBe(true);
    expect(CRITICAL_AUDIT_ACTIONS.has("CONFIRM_SUMMARY")).toBe(true);
    expect(CRITICAL_AUDIT_ACTIONS.has("CONSENT_REVOKED")).toBe(true);
    expect(CRITICAL_AUDIT_ACTIONS.has("ACKNOWLEDGE_RED_FLAG")).toBe(true);

    // Verify critical audit failure throws in non-demo mode when supabase is unavailable
    const originalDemoMode = env.isDemoMode;
    try {
      (env as any).isDemoMode = false;
      await expect(
        logAuditEvent({
          actorId: "doc-999",
          actorRole: "doctor",
          action: "CONFIRM_SUMMARY",
          resourceType: "cases",
          resourceId: "case-999",
          metadata: { note: "test" },
        })
      ).rejects.toThrow(/CRITICAL_AUDIT_FAILURE/i);
    } finally {
      (env as any).isDemoMode = originalDemoMode;
    }
  });
});

