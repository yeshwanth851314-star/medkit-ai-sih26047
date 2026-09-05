import { describe, it, expect } from "vitest";
import {
  attachAyushAssessmentToCase,
  getDefaultAyushAssessment,
} from "../../src/features/ayush/ayush-service";
import { ayushAssessmentSchema } from "../../src/features/ayush/types";
import { createCaseDraft, finalizeCase } from "../../src/features/cases/case-service";

describe("Phase 11: AYUSH Mode & Dashavidha Pariksha Tests", () => {
  const testPatientId = "33333333-3333-4333-8333-333333333333";

  it("validates full Dashavidha Pariksha and Ahara-Vihara assessment schema", () => {
    const defaultData = getDefaultAyushAssessment();
    const validated = ayushAssessmentSchema.safeParse(defaultData);

    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(validated.data.prakriti).toBe("Pitta-Vata");
      expect(validated.data.sara).toContain("Madhyama");
      expect(validated.data.ahara_vihara.dietary_habits).toBeDefined();
    }
  });

  it("attaches AYUSH assessment to a case draft and updates case type", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Amlapitta with sour burping and retrosternal burning",
      status: "draft",
    });

    const updated = await attachAyushAssessmentToCase(
      draft.id,
      getDefaultAyushAssessment(),
      "Vaidya Rajesh Sharma, BAMS"
    );

    expect(updated).toBeDefined();
    expect(updated.case_type).toBe("ayush");
    expect(updated.ayush_assessment).toBeDefined();
    expect(updated.ayush_assessment?.prakriti).toBe("Pitta-Vata");
    expect(updated.ayush_assessment?.verifiedBy).toBe("Vaidya Rajesh Sharma, BAMS");
  });

  it("rejects attaching assessment to a finalized case directly", async () => {
    const draft = await createCaseDraft({
      patientId: testPatientId,
      caseType: "general",
      patientLanguage: "en",
      chiefComplaint: "Completed clinical encounter",
      status: "draft",
    });

    await finalizeCase(draft.id);

    await expect(
      attachAyushAssessmentToCase(draft.id, getDefaultAyushAssessment())
    ).rejects.toThrow("CANNOT_MUTATE_FINAL");
  });
});
