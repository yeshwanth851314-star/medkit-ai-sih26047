import { describe, it, expect } from "vitest";
import { signSessionToken } from "../../src/lib/auth/jwt";
import { signIntakeCapabilityToken } from "../../src/lib/auth/kiosk-capability";
import { AuthUser } from "../../src/features/auth/types";
import { GET as getDocuments, POST as postDocuments } from "../../src/app/api/documents/route";
import { GET as getCases, POST as postCases } from "../../src/app/api/cases/route";
import { GET as getPatients } from "../../src/app/api/patients/route";
import { POST as postInterviews } from "../../src/app/api/interviews/route";
import { GET as getConsents, POST as postConsents } from "../../src/app/api/consents/route";

describe("Phase 2 & 3: Collection Authorization and Scoped Kiosk Issuance", () => {
  const hydDoctor: AuthUser = {
    id: "usr-doc-0001",
    email: "doctor@medkit.ai",
    fullName: "Dr. Ananya Rao, MD",
    role: "doctor",
    facilityId: "fac-hyd-01",
  };

  const delhiDoctor: AuthUser = {
    id: "usr-doc-delhi",
    email: "delhi.doc@medkit.ai",
    fullName: "Dr. Raj Sharma, MD",
    role: "doctor",
    facilityId: "fac-delhi-99",
  };

  const hydToken = signSessionToken(hydDoctor);
  const delhiToken = signSessionToken(delhiDoctor);
  const validPatientId = "11111111-1111-4111-8111-111111111111"; // Rajesh Kumar in fac-hyd-01
  const validCaseId = "c1111111-1111-4111-8111-111111111111";

  describe("GET & POST /api/documents", () => {
    it("GET /api/documents rejects unauthenticated callers with 401", async () => {
      const req = new Request(`http://localhost:3000/api/documents?patientId=${validPatientId}`);
      const res = await getDocuments(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/documents rejects cross-facility access with 403", async () => {
      const req = new Request(`http://localhost:3000/api/documents?patientId=${validPatientId}`, {
        headers: { Authorization: `Bearer ${delhiToken}` },
      });
      const res = await getDocuments(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/documents succeeds for authorized clinician", async () => {
      const req = new Request(`http://localhost:3000/api/documents?patientId=${validPatientId}`, {
        headers: { Authorization: `Bearer ${hydToken}` },
      });
      const res = await getDocuments(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.documents)).toBe(true);
    });

    it("POST /api/documents rejects mismatching caseId and patientId with 400", async () => {
      const wrongPatientId = "22222222-2222-4222-8222-222222222222";
      const req = new Request("http://localhost:3000/api/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hydToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: wrongPatientId,
          caseId: validCaseId, // Belongs to validPatientId, not wrongPatientId
          fileName: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        }),
      });
      const res = await postDocuments(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET & POST /api/cases", () => {
    it("GET /api/cases rejects request without patientId parameter with 400", async () => {
      const req = new Request("http://localhost:3000/api/cases", {
        headers: { Authorization: `Bearer ${hydToken}` },
      });
      const res = await getCases(req);
      expect(res.status).toBe(400);
    });

    it("GET /api/cases rejects cross-facility request with 403", async () => {
      const req = new Request(`http://localhost:3000/api/cases?patientId=${validPatientId}`, {
        headers: { Authorization: `Bearer ${delhiToken}` },
      });
      const res = await getCases(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/cases returns cases for authorized clinician", async () => {
      const req = new Request(`http://localhost:3000/api/cases?patientId=${validPatientId}`, {
        headers: { Authorization: `Bearer ${hydToken}` },
      });
      const res = await getCases(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.cases)).toBe(true);
    });

    it("POST /api/cases rejects cross-facility creation with 403", async () => {
      const req = new Request("http://localhost:3000/api/cases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${delhiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: validPatientId,
          chiefComplaint: "Acute headache",
        }),
      });
      const res = await postCases(req);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/patients facility boundary", () => {
    it("scopes patient search to authenticated clinician's facility", async () => {
      const req = new Request("http://localhost:3000/api/patients", {
        headers: { Authorization: `Bearer ${hydToken}` },
      });
      const res = await getPatients(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.patients)).toBe(true);
      // None of the returned patients should belong to a different facility
      data.patients.forEach((p: any) => {
        if (p.facility_id) {
          expect(p.facility_id).toBe("fac-hyd-01");
        }
      });
    });
  });

  describe("POST /api/interviews kiosk capability issuance", () => {
    it("rejects unauthenticated callers attempting to bind to arbitrary patient ID with 403", async () => {
      const req = new Request("http://localhost:3000/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: "22222222-2222-4222-8222-222222222222",
        }),
      });
      const res = await postInterviews(req);
      expect(res.status).toBe(403);
    });

    it("rejects kiosk intake when consent acknowledgement is missing or false with 400", async () => {
      const req = new Request("http://localhost:3000/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "te",
          consentAcknowledged: false,
        }),
      });
      const res = await postInterviews(req);
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.error).toContain("CONSENT_REQUIRED");
    });

    it("allows kiosk intake with default or empty patientId and returns scoped intake token", async () => {
      const req = new Request("http://localhost:3000/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "te",
          consentAcknowledged: true,
        }),
      });
      const res = await postInterviews(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBeDefined();
      expect(data.intakeToken).toBeDefined();
    });

    it("allows clinician to bind interview to patient in their facility", async () => {
      const req = new Request("http://localhost:3000/api/interviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hydToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: validPatientId,
          language: "en",
        }),
      });
      const res = await postInterviews(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBeDefined();
      expect(data.intakeToken).toBeDefined();
    });
  });

  describe("GET & POST /api/consents", () => {
    it("GET /api/consents rejects unauthenticated request without token with 401", async () => {
      const req = new Request(`http://localhost:3000/api/consents?patientId=${validPatientId}`);
      const res = await getConsents(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/consents rejects intake token for wrong patient ID with 403", async () => {
      const intakeToken = signIntakeCapabilityToken({
        sessionId: "ses-test-99",
        patientId: "wrong-patient-id",
      });
      const req = new Request(`http://localhost:3000/api/consents?patientId=${validPatientId}`, {
        headers: { "x-intake-token": intakeToken },
      });
      const res = await getConsents(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/consents succeeds with matching intake token", async () => {
      const intakeToken = signIntakeCapabilityToken({
        sessionId: "ses-test-100",
        patientId: validPatientId,
      });
      const req = new Request(`http://localhost:3000/api/consents?patientId=${validPatientId}`, {
        headers: { "x-intake-token": intakeToken },
      });
      const res = await getConsents(req);
      expect(res.status).toBe(200);
    });

    it("POST /api/consents rejects unauthenticated submission without token with 401", async () => {
      const req = new Request("http://localhost:3000/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: validPatientId,
          consentMethod: "touch_acknowledgement",
        }),
      });
      const res = await postConsents(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/consents succeeds with matching intake token having consent:grant scope", async () => {
      const intakeToken = signIntakeCapabilityToken({
        sessionId: "ses-test-101",
        patientId: validPatientId,
        scope: ["consent:grant"],
      });
      const req = new Request("http://localhost:3000/api/consents", {
        method: "POST",
        headers: {
          "x-intake-token": intakeToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: validPatientId,
          consentMethod: "touch_acknowledgement",
        }),
      });
      const res = await postConsents(req);
      expect(res.status).toBe(201);
    });
  });
});
