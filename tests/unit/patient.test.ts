import { describe, it, expect } from "vitest";
import {
  generatePatientCode,
  registerPatient,
  searchPatients,
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
});
