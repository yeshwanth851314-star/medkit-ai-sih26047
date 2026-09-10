import { describe, it, expect, beforeEach } from "vitest";
import { signSessionToken } from "../../src/lib/auth/jwt";
import { AuthUser } from "../../src/features/auth/types";
import { GET as getPatientsRoute } from "../../src/app/api/patients/route";
import { POST as postSyncRoute } from "../../src/app/api/sync/route";
import { POST as postSummaryRoute } from "../../src/app/api/cases/[id]/summary/route";
import { POST as postInterviewsRoute } from "../../src/app/api/interviews/route";
import {
  createInterviewSession,
  submitInterviewAnswer,
  compileInterviewToCase,
} from "../../src/features/interview/interview-service";
import { getEnvConfig, ConfigurationError } from "../../src/config/env";
import { mockDb } from "../../src/lib/db/mock-adapter";

describe("Remediation Verification Gates (A01 - A18 Audit Invariants)", () => {
  const hydClinician: AuthUser = {
    id: "usr-doc-hyd",
    email: "hyd.doctor@medkit.ai",
    fullName: "Dr. Hyderabad Clinician",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const tirClinician: AuthUser = {
    id: "usr-doc-tir",
    email: "tir.doctor@medkit.ai",
    fullName: "Dr. Tirupati Clinician",
    role: "doctor",
    facilityId: "fac-tir-01",
  };

  const validPatientId = "11111111-1111-4111-8111-111111111111"; // Hyderabad facility patient

  it("Gate 1 (A02): rejects unassigned clinician with null facilityId from accessing patient records with 403", async () => {
    const unassignedClinician: AuthUser = {
      id: "usr-unassigned",
      email: "unassigned@medkit.ai",
      fullName: "Dr. Unassigned",
      role: "clinician",
      facilityId: null,
    };
    const token = signSessionToken(unassignedClinician);
    const req = new Request("http://localhost:3000/api/patients", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await getPatientsRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Clinician must be assigned to an active facility");
  });

  it("Gate 1 (A03, A09): rejects cross-facility document sync update without patientId fail-closed", async () => {
    const token = signSessionToken(tirClinician); // Tirupati clinician accessing Hyderabad document
    const itemId = crypto.randomUUID();
    const req = new Request("http://localhost:3000/api/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: itemId,
            idempotencyKey: `idemp-sync-doc-${Date.now()}`,
            entity: "documents",
            action: "update",
            payload: {
              id: "doc-0001", // Hyderabad patient document
              extracted_data: { unauthorized: true },
            },
            timestamp: new Date().toISOString(),
            retryCount: 0,
            syncStatus: "pending",
          },
        ],
      }),
    });
    const res = await postSyncRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Cross-facility update must be reported in failed array and not in succeeded
    expect(body.succeeded).not.toContain(itemId);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0].error).toContain("FACILITY_ACCESS_DENIED");
  });

  it("Gate 2 (A04): rejects in-place overwrite of finalized summary with 409, requiring addenda", async () => {
    const finalizedCase = await mockDb.createCase({
      patient_id: validPatientId,
      case_type: "general",
      patient_language: "en",
      status: "final",
      chief_complaint: "Original complaint",
      assessment_plan: { summary: "Existing immutable summary", plan: "Existing management plan" },
    });

    const token = signSessionToken(hydClinician);
    const req = new Request(`http://localhost:3000/api/cases/${finalizedCase.id}/summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        regenerate: true,
        reason: "Unauthorized attempt to rewrite finalized summary",
      }),
    });
    const res = await postSummaryRoute(req, {
      params: Promise.resolve({ id: finalizedCase.id }),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("cannot be overwritten in place");
  });

  it("Gate 2 (A05, A08): rejects empty unauthenticated kiosk requests with 400 without fabricating DOB or consent", async () => {
    const req = new Request("http://localhost:3000/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await postInterviewsRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Kiosk intake requires explicit initialization");
  });

  it("Gate 2 (A05): repeated kiosk compilation returns existing case idempotently; intake without complaint rejected", async () => {
    // 1. Incomplete intake session without complaint must be rejected
    const session = await createInterviewSession(validPatientId, "en");
    await expect(compileInterviewToCase(session.id)).rejects.toThrow(/INCOMPLETE_INTAKE/);

    // 2. Add complaint answer
    submitInterviewAnswer(session.id, "Severe joint pain and morning stiffness for 3 months", "text");

    // First compilation produces a case
    const case1 = await compileInterviewToCase(session.id);
    expect(case1).toBeDefined();
    expect(case1.id).toBeDefined();
    expect(case1.chief_complaint).toContain("joint pain");

    // Second compilation on the exact same session returns the existing case idempotently
    const case2 = await compileInterviewToCase(session.id);
    expect(case2.id).toBe(case1.id);
  });

  it("Gate 2 (A07): throws ConfigurationError on invalid configuration without falling back to demo mode", () => {
    expect(() => {
      getEnvConfig({
        LOG_LEVEL: "invalid_log_level_value" as any,
      });
    }).toThrow(ConfigurationError);
  });

  it("Gate 1 (A03): creates exactly one case when concurrent sync mutations use the same idempotency key", async () => {
    const token = signSessionToken(hydClinician);
    const idempotencyKey = `idemp-concurrent-test-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    const uniqueComplaint = `Acute abdominal distress ${Date.now()}`;

    const makeReq = () =>
      new Request("http://localhost:3000/api/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: crypto.randomUUID(),
              idempotencyKey,
              entity: "cases",
              action: "create",
              payload: {
                patient_id: validPatientId,
                chief_complaint: uniqueComplaint,
                facility_id: "fac-hyd-01",
              },
              timestamp: new Date().toISOString(),
              retryCount: 0,
              syncStatus: "pending",
            },
          ],
        }),
      });

    // Execute 5 concurrent identical sync mutations
    const responses = await Promise.all([
      postSyncRoute(makeReq()),
      postSyncRoute(makeReq()),
      postSyncRoute(makeReq()),
      postSyncRoute(makeReq()),
      postSyncRoute(makeReq()),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    // Verify in the persistent store that exactly one case was created with this unique complaint
    const allCases = await mockDb.getCasesByPatientId(validPatientId);
    const createdCases = allCases.filter((c) => c.chief_complaint === uniqueComplaint);
    expect(createdCases.length).toBe(1);
  });
});
