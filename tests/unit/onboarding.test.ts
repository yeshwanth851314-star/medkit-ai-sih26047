import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasCompletedDoctorOnboarding,
  completeDoctorOnboarding,
  resetDoctorOnboarding,
  hasCompletedKioskOnboarding,
  completeKioskOnboarding,
  resetKioskOnboarding,
  triggerDoctorTourReplay,
  DOCTOR_ONBOARDING_KEY,
  KIOSK_ONBOARDING_KEY,
  REPLAY_TOUR_EVENT,
} from "../../src/lib/onboarding/onboarding-state";
import { HELP_TOPICS } from "../../src/components/help/contextual-help";

// Setup mock browser globals for Node test environment
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => { storage.set(key, String(val)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

const listeners = new Map<string, Array<(e: any) => void>>();
const mockWindow = {
  localStorage: localStorageMock,
  addEventListener: (event: string, cb: any) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event)!.push(cb);
  },
  removeEventListener: (event: string, cb: any) => {
    const list = listeners.get(event);
    if (list) {
      listeners.set(event, list.filter(fn => fn !== cb));
    }
  },
  dispatchEvent: (e: any) => {
    const list = listeners.get(e.type);
    if (list) {
      list.forEach(fn => fn(e));
    }
    return true;
  },
};

(globalThis as any).window = mockWindow;
(globalThis as any).CustomEvent = class {
  type: string;
  detail?: any;
  constructor(type: string, opts?: any) {
    this.type = type;
    this.detail = opts?.detail;
  }
};

describe("Lightweight Client Onboarding & Help System", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
    vi.restoreAllMocks();
  });

  describe("Doctor Onboarding State", () => {
    it("reports incomplete when preference key is missing (first-time login)", () => {
      expect(hasCompletedDoctorOnboarding()).toBe(false);
    });

    it("stores completion when doctor finishes or skips the tour", () => {
      completeDoctorOnboarding();
      expect(window.localStorage.getItem(DOCTOR_ONBOARDING_KEY)).toBe("true");
      expect(hasCompletedDoctorOnboarding()).toBe(true);
    });

    it("does not auto-appear once completion is recorded", () => {
      completeDoctorOnboarding();
      expect(hasCompletedDoctorOnboarding()).toBe(true);
    });

    it("resets completion status when resetDoctorOnboarding is called", () => {
      completeDoctorOnboarding();
      expect(hasCompletedDoctorOnboarding()).toBe(true);
      resetDoctorOnboarding();
      expect(hasCompletedDoctorOnboarding()).toBe(false);
    });

    it("dispatches REPLAY_TOUR_EVENT window event when triggerDoctorTourReplay is invoked", () => {
      let eventFired = false;
      const handler = () => {
        eventFired = true;
      };
      window.addEventListener(REPLAY_TOUR_EVENT, handler);

      triggerDoctorTourReplay();

      expect(eventFired).toBe(true);
      window.removeEventListener(REPLAY_TOUR_EVENT, handler);
    });
  });

  describe("Patient Kiosk Onboarding State", () => {
    it("reports incomplete on first patient arrival", () => {
      expect(hasCompletedKioskOnboarding()).toBe(false);
    });

    it("stores completion when patient starts or skips intro", () => {
      completeKioskOnboarding();
      expect(window.localStorage.getItem(KIOSK_ONBOARDING_KEY)).toBe("true");
      expect(hasCompletedKioskOnboarding()).toBe(true);
    });

    it("resets kiosk completion cleanly", () => {
      completeKioskOnboarding();
      expect(hasCompletedKioskOnboarding()).toBe(true);
      resetKioskOnboarding();
      expect(hasCompletedKioskOnboarding()).toBe(false);
    });
  });

  describe("Clinical Contextual Help System", () => {
    it("provides accurate definition and clinical safety note for What Changed", () => {
      const whatChanged = HELP_TOPICS.what_changed;
      expect(whatChanged).toBeDefined();
      expect(whatChanged.label).toContain("What Changed");
      expect(whatChanged.explanation.toLowerCase()).toContain("previous encounters");
      expect(whatChanged.note).toContain("Signature longitudinal");
    });

    it("provides accurate provenance taxonomy and explanation", () => {
      const prov = HELP_TOPICS.provenance;
      expect(prov).toBeDefined();
      expect(prov.examples).toContain("Patient-reported");
      expect(prov.examples).toContain("Clinician-entered");
      expect(prov.examples).toContain("Document-extracted");
      expect(prov.examples).toContain("AI-generated");
    });

    it("emphasizes strict non-diagnostic boundary in red-flag help", () => {
      const rf = HELP_TOPICS.red_flags;
      expect(rf).toBeDefined();
      expect(rf.explanation).toContain("deterministic and non-diagnostic");
      expect(rf.note).toContain("Non-diagnostic alert");
    });

    it("emphasizes clinician supremacy in AI summary help", () => {
      const summary = HELP_TOPICS.summary;
      expect(summary).toBeDefined();
      expect(summary.note).toBe("AI assists. The clinician decides.");
    });

    it("explains FHIR R4 and ABDM integration readiness accurately", () => {
      const fhir = HELP_TOPICS.fhir;
      expect(fhir).toBeDefined();
      expect(fhir.explanation).toContain("FHIR R4-compatible");
      expect(fhir.explanation).toContain("ABDM integration-ready");
    });

    it("explains case addenda and record immutability", () => {
      const addendum = HELP_TOPICS.addendum;
      expect(addendum).toBeDefined();
      expect(addendum.explanation).toContain("without silently changing the original");
      expect(addendum.note).toContain("Finalized records are immutable");
    });
  });
});
