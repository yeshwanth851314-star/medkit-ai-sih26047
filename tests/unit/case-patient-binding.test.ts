import { describe, it, expect, beforeEach } from "vitest";
import { createCaseDraft } from "@/features/cases/case-service";
import { registerPatient } from "@/features/patients/patient-service";
import { AuthUser } from "@/features/auth/types";
import { mockDb } from "@/lib/db/mock-adapter";

describe("Phase C: Case to Patient Explicit Binding & Facility Invariants", () => {
  const mockDoctorDelhi: AuthUser = {
    id: "77777777-7777-4777-8777-777777777771",
    fullName: "Dr. Delhi Clinician",
    email: "doctor.delhi@medkit.ai",
    role: "doctor",
    facilityId: "fac-delhi-01",
    aal: "aal2",
  };

  const mockDoctorGoa: AuthUser = {
    id: "77777777-7777-4777-8777-777777777772",
    fullName: "Dr. Goa Clinician",
    email: "doctor.goa@medkit.ai",
    role: "doctor",
    facilityId: "fac-goa-01",
    aal: "aal2",
  };

  let patientDelhiId: string;
  let patientGoaId: string;

  beforeEach(async () => {
    mockDb.clearAll();

    const pDelhi = await registerPatient(
      {
        fullName: "Delhi Resident",
        phone: "+91-9811199999",
      },
      { actor: mockDoctorDelhi }
    );
    patientDelhiId = pDelhi.patient.id;

    const pGoa = await registerPatient(
      {
        fullName: "Goa Resident",
        phone: "+91-9822299999",
      },
      { actor: mockDoctorGoa }
    );
    patientGoaId = pGoa.patient.id;
  });

  it("successfully binds clinical case to explicit patient and attaches facility_id", async () => {
    const draft = await createCaseDraft(
      {
        patientId: patientDelhiId,
        chiefComplaint: "Acute migraine with visual aura",
      },
      mockDoctorDelhi.id,
      mockDoctorDelhi
    );

    expect(draft.id).toBeDefined();
    expect(draft.patient_id).toBe(patientDelhiId);
    expect(draft.facility_id).toBe("fac-delhi-01");
    expect(draft.status).toBe("draft");
    expect(draft.chief_complaint).toBe("Acute migraine with visual aura");
  });

  it("rejects case creation when patientId is missing or empty string", async () => {
    await expect(
      createCaseDraft(
        {
          patientId: "",
          chiefComplaint: "Severe fever",
        },
        mockDoctorDelhi.id,
        mockDoctorDelhi
      )
    ).rejects.toThrow(/PATIENT_REQUIRED/);

    await expect(
      createCaseDraft(
        {
          patientId: null as any,
          chiefComplaint: "Severe fever",
        },
        mockDoctorDelhi.id,
        mockDoctorDelhi
      )
    ).rejects.toThrow(/PATIENT_REQUIRED/);
  });

  it("rejects case creation when patientId does not exist in records", async () => {
    const randomId = "00000000-0000-4000-8000-000000000999";
    await expect(
      createCaseDraft(
        {
          patientId: randomId,
          chiefComplaint: "Persistent dry cough",
        },
        mockDoctorDelhi.id,
        mockDoctorDelhi
      )
    ).rejects.toThrow(/PATIENT_NOT_FOUND/);
  });

  it("rejects case creation when doctor attempts to bind case to patient in another facility", async () => {
    // Doctor Delhi attempts to create case for Patient in Goa
    // In mock/db and object-guard, cross-facility patient lookup returns null or raises boundary check
    await expect(
      createCaseDraft(
        {
          patientId: patientGoaId,
          chiefComplaint: "Cross-facility case attempt",
        },
        mockDoctorDelhi.id,
        mockDoctorDelhi
      )
    ).rejects.toThrow();
  });
});
