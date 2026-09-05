import { z } from "zod";

export type QuestionAnswerType = "choice" | "text" | "scale";

export interface QuestionOption {
  value: string;
  labelEn: string;
  labelTe: string;
}

export interface QuestionNode {
  id: string;
  key: string;
  promptEn: string;
  promptTe: string;
  type: QuestionAnswerType;
  options?: QuestionOption[];
  nextQuestionId?: string | ((answer: string) => string | null) | null;
}

export interface CapturedAnswer {
  questionKey: string;
  rawAnswer: string;
  normalizedAnswer?: any;
  inputMode: "voice" | "touch" | "text";
  timestamp: string;
}

export interface InterviewSession {
  id: string;
  patientId: string;
  language: "en" | "te";
  status: "active" | "submitted" | "abandoned";
  consentGiven: boolean;
  currentQuestionId: string | null;
  answers: Record<string, CapturedAnswer>;
  startedAt: string;
  endedAt?: string | null;
}
