import { describe, it, expect } from "vitest";
import {
  generatePatientCode,
  registerPatient,
  searchPatients,
  getPatientsPage,
  checkDuplicatePatient,
  getPatientDetails,
} from "../../src/features/patients/patient-service";

describe("Phase 3: Patient Management Tests", () => {
  it("generates correctly formatted human-readable patient code", () => {
    const code = generatePatientCode();
    expect(code).toMatch(/^MED-2026-\d{4}$/);
  });

  it("searches patients by full name", async () => {
    const results = await searchPatients("Ramesh");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].full_name).toContain("Ramesh");
  });

  it("searches patients by patient code", async () => {
    const results = await searchPatients("MED-2026-0002");
    expect(results.length).toBe(1);
    expect(results[0].full_name).toBe("Lakshmi Narayana Rao");
  });

  it("detects duplicate patient suspicion based on matching phone", async () => {
    const duplicateCheck = await checkDuplicatePatient({
      fullName: "Ramesh Sharma",
      phone: "+91-98765-00001", // Matches Ramesh Kumar Varma in synthetic fixtures
      gender: "Male",
      bloodGroup: "Unknown",
    });

    expect(duplicateCheck.isDuplicateSuspect).toBe(true);
    expect(duplicateCheck.reason).toBe("matching_phone");
    expect(duplicateCheck.matchedPatientCode).toBe("MED-2026-0001");
  });

  it("detects duplicate patient suspicion based on matching name and DOB", async () => {
    const duplicateCheck = await checkDuplicatePatient({
      fullName: "Lakshmi Narayana Rao",
      dateOfBirth: "1964-11-20",
      phone: "+91-99999-99999", // Different phone, but exact name + DOB match
      gender: "Male",
      bloodGroup: "Unknown",
    });

    expect(duplicateCheck.isDuplicateSuspect).toBe(true);
    expect(duplicateCheck.reason).toBe("matching_name_and_dob");
    expect(duplicateCheck.matchedPatientCode).toBe("MED-2026-0002");
  });

  it("successfully registers a new unique patient", async () => {
    const result = await registerPatient({
      fullName: "Sita Mahalakshmi",
      dateOfBirth: "1988-08-15",
      gender: "Female",
      phone: "+91-91234-56789",
      bloodGroup: "O+",
      address: "Tirupati, Andhra Pradesh",
    });

    expect(result.duplicateWarning).toBeUndefined();
    expect(result.patient).toBeDefined();
    expect(result.patient.full_name).toBe("Sita Mahalakshmi");
    expect(result.patient.patient_code).toMatch(/^MED-2026-\d{4}$/);

    const fetched = await getPatientDetails(result.patient.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.patient_code).toBe(result.patient.patient_code);
  });

  describe("Bounded Server-Side Patient Pagination", () => {
    it("returns bounded slice when pageSize is specified (pageSize=25 returns <=25)", async () => {
      const pageResult = await getPatientsPage({ page: 1, pageSize: 25 });
      expect(pageResult.patients.length).toBeLessThanOrEqual(25);
      expect(pageResult.page).toBe(1);
      expect(pageResult.pageSize).toBe(25);
      expect(pageResult.total).toBeGreaterThanOrEqual(1);
      expect(pageResult.totalPages).toBeGreaterThanOrEqual(1);
    });

    it("returns different bounded slice for page 2 when records exceed pageSize", async () => {
      // Use pageSize=1 to test multiple pages deterministically on synthetic dataset
      const page1 = await getPatientsPage({ page: 1, pageSize: 1 });
      const page2 = await getPatientsPage({ page: 2, pageSize: 1 });

      expect(page1.patients.length).toBe(1);
      expect(page2.patients.length).toBe(1);
      expect(page1.patients[0].id).not.toBe(page2.patients[0].id);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
    });

    it("applies pagination strictly to searched set (search + page)", async () => {
      const allRamesh = await searchPatients("Ramesh");
      const pagedRamesh = await getPatientsPage({ searchQuery: "Ramesh", page: 1, pageSize: 10 });

      expect(pagedRamesh.total).toBe(allRamesh.length);
      expect(pagedRamesh.patients.length).toBe(allRamesh.length);
      pagedRamesh.patients.forEach((p) => {
        expect(p.full_name.toLowerCase()).toContain("ramesh");
      });
    });

    it("caps pageSize at maximum 100 when client requests excessive size", async () => {
      const capped = await getPatientsPage({ page: 1, pageSize: 500 });
      expect(capped.pageSize).toBe(100);
    });

    it("normalizes invalid or negative page numbers safely to 1", async () => {
      const normalizedNegative = await getPatientsPage({ page: -5, pageSize: 25 });
      expect(normalizedNegative.page).toBe(1);

      const normalizedZero = await getPatientsPage({ page: 0, pageSize: 25 });
      expect(normalizedZero.page).toBe(1);
    });

    it("strictly isolates cross-facility patient records for non-admin actors", async () => {
      const hydClinician = {
        id: "usr-doc-001",
        fullName: "Dr. Hyderabad Doc",
        role: "doctor" as const,
        facilityId: "fac-hyd-01",
        email: "hyd.doc@medkit.ai",
      };

      const result = await getPatientsPage({ page: 1, pageSize: 50 }, hydClinician);
      // All returned patients must match the caller's facility
      result.patients.forEach((p) => {
        expect(p.facility_id).toBe("fac-hyd-01");
      });
    });
  });
});
