import { describe, it, expect } from "vitest";
import {
  createCaseDraft,
  updateCaseDraft,
  finalizeCase,
  getCaseDetails,
  getPatientCases,
} from "../../src/features/cases/case-service";

describe("Phase 4: Case-Taking MVP Tests", () => {
  const testPatientId = "11111111-1111-4111-8111-111111111111";

  it("creates a new case draft with valid chief complaint and HPI", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Severe migraine headache with photophobia for 2 days",
      hpi: {
        onset: "2 days ago",
        duration: "48 hours",
        character: "Throbbing, unilateral",
        severity: "Severe",
      },
      status: "draft",
    });

    expect(draft).toBeDefined();
    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("draft");
    expect(draft.chief_complaint).toContain("migraine");
    expect(draft.finalized_at).toBeNull();
  });

  it("updates an existing draft case and preserves unedited fields", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Generalized weakness and fatigue",
      status: "draft",
    });

    const updated = await updateCaseDraft(draft.id, {
      examination: {
        blood_pressure: "110/70",
        pulse: "68",
      },
    });

    expect(updated.chief_complaint).toBe("Generalized weakness and fatigue");
    expect(updated.examination?.blood_pressure).toBe("110/70");
    expect(updated.status).toBe("draft");
  });

  it("finalizes a draft case and stamps finalized_at", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Acute gastroenteritis with loose stools and nausea",
      status: "draft",
    });

    const finalized = await finalizeCase(draft.id, "usr-doc-0001");
    expect(finalized.status).toBe("final");
    expect(finalized.finalized_at).not.toBeNull();
  });

  it("prevents direct mutation of finalized cases (safety guardrail)", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Confirmed allergic dermatitis",
      status: "draft",
    });

    await finalizeCase(draft.id);

    // Attempting to update finalized case must throw CANNOT_MUTATE_FINAL
    await expect(
      updateCaseDraft(draft.id, { chiefComplaint: "Tampered diagnosis" })
    ).rejects.toThrow("CANNOT_MUTATE_FINAL");
  });

  it("retrieves cases by patient ID in reverse chronological order", async () => {
    const cases = await getPatientCases(testPatientId);
    expect(cases.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < cases.length - 1; i++) {
      const currentTime = new Date(cases[i].created_at).getTime();
      const nextTime = new Date(cases[i + 1].created_at).getTime();
      expect(currentTime).toBeGreaterThanOrEqual(nextTime);
    }
  });
});
