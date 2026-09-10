import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { env } from "@/config/env";
import { finalizeCase, addCaseAmendment } from "@/features/cases/case-service";
import { recordPatientConsent, revokePatientConsent } from "@/features/consent/consent-service";
import * as supabaseLib from "@/lib/db/supabase";
import { AuthUser } from "@/features/auth/types";

describe("Unit: Supabase RPC & Transactional Wiring Layer", () => {
  const originalDemoMode = env.isDemoMode;

  const mockDoctorUser: AuthUser = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "dr.rao@aiia.gov.in",
    role: "doctor",
    fullName: "Dr. Surendra Rao",
    facilityId: "fac-hyd-01",
    supabaseToken: "mock-doctor-bearer-token",
  };

  beforeEach(() => {
    (env as any).isDemoMode = false;
  });

  afterEach(() => {
    (env as any).isDemoMode = originalDemoMode;
    vi.restoreAllMocks();
  });

  it("dispatches rpc_finalize_case_with_audit with case id when finalizing in non-demo mode", async () => {
    const caseId = "33333333-3333-4333-8333-333333333333";
    const existingCase = {
      id: caseId,
      patient_id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      chief_complaint: "Persistent severe cough and fever",
    };

    vi.spyOn(supabaseLib, "getCaseById").mockResolvedValue(existingCase as any);

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        ...existingCase,
        status: "final",
        finalized_at: new Date().toISOString(),
        finalized_by: mockDoctorUser.id,
      },
      error: null,
    });

    const mockClient: any = {
      rpc: rpcMock,
      from: vi.fn(),
    };

    vi.spyOn(supabaseLib, "getAuthorizedSupabaseClient").mockReturnValue(mockClient);

    const result = await finalizeCase(caseId, mockDoctorUser.id, mockDoctorUser);

    expect(rpcMock).toHaveBeenCalledWith("rpc_finalize_case_with_audit", {
      p_case_id: caseId,
    });
    expect(result.status).toBe("final");
  });

  it("dispatches rpc_add_amendment_with_audit with case id, reason, and notes", async () => {
    const caseId = "33333333-3333-4333-8333-333333333333";
    const existingCase = {
      id: caseId,
      patient_id: "11111111-1111-4111-8111-111111111111",
      status: "final",
      chief_complaint: "Persistent severe cough and fever",
    };

    vi.spyOn(supabaseLib, "getCaseById").mockResolvedValue(existingCase as any);
    vi.spyOn(supabaseLib, "getCaseAmendments").mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        case_id: caseId,
        author_id: mockDoctorUser.id,
        author_name: mockDoctorUser.fullName,
        version: 1,
        reason: "Patient reported symptom resolution",
        notes: "No fever for 48 hours.",
        created_at: new Date().toISOString(),
      },
    ]);

    const rpcMock = vi.fn().mockResolvedValue({
      data: { id: "44444444-4444-4444-8444-444444444444" },
      error: null,
    });

    const mockClient: any = {
      rpc: rpcMock,
      from: vi.fn(),
    };

    vi.spyOn(supabaseLib, "getAuthorizedSupabaseClient").mockReturnValue(mockClient);

    const result = await addCaseAmendment(
      caseId,
      {
        actorId: mockDoctorUser.id,
        actorName: mockDoctorUser.fullName,
        reason: "Patient reported symptom resolution",
        notes: "No fever for 48 hours.",
      },
      mockDoctorUser
    );

    expect(rpcMock).toHaveBeenCalledWith("rpc_add_amendment_with_audit", {
      p_case_id: caseId,
      p_reason: "Patient reported symptom resolution",
      p_notes: "No fever for 48 hours.",
    });
    expect(result.amendments?.length).toBe(1);
    expect(result.amendments?.[0].notes).toContain("No fever");
  });

  it("dispatches rpc_record_consent_with_audit when recording consent in non-demo mode", async () => {
    const patientId = "11111111-1111-4111-8111-111111111111";

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        id: "55555555-5555-4555-8555-555555555555",
        patient_id: patientId,
        purpose: "clinical_care_and_case_taking",
        scope: ["voice_recording", "document_extraction", "ai_summary"],
        language: "te",
        consent_method: "touch_acknowledgement",
        consent_version: "v1.0",
        consent_timestamp: new Date().toISOString(),
        status: "granted",
        granted_at: new Date().toISOString(),
        actor_id: mockDoctorUser.id,
        revoked: false,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const mockClient: any = {
      rpc: rpcMock,
    };

    vi.spyOn(supabaseLib, "getAuthorizedSupabaseClient").mockReturnValue(mockClient);

    const result = await recordPatientConsent({
      patientId,
      language: "te",
      purpose: "clinical_care_and_case_taking",
      scope: ["voice_recording", "document_extraction", "ai_summary"],
      actorOrToken: mockDoctorUser,
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_record_consent_with_audit", {
      p_patient_id: patientId,
      p_purpose: "clinical_care_and_case_taking",
      p_scope: ["voice_recording", "document_extraction", "ai_summary"],
      p_language: "te",
      p_method: "touch_acknowledgement",
      p_version: "v1.0",
    });
    expect(result.id).toBe("55555555-5555-4555-8555-555555555555");
    expect(result.status).toBe("granted");
  });

  it("dispatches rpc_revoke_consent_with_audit when revoking consent in non-demo mode", async () => {
    const consentId = "55555555-5555-4555-8555-555555555555";

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        id: consentId,
        patient_id: "11111111-1111-4111-8111-111111111111",
        status: "revoked",
        revoked: true,
        revoked_at: new Date().toISOString(),
        revocation_reason: "Patient requested revocation",
      },
      error: null,
    });

    const mockClient: any = {
      rpc: rpcMock,
    };

    vi.spyOn(supabaseLib, "getAuthorizedSupabaseClient").mockReturnValue(mockClient);

    const result = await revokePatientConsent(
      consentId,
      mockDoctorUser.id,
      "Patient requested revocation",
      mockDoctorUser
    );

    expect(rpcMock).toHaveBeenCalledWith("rpc_revoke_consent_with_audit", {
      p_consent_id: consentId,
      p_reason: "Patient requested revocation",
    });
    expect(result.revoked).toBe(true);
    expect(result.status).toBe("revoked");
  });

  it("fails closed when Supabase client is unavailable in non-demo mode", async () => {
    vi.spyOn(supabaseLib, "getAuthorizedSupabaseClient").mockReturnValue(null);
    vi.spyOn(supabaseLib, "getServiceSupabaseClient").mockReturnValue(null);

    const caseId = "33333333-3333-4333-8333-333333333333";
    vi.spyOn(supabaseLib, "getCaseById").mockResolvedValue({
      id: caseId,
      status: "draft",
      chief_complaint: "Valid complaint",
    } as any);

    await expect(finalizeCase(caseId, mockDoctorUser.id, mockDoctorUser)).rejects.toThrow(
      /Database unavailable/
    );
  });
});
