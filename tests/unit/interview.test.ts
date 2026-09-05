import { describe, it, expect } from "vitest";
import {
  createInterviewSession,
  submitInterviewAnswer,
  compileInterviewToCase,
  getInterviewSession,
} from "../../src/features/interview/interview-service";

describe("Phase 8: Adaptive Question Engine Tests", () => {
  const patientId = "11111111-1111-4111-8111-111111111111";

  it("initializes an interview session with Q_CHIEF_COMPLAINT entry question", () => {
    const session = createInterviewSession(patientId, "en");

    expect(session).toBeDefined();
    expect(session.currentQuestionId).toBe("Q_CHIEF_COMPLAINT");
    expect(session.status).toBe("active");
    expect(session.consentGiven).toBe(true);
  });

  it("branches adaptively to acute cardiac flow on chest pain complaint", () => {
    const session = createInterviewSession(patientId, "en");

    const step1 = submitInterviewAnswer(session.id, "Chest pain / discomfort", "touch");
    expect(step1.nextQuestion).not.toBeNull();
    expect(step1.nextQuestion?.id).toBe("Q_CHEST_ONSET");

    const step2 = submitInterviewAnswer(session.id, "Sudden onset during exertion", "touch");
    expect(step2.nextQuestion?.id).toBe("Q_CHEST_RADIATION");

    const step3 = submitInterviewAnswer(session.id, "Left arm / shoulder and jaw", "touch");
    expect(step3.nextQuestion?.id).toBe("Q_CHEST_ASSOCIATED");
  });

  it("branches adaptively to respiratory flow on cough complaint", () => {
    const session = createInterviewSession(patientId, "en");

    const step1 = submitInterviewAnswer(session.id, "Cough and cold", "touch");
    expect(step1.nextQuestion?.id).toBe("Q_COUGH_TYPE");

    const step2 = submitInterviewAnswer(session.id, "Productive with yellow/green phlegm", "touch");
    expect(step2.nextQuestion?.id).toBe("Q_COUGH_FEVER");
  });

  it("completes interview graph and compiles answers into a structured case draft", async () => {
    const session = createInterviewSession(patientId, "en");

    // Fast-walk to terminal node
    submitInterviewAnswer(session.id, "General weakness", "touch");
    submitInterviewAnswer(session.id, "Started today / yesterday", "touch");
    const finalStep = submitInterviewAnswer(session.id, "None / Healthy", "touch");

    expect(finalStep.isComplete).toBe(true);
    expect(finalStep.nextQuestion).toBeNull();
    expect(finalStep.session.status).toBe("submitted");

    // Compile session to draft case
    const createdCase = await compileInterviewToCase(session.id);
    expect(createdCase).toBeDefined();
    expect(createdCase.patient_id).toBe(patientId);
    expect(createdCase.chief_complaint).toBe("General weakness");
    expect(createdCase.status).toBe("draft");
  });
});
