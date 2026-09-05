import { describe, it, expect } from "vitest";
import { getEnvConfig } from "../../src/config/env";
import { mockDb } from "../../src/lib/db/mock-adapter";
import { cn, formatDate } from "../../src/lib/utils";

describe("Phase 1: Foundation Tests", () => {
  it("validates default environment configuration cleanly", () => {
    const config = getEnvConfig();
    expect(config.appName).toBe("MedKit AI");
    expect(config.appVersion).toBe("1.0.0");
    expect(config.isDemoMode).toBe(true);
  });

  it("merges Tailwind classes correctly with cn()", () => {
    const result = cn("px-2 py-1", "px-4", { "text-red-500": true, "text-blue-500": false });
    expect(result).toBe("py-1 px-4 text-red-500");
  });

  it("formats dates into Indian locale correctly", () => {
    const formatted = formatDate("2026-09-06T10:00:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Sep");
  });

  it("loads synthetic patients into mock database correctly", async () => {
    const patients = await mockDb.getPatients();
    expect(patients.length).toBeGreaterThanOrEqual(3);

    const ramesh = await mockDb.getPatientByCode("MED-2026-0001");
    expect(ramesh).toBeDefined();
    expect(ramesh?.full_name).toBe("Ramesh Kumar Varma");
  });

  it("loads synthetic cases with structured HPI and red flags", async () => {
    const cases = await mockDb.getCasesByPatientId("22222222-2222-4222-8222-222222222222");
    expect(cases.length).toBeGreaterThanOrEqual(1);

    const cardiacCase = cases[0];
    expect(cardiacCase.chief_complaint).toContain("chest pain");
    expect(cardiacCase.red_flags).toBeDefined();
    expect(cardiacCase.red_flags?.[0].rule_id).toBe("RED_FLAG_ACUTE_CHEST_PAIN");
  });
});
