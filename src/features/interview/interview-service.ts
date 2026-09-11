import { InterviewSession, QuestionNode, InterviewAccessContext } from "./types";
import { QUESTION_GRAPH } from "./question-graph";
import { createCaseDraft } from "@/features/cases/case-service";
import { ClinicalCase } from "@/types/database";
import { verifyPatientConsent } from "@/features/consent/consent-service";
import { evaluateClinicalRedFlags } from "@/features/red-flags/rules-engine";
import { AuthUser } from "@/features/auth/types";
import {
  createRedFlagEvent,
  createIntakeSession,
  getIntakeSessionById,
  updateIntakeSession,
  verifyDurableSessionState,
} from "@/lib/db/supabase";
import { revokeIntakeCapabilityToken } from "@/lib/auth/kiosk-capability";
import { env } from "@/config/env";

const MAX_SESSION_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours TTL

const globalForSessions = globalThis as unknown as {
  __medkit_active_sessions?: Map<string, InterviewSession>;
};

if (!globalForSessions.__medkit_active_sessions) {
  globalForSessions.__medkit_active_sessions = new Map();
}

const activeSessions: Map<string, InterviewSession> = globalForSessions.__medkit_active_sessions;

/**
 * Prune abandoned/stale sessions older than TTL to prevent memory leaks
 */
export function pruneExpiredSessions(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [id, s] of activeSessions.entries()) {
    const age = now - new Date(s.startedAt).getTime();
    if (age > MAX_SESSION_AGE_MS) {
      activeSessions.delete(id);
      pruned++;
    }
  }
  return pruned;
}

/**
 * Durably tear down an interview session upon completion or cancellation.
 * Invariant: Database state change MUST succeed before teardown is considered complete.
 */
export async function teardownInterviewSession(
  sessionId: string,
  options?: InterviewAccessContext & { targetStatus?: "submitted" | "abandoned" }
): Promise<void> {
  const targetStatus = options?.targetStatus || "submitted";
  const session = activeSessions.get(sessionId);
  if (session) {
    session.status = targetStatus;
    session.endedAt = new Date().toISOString();
  }

  // Update durable intake_sessions record immediately
  const updatePromise = (async () => {
    if (options?.kioskId && options?.kioskSecret) {
      // Handled atomically by revokeIntakeCapabilityToken via kiosk RPC / mockDb
      return;
    } else {
      const updateResult = await updateIntakeSession(
        sessionId,
        {
          status: targetStatus,
          completed_at: new Date().toISOString(),
        },
        options?.actorOrToken
      );
      if (!updateResult && !env.isDemoMode) {
        throw new Error(`Failed to durably update intake session ${sessionId} to ${targetStatus}`);
      }
      return updateResult;
    }
  })();

  // Durable revocation of capability token — throws if persistent write fails
  const revokePromise = revokeIntakeCapabilityToken(sessionId, {
    targetStatus,
    reason: `session_teardown_${targetStatus}`,
    kioskId: options?.kioskId,
    kioskSecret: options?.kioskSecret,
    actorOrToken: options?.actorOrToken,
  });

  await Promise.all([updatePromise, revokePromise]);
}

export function createInterviewSession(
  patientId: string,
  language: "en" | "te" = "en",
  consentId?: string | null,
  facilityId?: string | null,
  options?: { sessionId?: string; skipDbInsert?: boolean; actorOrToken?: AuthUser | string | null }
): InterviewSession {
  // Prune any expired sessions periodically
  pruneExpiredSessions();

  const resolvedFacilityId = facilityId || (env.isDemoMode ? "fac-hyd-01" : null);
  if (!resolvedFacilityId) {
    throw new Error("FACILITY_REQUIRED: Intake kiosk requires assigned facility identity");
  }

  const sessionId = options?.sessionId || crypto.randomUUID();
  const session: InterviewSession = {
    id: sessionId,
    patientId,
    consentId: consentId || null,
    facilityId: resolvedFacilityId,
    language,
    status: "active",
    consentGiven: true,
    currentQuestionId: "Q_CHIEF_COMPLAINT",
    answers: {},
    startedAt: new Date().toISOString(),
  };

  activeSessions.set(sessionId, session);

  let dbPromise: Promise<any> = Promise.resolve();
  if (!options?.skipDbInsert) {
    // Durably record intake session in database — fail closed if insert fails
    dbPromise = createIntakeSession(
      {
        id: sessionId,
        facility_id: resolvedFacilityId,
        patient_id: patientId,
        consent_id: consentId || null,
        language,
        status: "active",
        current_question_id: "Q_CHIEF_COMPLAINT",
        answers: {},
        expires_at: new Date(Date.now() + MAX_SESSION_AGE_MS).toISOString(),
      },
      options?.actorOrToken
    );
  }

  const thenable = {
    ...session,
    then(onFulfilled?: (value: InterviewSession) => any, onRejected?: (reason: any) => any) {
      return dbPromise.then(() => session).then(onFulfilled, onRejected);
    },
    catch(onRejected?: (reason: any) => any) {
      return dbPromise.then(() => session).catch(onRejected);
    },
  };

  return thenable as unknown as InterviewSession;
}

export function getInterviewSession(sessionId: string): InterviewSession | null {
  return activeSessions.get(sessionId) || null;
}

export async function getInterviewSessionAsync(
  sessionId: string,
  options?: InterviewAccessContext
): Promise<InterviewSession | null> {
  const cached = activeSessions.get(sessionId);
  if (cached) return cached;

  let dbSession: any = null;
  if (env.isDemoMode) {
    dbSession = await getIntakeSessionById(sessionId, options?.actorOrToken);
  } else {
    if (options?.kioskId && options?.kioskSecret) {
      const { getKioskIntakeSession } = await import("@/lib/db/supabase");
      dbSession = await getKioskIntakeSession({
        kioskId: options.kioskId,
        kioskSecret: options.kioskSecret,
        sessionId,
      });
    } else if (options?.actorOrToken) {
      dbSession = await getIntakeSessionById(sessionId, options.actorOrToken);
    } else {
      throw new Error("UNAUTHORIZED: Kiosk device credentials or clinical authentication required to load intake session");
    }
  }

  if (!dbSession) return null;

  // Strict session state resolution: only explicit active + unexpired yields active
  const isExpired = dbSession.expires_at && new Date(dbSession.expires_at).getTime() < Date.now();
  let resolvedStatus: "active" | "submitted" | "abandoned" | "revoked";
  if (isExpired) {
    resolvedStatus = "abandoned";
  } else {
    switch (dbSession.status) {
      case "active":
        resolvedStatus = "active";
        break;
      case "submitted":
        resolvedStatus = "submitted";
        break;
      case "abandoned":
        resolvedStatus = "abandoned";
        break;
      case "revoked":
        resolvedStatus = "revoked";
        break;
      default:
        // Any unrecognized or unknown status strictly fails closed
        resolvedStatus = "revoked";
        break;
    }
  }

  const session: InterviewSession = {
    id: dbSession.id,
    patientId: dbSession.patient_id,
    consentId: dbSession.consent_id || null,
    facilityId: dbSession.facility_id || null,
    language: dbSession.language,
    status: resolvedStatus,
    consentGiven: true,
    currentQuestionId: dbSession.current_question_id || null,
    answers: (dbSession.answers || {}) as Record<string, any>,
    startedAt: dbSession.started_at,
    endedAt: dbSession.completed_at || null,
  };
  activeSessions.set(session.id, session);
  return session;
}

export function getCurrentQuestion(session: InterviewSession): QuestionNode | null {
  if (!session.currentQuestionId) return null;
  return QUESTION_GRAPH[session.currentQuestionId] || null;
}

export async function submitInterviewAnswerAsync(
  sessionId: string,
  answer: string,
  inputMode: "voice" | "touch" | "text" = "touch",
  options?: InterviewAccessContext
): Promise<{ session: InterviewSession; nextQuestion: QuestionNode | null; isComplete: boolean }> {
  let session = activeSessions.get(sessionId);
  if (!session) {
    session = (await getInterviewSessionAsync(sessionId, options)) || undefined;
  }
  if (!session) throw new Error("Interview session not found");

  // Re-verify durable session state to prevent stale in-memory cache from overriding DB state (P0-02)
  const durableState = await verifyDurableSessionState({
    sessionId,
    kioskId: options?.kioskId,
    kioskSecret: options?.kioskSecret,
    actorOrToken: options?.actorOrToken,
  });

  if (durableState.status !== "active") {
    activeSessions.delete(sessionId);
    if (durableState.status === "revoked") {
      throw new Error(`SESSION_REVOKED: Intake session ${sessionId} has been revoked`);
    }
    if (durableState.status === "expired") {
      throw new Error("SESSION_EXPIRED: Intake session has expired");
    }
    throw new Error(`SESSION_NOT_ACTIVE: Session status is ${durableState.status}, expected active`);
  }

  if (session.status !== "active") {
    throw new Error(`SESSION_NOT_ACTIVE: Session status is ${session.status}, expected active`);
  }

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
  }

  // Update durable intake_sessions record — use secure kiosk RPC when kiosk credentials present
  if (!env.isDemoMode && options?.kioskId && options?.kioskSecret) {
    const { submitKioskAnswer } = await import("@/lib/db/supabase");
    await submitKioskAnswer({
      kioskId: options.kioskId,
      kioskSecret: options.kioskSecret,
      sessionId,
      questionKey: currentQ.key,
      rawAnswer: answer,
      inputMode,
      nextQuestionId: nextId,
    });
  } else {
    const updateResult = await updateIntakeSession(
      sessionId,
      {
        current_question_id: nextId,
        answers: session.answers,
        status: session.status === "submitted" ? "submitted" : "active",
        completed_at: session.endedAt || null,
      },
      options?.actorOrToken
    );

    if (!updateResult) {
      throw new Error(`Failed to persist answer to intake session ${sessionId}`);
    }
  }

  if (!nextId) {
    return { session, nextQuestion: null, isComplete: true };
  }

  const nextQuestion = QUESTION_GRAPH[nextId] || null;
  return { session, nextQuestion, isComplete: false };
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
  }

  // Update durable intake_sessions record
  updateIntakeSession(sessionId, {
    current_question_id: nextId,
    answers: session.answers,
    status: session.status === "submitted" ? "submitted" : "active",
    completed_at: session.endedAt || null,
  }).catch(() => {});

  if (!nextId) {
    return { session, nextQuestion: null, isComplete: true };
  }

  const nextQuestion = QUESTION_GRAPH[nextId] || null;
  return { session, nextQuestion, isComplete: false };
}

export async function compileInterviewToCase(
  sessionId: string,
  options?: InterviewAccessContext
): Promise<ClinicalCase> {
  let session = activeSessions.get(sessionId);
  if (!session) {
    session = (await getInterviewSessionAsync(sessionId, options)) || undefined;
  }
  if (!session) throw new Error("Interview session not found");

  // Idempotency check: repeated submissions return the already compiled case
  if ((session as any).compiledCaseId) {
    const { getCaseById } = await import("@/lib/db/supabase");
    const existing = await getCaseById((session as any).compiledCaseId, options?.actorOrToken);
    if (existing) return existing;
  }

  // Re-verify durable session state to prevent stale in-memory cache from overriding DB state (P0-02)
  const durableState = await verifyDurableSessionState({
    sessionId,
    kioskId: options?.kioskId,
    kioskSecret: options?.kioskSecret,
    actorOrToken: options?.actorOrToken,
  });

  if (
    durableState.status === "revoked" ||
    durableState.status === "abandoned" ||
    durableState.status === "expired"
  ) {
    activeSessions.delete(sessionId);
    throw new Error(`UNAUTHORIZED: Cannot compile case from ${durableState.status} session`);
  }

  if (durableState.status === "active" && durableState.session.compiled_case_id) {
    const { getCaseById } = await import("@/lib/db/supabase");
    const existing = await getCaseById(durableState.session.compiled_case_id, options?.actorOrToken);
    if (existing) return existing;
  }

  if (session.status === "revoked" || session.status === "abandoned") {
    throw new Error(`UNAUTHORIZED: Cannot compile case from ${session.status} session`);
  }

  // If in production mode with kiosk credentials, use the dedicated transactional RPC
  if (!env.isDemoMode && options?.kioskId && options?.kioskSecret) {
    const { submitIntakeToCase } = await import("@/lib/db/supabase");
    const answers = session.answers || {};
    const chiefComplaint =
      answers.chief_complaint?.rawAnswer ||
      answers.Q_CHIEF_COMPLAINT?.rawAnswer ||
      (answers.chief_complaint as any)?.value ||
      (answers.Q_CHIEF_COMPLAINT as any)?.value ||
      "";
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
    const redFlags = evaluateClinicalRedFlags({
      chiefComplaint,
      rawPatientComplaint: chiefComplaint,
      hpi,
    });

    const newCase = await submitIntakeToCase({
      sessionId,
      kioskId: options.kioskId,
      kioskSecret: options.kioskSecret,
      redFlags,
    });
    (session as any).compiledCaseId = newCase.id;
    await teardownInterviewSession(sessionId, {
      kioskId: options.kioskId,
      kioskSecret: options.kioskSecret,
      actorOrToken: options.actorOrToken,
      targetStatus: "submitted",
    });
    return newCase;
  }

  // Validate mandatory intake completeness
  if (!session.answers?.chief_complaint?.rawAnswer || session.answers.chief_complaint.rawAnswer.trim().length === 0) {
    throw new Error("INCOMPLETE_INTAKE: Mandatory chief complaint is required before compiling case intake");
  }

  // Verify clinical consent is active and not revoked
  const consentCheck = await verifyPatientConsent(session.patientId, undefined, options?.actorOrToken);
  if (!consentCheck.valid) {
    throw new Error(`CONSENT_REQUIRED: ${consentCheck.reason || "Patient clinical consent is required before compiling case intake"}`);
  }

  const answers = session.answers;
  const chiefComplaint = answers.chief_complaint.rawAnswer.trim();

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

  // Evaluate deterministic clinical red flags from intake data
  const redFlags = evaluateClinicalRedFlags({
    chiefComplaint,
    rawPatientComplaint: answers.chief_complaint?.rawAnswer,
    hpi,
  });

  // Create Case Draft with linked consent and detected red flags
  const actorId =
    options?.actorOrToken && typeof options.actorOrToken === "object"
      ? options.actorOrToken.id
      : null;

  const newCase = await createCaseDraft(
    {
      patientId: session.patientId,
      consentId: session.consentId || consentCheck.consent?.id || null,
      caseType: "general",
      patientLanguage: session.language,
      chiefComplaint,
      rawPatientComplaint: answers.chief_complaint?.rawAnswer,
      hpi,
      pastHistory: answers.past_conditions ? { conditions: [answers.past_conditions.rawAnswer] } : null,
      status: "draft",
      red_flags: redFlags.length > 0 ? (redFlags as any) : null,
      provenance: {
        chief_complaint: answers.chief_complaint?.inputMode === "voice" ? "patient" : "patient",
        hpi: "patient",
      },
    },
    actorId,
    options?.actorOrToken
  );

  // Persist red flag events for clinician triage tracking — fail closed on critical errors
  if (redFlags.length > 0) {
    for (const rf of redFlags) {
      await createRedFlagEvent({
        caseId: newCase.id,
        ruleId: rf.ruleId,
        severity: rf.severity,
        triggerText: rf.message,
      });
    }
  }

  // Store compiled case ID for idempotency in memory and database
  (session as any).compiledCaseId = newCase.id;
  await updateIntakeSession(
    sessionId,
    {
      compiled_case_id: newCase.id,
      status: "submitted",
      completed_at: new Date().toISOString(),
    },
    options?.actorOrToken
  );

  // Tear down the active kiosk session and revoke capability token
  await teardownInterviewSession(sessionId, {
    kioskId: options?.kioskId,
    kioskSecret: options?.kioskSecret,
    actorOrToken: options?.actorOrToken,
    targetStatus: "submitted",
  });

  return newCase;
}
