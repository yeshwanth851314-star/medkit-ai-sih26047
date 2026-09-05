import { InterviewSession, QuestionNode } from "./types";
import { QUESTION_GRAPH } from "./question-graph";
import { createCaseDraft } from "@/features/cases/case-service";
import { ClinicalCase } from "@/types/database";

const activeSessions: Map<string, InterviewSession> = new Map();

export function createInterviewSession(
  patientId: string,
  language: "en" | "te" = "en"
): InterviewSession {
  const sessionId = crypto.randomUUID();
  const session: InterviewSession = {
    id: sessionId,
    patientId,
    language,
    status: "active",
    consentGiven: true,
    currentQuestionId: "Q_CHIEF_COMPLAINT",
    answers: {},
    startedAt: new Date().toISOString(),
  };

  activeSessions.set(sessionId, session);
  return session;
}

export function getInterviewSession(sessionId: string): InterviewSession | null {
  return activeSessions.get(sessionId) || null;
}

export function getCurrentQuestion(session: InterviewSession): QuestionNode | null {
  if (!session.currentQuestionId) return null;
  return QUESTION_GRAPH[session.currentQuestionId] || null;
}

export function submitInterviewAnswer(
  sessionId: string,
  answer: string,
  inputMode: "voice" | "touch" | "text" = "touch"
): { session: InterviewSession; nextQuestion: QuestionNode | null; isComplete: boolean } {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error("Interview session not found");

  if (!session.currentQuestionId) {
    return { session, nextQuestion: null, isComplete: true };
  }

  const currentQ = QUESTION_GRAPH[session.currentQuestionId];
  if (!currentQ) throw new Error("Invalid current question in graph");

  // Record Answer
  session.answers[currentQ.key] = {
    questionKey: currentQ.key,
    rawAnswer: answer,
    inputMode,
    timestamp: new Date().toISOString(),
  };

  // Determine Next Question Node
  let nextId: string | null = null;
  if (typeof currentQ.nextQuestionId === "function") {
    nextId = currentQ.nextQuestionId(answer);
  } else if (typeof currentQ.nextQuestionId === "string") {
    nextId = currentQ.nextQuestionId;
  }

  session.currentQuestionId = nextId;

  if (!nextId) {
    session.status = "submitted";
    session.endedAt = new Date().toISOString();
    return { session, nextQuestion: null, isComplete: true };
  }

  const nextQuestion = QUESTION_GRAPH[nextId] || null;
  return { session, nextQuestion, isComplete: false };
}

export async function compileInterviewToCase(sessionId: string): Promise<ClinicalCase> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error("Interview session not found");

  const answers = session.answers;
  const chiefComplaint = answers.chief_complaint?.rawAnswer || "General clinical intake";

  // Build HPI from captured answers
  const hpi: any = {
    onset: answers.chest_onset?.rawAnswer || answers.general_onset?.rawAnswer || null,
    duration: answers.cough_duration?.rawAnswer || null,
    character: answers.cough_type?.rawAnswer || null,
    radiation: answers.chest_radiation?.rawAnswer || null,
    associated_symptoms: [],
  };

  if (answers.chest_associated?.rawAnswer) {
    hpi.associated_symptoms.push(answers.chest_associated.rawAnswer);
  }
  if (answers.cough_fever?.rawAnswer) {
    hpi.associated_symptoms.push(answers.cough_fever.rawAnswer);
  }

  // Create Case Draft
  const newCase = await createCaseDraft({
    patientId: session.patientId,
    caseType: "general",
    patientLanguage: session.language,
    chiefComplaint,
    rawPatientComplaint: answers.chief_complaint?.rawAnswer,
    hpi,
    pastHistory: answers.past_conditions ? { conditions: [answers.past_conditions.rawAnswer] } : null,
    status: "draft",
    provenance: {
      chief_complaint: answers.chief_complaint?.inputMode === "voice" ? "patient" : "patient",
      hpi: "patient",
    },
  });

  return newCase;
}
