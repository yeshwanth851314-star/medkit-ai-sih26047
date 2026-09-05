import { describe, it, expect } from "vitest";
import {
  buildPatientTimeline,
  compareConsecutiveVisits,
} from "../../src/features/timeline/timeline-service";

describe("Phase 5: Records & Clinical Timeline Tests", () => {
  const rameshPatientId = "11111111-1111-4111-8111-111111111111"; // Multi-visit patient
  const singleVisitPatientId = "22222222-2222-4222-8222-222222222222"; // Cardiac red flag patient

  it("builds chronologically ordered patient timeline with encounters and documents", async () => {
    const milestones = await buildPatientTimeline(rameshPatientId);
    expect(milestones.length).toBeGreaterThanOrEqual(3);

    // Verify reverse chronological ordering
    for (let i = 0; i < milestones.length - 1; i++) {
      const current = new Date(milestones[i].timestamp).getTime();
      const next = new Date(milestones[i + 1].timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }

    // Verify presence of encounter and document types
    const types = milestones.map((m) => m.type);
    expect(types).toContain("encounter");
    expect(types).toContain("document");
  });

  it("generates red-flag milestone when clinical case contains potential red flags", async () => {
    const milestones = await buildPatientTimeline(singleVisitPatientId);
    const redFlagMilestone = milestones.find((m) => m.type === "red_flag");

    expect(redFlagMilestone).toBeDefined();
    expect(redFlagMilestone?.badgeText).toBe("CRITICAL");
    expect(redFlagMilestone?.subtitle).toContain("acute crushing chest pain");
  });

  it("correctly compares consecutive visits and calculates medication deltas", async () => {
    const comparison = await compareConsecutiveVisits(rameshPatientId);

    expect(comparison).not.toBeNull();
    expect(comparison?.hasPreviousVisit).toBe(true);
    expect(comparison?.previousComplaint).toContain("Persistent dry cough for 2 weeks");
    expect(comparison?.currentComplaint).toContain("Cough has worsened, now productive");

    // Medication delta checking
    const medNames = comparison?.medicationChanges.map((m) => m.name);
    expect(medNames).toContain("Paracetamol 650mg");

    const paracetamolDelta = comparison?.medicationChanges.find((m) => m.name === "Paracetamol 650mg");
    expect(paracetamolDelta?.status).toBe("added");
  });

  it("handles patients with only a single visit gracefully", async () => {
    const comparison = await compareConsecutiveVisits(singleVisitPatientId);

    expect(comparison).not.toBeNull();
    expect(comparison?.hasPreviousVisit).toBe(false);
    expect(comparison?.currentComplaint).toContain("Severe crushing retrosternal chest pain");
  });
});
