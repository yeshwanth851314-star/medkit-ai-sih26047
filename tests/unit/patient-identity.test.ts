import { describe, it, expect, beforeEach } from "vitest";
import {
  registerPatient,
  checkDuplicatePatient,
  normalizePhoneNumber,
} from "@/features/patients/patient-service";
import { AuthUser } from "@/features/auth/types";
import { mockDb } from "@/lib/db/mock-adapter";

describe("Phase C: Patient Identity & Duplicate Detection", () => {
  const mockDoctorDelhi: AuthUser = {
    id: "99999999-9999-4999-8999-999999999991",
    fullName: "Dr. Delhi Clinician",
    email: "doctor.delhi@medkit.ai",
    role: "doctor",
    facilityId: "fac-delhi-01",
    aal: "aal2",
  };

  const mockDoctorGoa: AuthUser = {
    id: "99999999-9999-4999-8999-999999999992",
    fullName: "Dr. Goa Clinician",
    email: "doctor.goa@medkit.ai",
    role: "doctor",
    facilityId: "fac-goa-01",
    aal: "aal2",
  };

  beforeEach(() => {
    mockDb.clearAll();
  });

  describe("C1: Canonical Patient Identity Model", () => {
    it("creates a patient with exact date of birth and facility assignment", async () => {
      const result = await registerPatient(
        {
          fullName: "Aarav Sharma",
          dateOfBirth: "1985-05-15",
          gender: "Male",
          phone: "+91-9876543210",
        },
        { actor: mockDoctorDelhi }
      );

      expect(result.patient).toBeDefined();
      expect(result.patient.id).toBeDefined();
      expect(result.patient.facility_id).toBe("fac-delhi-01");
      expect(result.patient.full_name).toBe("Aarav Sharma");
      expect(result.patient.date_of_birth).toBe("1985-05-15");
      expect(result.patient.identity_status).toBe("UNVERIFIED");
    });

    it("creates a patient with estimated age when exact DOB is unknown", async () => {
      const result = await registerPatient(
        {
          fullName: "Kavita Devi",
          dateOfBirth: null,
          ageEstimate: 42,
          gender: "Female",
          phone: "+91-9876500000",
        },
        { actor: mockDoctorDelhi }
      );

      expect(result.patient).toBeDefined();
      expect(result.patient.date_of_birth).toBeNull();
      expect(result.patient.age_estimate).toBe(42);
      expect(result.patient.facility_id).toBe("fac-delhi-01");
    });

    it("registers patient normally when ABHA is absent (ABHA is optional)", async () => {
      const result = await registerPatient(
        {
          fullName: "Rohan Verma",
          gender: "Male",
          phone: "+91-9811122233",
        },
        { actor: mockDoctorDelhi }
      );

      expect(result.patient).toBeDefined();
      expect(result.patient.abha_id).toBeNull();
      expect(result.patient.identity_status).toBe("UNVERIFIED");
    });

    it("links ABHA identifier and sets identity_status to ABHA_LINKED when provided", async () => {
      const result = await registerPatient(
        {
          fullName: "Dr. Ananya Rao",
          gender: "Female",
          phone: "+91-9822233344",
          abhaId: "12-3456-7890-1234",
        },
        { actor: mockDoctorDelhi }
      );

      expect(result.patient).toBeDefined();
      expect(result.patient.abha_id).toBe("12-3456-7890-1234");
      expect(result.patient.identity_status).toBe("ABHA_LINKED");
    });
  });

  describe("C4: Deterministic Duplicate Detection", () => {
    it("detects exact MRN collision within the same facility as IDENTIFIER_CONFLICT", async () => {
      await registerPatient(
        {
          fullName: "Existing Patient",
          facilityMrn: "MRN-DELHI-101",
          phone: "+91-9811100001",
        },
        { actor: mockDoctorDelhi }
      );

      // Attempting to register another patient with the exact same facility MRN
      await expect(
        registerPatient(
          {
            fullName: "Another Patient",
            facilityMrn: "MRN-DELHI-101",
            phone: "+91-9811100002",
          },
          { actor: mockDoctorDelhi }
        )
      ).rejects.toThrow(/IDENTIFIER_CONFLICT/);
    });

    it("flags normalized phone match as POSSIBLE_MATCH candidate without auto-merging", async () => {
      await registerPatient(
        {
          fullName: "Sunita Patel",
          dateOfBirth: "1978-02-20",
          phone: "+91-9899988877",
        },
        { actor: mockDoctorDelhi }
      );

      // Same phone (e.g. family member or duplicate entry) with different name
      const check = await checkDuplicatePatient(
        {
          fullName: "Rahul Patel",
          phone: "9899988877",
        },
        mockDoctorDelhi,
        "fac-delhi-01"
      );

      expect(check.isDuplicateSuspect).toBe(true);
      expect(check.matchConfidence).toBe("POSSIBLE_MATCH");
      expect(check.candidates).toBeDefined();
      expect(check.candidates!.length).toBeGreaterThan(0);
      expect(check.matchedName).toBe("Sunita Patel");

      // Attempting to register without ignoring warning returns duplicate warning early
      const reg = await registerPatient(
        {
          fullName: "Rahul Patel",
          phone: "9899988877",
        },
        { actor: mockDoctorDelhi }
      );

      expect(reg.patient).toBeNull();
      expect(reg.duplicateWarning).toBeDefined();
      expect(reg.duplicateWarning!.isDuplicateSuspect).toBe(true);

      // Invariant: Patient count must still be 1 for fac-delhi-01 (NO auto-merge, NO accidental creation)
      const allPatients = (await mockDb.getPatients()).filter((p) => p.facility_id === "fac-delhi-01");
      expect(allPatients.length).toBe(1);
    });

    it("flags matching name and DOB within same facility as POSSIBLE_MATCH candidate", async () => {
      await registerPatient(
        {
          fullName: "Deepak Chopra",
          dateOfBirth: "1990-11-12",
          phone: "+91-9871112233",
        },
        { actor: mockDoctorDelhi }
      );

      const check = await checkDuplicatePatient(
        {
          fullName: "deepak chopra",
          dateOfBirth: "1990-11-12",
          phone: "+91-9879998888", // different phone
        },
        mockDoctorDelhi,
        "fac-delhi-01"
      );

      expect(check.isDuplicateSuspect).toBe(true);
      expect(check.matchConfidence).toBe("POSSIBLE_MATCH");
    });
  });

  describe("C5: Facility Boundary Isolation", () => {
    it("derives facility strictly from authenticated clinician profile and rejects untrusted facility inputs", async () => {
      const result = await registerPatient(
        {
          fullName: "Pooja Reddy",
          phone: "+91-9988776655",
          // Untrusted client attempt to inject different facility
          ...({ facilityId: "fac-rogue-99" } as any),
        },
        { actor: mockDoctorDelhi }
      );

      // Server enforces doctor's facility
      expect(result.patient.facility_id).toBe("fac-delhi-01");
      expect(result.patient.facility_id).not.toBe("fac-rogue-99");
    });

    it("does not report duplicates across different facilities for ordinary local phone reuse", async () => {
      await registerPatient(
        {
          fullName: "Pooja Reddy",
          phone: "+91-9988776655",
        },
        { actor: mockDoctorDelhi }
      );

      // Clinician in Goa registers patient with same phone
      const checkGoa = await checkDuplicatePatient(
        {
          fullName: "Pooja Reddy",
          phone: "+91-9988776655",
        },
        mockDoctorGoa,
        "fac-goa-01"
      );

      // In the facility-scoped query, Goa facility has no duplicates
      expect(checkGoa.isDuplicateSuspect).toBe(false);
    });
  });

  describe("Normalization Helpers", () => {
    it("normalizes phone numbers to digits only", () => {
      expect(normalizePhoneNumber("+91-98765-43210")).toBe("919876543210");
      expect(normalizePhoneNumber("  98765 43210  ")).toBe("9876543210");
      expect(normalizePhoneNumber("")).toBe("");
      expect(normalizePhoneNumber(null)).toBe("");
    });
  });
});
