import { describe, it, expect } from "vitest";
import { evaluateClinicalRedFlags, CLINICAL_RED_FLAG_RULES } from "../../src/features/red-flags/rules-engine";

describe("Phase 9: Red-Flag Engine & Safety Rules Tests", () => {
  it("contains 4 versioned deterministic clinical rules", () => {
    expect(CLINICAL_RED_FLAG_RULES.length).toBe(4);
    for (const rule of CLINICAL_RED_FLAG_RULES) {
      expect(rule.id).toBeDefined();
      expect(rule.version).toBe("1.0");
      expect(rule.message).toContain("Potential red flag detected");
      expect(rule.message.toLowerCase()).toContain("immediate clinical assessment recommended");
    }
  });

  it("triggers acute coronary rule on crushing chest pain with radiation and sweating", () => {
    const alerts = evaluateClinicalRedFlags({
      chiefComplaint: "Severe crushing retrosternal chest pain for 45 minutes",
      hpi: {
        radiation: "Left shoulder and jaw",
        associated_symptoms: ["profuse cold sweating", "nausea"],
      },
    });

    expect(alerts.length).toBe(1);
    expect(alerts[0].ruleId).toBe("RED_FLAG_ACUTE_CHEST_PAIN");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].message).toContain("Potential red flag detected");
  });

  it("triggers acute stroke rule on sudden onset focal neurological deficits", () => {
    const alerts = evaluateClinicalRedFlags({
      chiefComplaint: "Sudden onset of facial droop and slurred speech",
      hpi: {
        onset: "Sudden onset 30 minutes ago",
      },
    });

    expect(alerts.length).toBe(1);
    expect(alerts[0].ruleId).toBe("RED_FLAG_ACUTE_NEURO_DEFICIT");
    expect(alerts[0].severity).toBe("critical");
  });

  it("triggers acute anaphylaxis rule on sudden throat and lip swelling", () => {
    const alerts = evaluateClinicalRedFlags({
      chiefComplaint: "Throat swelling and difficulty breathing after antibiotic dose",
      hpi: {
        associated_symptoms: ["urticaria hives", "wheeze"],
      },
    });

    expect(alerts.length).toBe(1);
    expect(alerts[0].ruleId).toBe("RED_FLAG_ANAPHYLAXIS");
  });

  it("does NOT falsely trigger red flags on benign clinical complaints", () => {
    const alerts = evaluateClinicalRedFlags({
      chiefComplaint: "Mild seasonal dry cough for 5 days with throat tickle",
      hpi: {
        onset: "Gradual",
        duration: "5 days",
        denies: ["chest pain", "breathlessness", "fever"],
      },
    });

    expect(alerts.length).toBe(0);
  });
});
