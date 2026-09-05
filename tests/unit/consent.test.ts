import { describe, it, expect } from "vitest";
import {
  recordPatientConsent,
  verifyPatientConsent,
  revokePatientConsent,
  getConsentById,
} from "../../src/features/consent/consent-service";
import {
  createInterviewSession,
  submitInterviewAnswer,
  compileInterviewToCase,
} from "../../src/features/interview/interview-service";
import { getAuditTrailForResource } from "../../src/features/security/audit-service";

describe("Phase 3: Patient Clinical Consent & Audit Trail Persistence", () => {
  const patientId = "22222222-2222-4222-8222-222222222222";

  it("persists an explicit patient clinical consent record with full metadata", async () => {
    const consent = await recordPatientConsent({
      patientId,
      language: "te",
      consentMethod: "touch_acknowledgement",
      scope: ["voice_recording", "document_extraction", "ai_summary"],
      purpose: "clinical_care_and_case_taking",
      actorId: patientId,
      actorRole: "patient",
    });

    expect(consent).toBeDefined();
    expect(consent.id).toBeDefined();
    expect(consent.patient_id).toBe(patientId);
    expect(consent.language).toBe("te");
    expect(consent.consent_method).toBe("touch_acknowledgement");
    expect(consent.scope).toContain("voice_recording");
    expect(consent.revoked).toBe(false);

    // Verify it is retrievable by ID
    const retrieved = await getConsentById(consent.id);
    expect(retrieved?.id).toBe(consent.id);
    expect(retrieved?.language).toBe("te");
  });

  it("verifies active consent succeeds for patient", async () => {
    const verification = await verifyPatientConsent(patientId);
    expect(verification.valid).toBe(true);
    expect(verification.consent?.patient_id).toBe(patientId);
  });

  it("compiles interview session into case linked to verified consent", async () => {
    const session = createInterviewSession(patientId, "te");
    submitInterviewAnswer(session.id, "Severe headache and fever", "touch");

    const clinicalCase = await compileInterviewToCase(session.id);
    expect(clinicalCase).toBeDefined();
    expect(clinicalCase.patient_id).toBe(patientId);
    expect(clinicalCase.consent_id).toBeDefined();
    expect(typeof clinicalCase.consent_id).toBe("string");
  });

  it("revokes patient consent and reflects status immediately", async () => {
    // Record specific consent for revocation test
    const patientRevokeId = "33333333-3333-4333-8333-333333333333";
    const consent = await recordPatientConsent({
      patientId: patientRevokeId,
      language: "en",
    });

    const revoked = await revokePatientConsent(consent.id, patientRevokeId, "Patient withdrew consent");
    expect(revoked.revoked).toBe(true);
    expect(revoked.revoked_at).toBeDefined();

    // Verify status returns false
    const check = await verifyPatientConsent(patientRevokeId);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("revoked");
  });

  it("strictly blocks case compilation when patient consent is revoked", async () => {
    const patientRevokedId = "44444444-4444-4444-8444-444444444444";
    const consent = await recordPatientConsent({
      patientId: patientRevokedId,
      language: "en",
    });

    // Create session before revocation
    const session = createInterviewSession(patientRevokedId, "en", consent.id);
    submitInterviewAnswer(session.id, "Back pain", "touch");

    // Revoke consent
    await revokePatientConsent(consent.id, patientRevokedId);

    // Compilation must fail closed
    await expect(compileInterviewToCase(session.id)).rejects.toThrow(/CONSENT_REQUIRED/);
  });

  it("records immutable audit log entries upon consent creation and revocation", async () => {
    const auditPatientId = "55555555-5555-4555-8555-555555555555";
    const consent = await recordPatientConsent({
      patientId: auditPatientId,
      language: "en",
    });

    await revokePatientConsent(consent.id, auditPatientId, "Patient opt-out");

    const auditTrail = await getAuditTrailForResource("patients", auditPatientId);
    expect(auditTrail.length).toBeGreaterThanOrEqual(2);

    const consentAudit = auditTrail.find((a) => a.action === "CONSENT_RECORDED");
    expect(consentAudit).toBeDefined();
    expect(consentAudit?.metadata?.consentId).toBe(consent.id);

    const revokeAudit = auditTrail.find((a) => a.metadata?.action === "revoke_consent");
    expect(revokeAudit).toBeDefined();
  });
});
