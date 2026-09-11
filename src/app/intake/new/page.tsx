"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { QuestionNode } from "@/features/interview/types";
import {
  Sparkles,
  ShieldCheck,
  Languages,
  CheckCircle2,
  Mic,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  Activity,
  HeartPulse,
  Send,
} from "lucide-react";
import { KioskIntro } from "@/components/onboarding/kiosk-intro";
import { hasCompletedKioskOnboarding, resetKioskOnboarding } from "@/lib/onboarding/onboarding-state";

export default function PatientKioskIntakePage() {
  const router = useRouter();

  // Intake Stages: 'intro' -> 'language' -> 'consent' -> 'interview' -> 'completed'
  const [stage, setStage] = useState<"intro" | "language" | "consent" | "interview" | "completed">("language");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  useEffect(() => {
    if (!hasCompletedKioskOnboarding()) {
      setStage("intro");
    }
  }, []);

  // Interview Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [intakeToken, setIntakeToken] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionNode | null>(null);
  const [inputMode, setInputMode] = useState<"choice" | "voice" | "text">("choice");
  const [textInput, setTextInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  // Stage 1: Select Language
  const handleSelectLanguage = (lang: "en" | "te") => {
    setLanguage(lang);
    setStage("consent");
  };

  // Stage 2: Start Interview after Consent
  const handleStartInterview = async () => {
    if (!consentAcknowledged) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, consentAcknowledged: true }),
      });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        setSessionId(data.sessionId);
        setIntakeToken(data.intakeToken || null);
        setCurrentQuestion(data.currentQuestion);
        setStage("interview");
      }
    } catch {
      console.error("Failed to start session");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 3: Answer Submission
  const handleAnswer = async (answerText: string, mode: "voice" | "touch" | "text") => {
    if (!sessionId || !answerText.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/interviews/${sessionId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(intakeToken ? { "x-intake-token": intakeToken } : {}),
        },
        body: JSON.stringify({ answer: answerText.trim(), inputMode: mode }),
      });

      const data = await res.json();
      setQuestionsAnswered((prev) => prev + 1);
      setTextInput("");
      setInputMode("choice");

      if (data.isComplete || !data.nextQuestion) {
        // Compile to case
        const submitRes = await fetch(`/api/interviews/${sessionId}/submit`, {
          method: "POST",
          headers: {
            ...(intakeToken ? { "x-intake-token": intakeToken } : {}),
          },
        });
        const submitData = await submitRes.json();
        if (submitRes.ok && submitData.case) {
          setCreatedCaseId(submitData.case.id);
        }
        setStage("completed");
      } else {
        setCurrentQuestion(data.nextQuestion);
      }
    } catch {
      console.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* STAGE 0: First-Time Patient Kiosk Introduction */}
      {stage === "intro" && (
        <KioskIntro
          onStart={(lang) => {
            setLanguage(lang);
            setStage("language");
          }}
          onSkip={(lang) => {
            setLanguage(lang);
            setStage("language");
          }}
        />
      )}

      {/* STAGE 1: Language Selection */}
      {stage === "language" && (
        <div className="rounded-3xl border border-surface-200 bg-white p-8 sm:p-12 shadow-sm text-center space-y-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-600 shadow-sm">
            <Languages className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome to MedKit AI Clinical Intake
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Please choose your preferred language to begin your clinical history intake
            </p>
            <p className="text-xs text-slate-600 mt-1">
              దయచేసి మీ ప్రాధాన్యత గల భాషను ఎంచుకోండి
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => handleSelectLanguage("en")}
              className="rounded-2xl border-2 border-surface-200 p-6 text-center hover:border-clinical-600 hover:bg-clinical-50/50 transition-all shadow-sm group"
            >
              <div className="text-lg font-bold text-slate-900 group-hover:text-clinical-700">English</div>
              <div className="text-xs text-slate-500 mt-1">Standard clinical intake</div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectLanguage("te")}
              className="rounded-2xl border-2 border-surface-200 p-6 text-center hover:border-clinical-600 hover:bg-clinical-50/50 transition-all shadow-sm group"
            >
              <div className="text-lg font-bold text-slate-900 group-hover:text-clinical-700">తెలుగు (Telugu)</div>
              <div className="text-xs text-slate-500 mt-1">ప్రాంతీయ భాషలో సంభాషణ</div>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: Consent Capture */}
      {stage === "consent" && (
        <div className="rounded-3xl border border-surface-200 bg-white p-8 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-surface-200 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-100 text-clinical-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {language === "te" ? "రోగి సమ్మతి ప్రకటన (Patient Consent)" : "Patient Intake Consent & Privacy"}
              </h1>
              <span className="text-xs text-slate-500">
                {language === "te" ? "గోప్యత మరియు డేటా ప్రాసెసింగ్" : "Purpose, scope, and AI safety boundary"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-surface-50 p-5 border border-surface-200 text-xs text-slate-700 space-y-3 leading-relaxed">
            <p>
              {language === "te"
                ? "ఈ సమాచార సేకరణ మీ డాక్టర్‌కు సహాయం చేయడానికి మాత్రమే ఉపయోగించబడుతుంది. మీ స్వరం మరియు లక్షణాలు నమోదు చేయబడతాయి. MedKit AI ఎటువంటి నిర్ణయాలు తీసుకోదు; మీ డాక్టరే తుది నిర్ణయాధికారి."
                : "The information you share will prepare a structured clinical summary for your consulting physician. Your responses may be provided via voice, touchscreen, or text. MedKit AI is a clinical documentation assistant and never makes autonomous medical decisions."}
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>{language === "te" ? "సమాచారం సురక్షితంగా రక్షించబడుతుంది" : "Data is securely encrypted with Row Level Security."}</li>
              <li>{language === "te" ? "ప్రతి సమాధానాన్ని సరిదిద్దే హక్కు మీకు ఉంది" : "You may edit or clarify any recorded response before consultation."}</li>
              <li>{language === "te" ? "మీ డాక్టర్ దీనిని ధృవీకరించిన తర్వాతే రికార్డు పూర్తవుతుంది" : "Your physician confirms all information prior to final treatment."}</li>
            </ul>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-surface-200 p-4 cursor-pointer hover:bg-surface-50">
            <input
              type="checkbox"
              checked={consentAcknowledged}
              onChange={(e) => setConsentAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-clinical-600 focus:ring-clinical-600"
            />
            <span className="text-xs font-semibold text-slate-800">
              {language === "te"
                ? "నేను నిబంధనలను అర్థం చేసుకున్నాను మరియు క్లినికల్ ఇంటేక్ ప్రారంభించడానికి సమ్మతిస్తున్నాను."
                : "I understand the purpose and consent to automated multimodal clinical intake for my consultation."}
            </span>
          </label>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStage("language")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={!consentAcknowledged || isSubmitting}
              onClick={handleStartInterview}
              className="inline-flex items-center gap-2 rounded-xl bg-clinical-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 disabled:opacity-40 transition-colors"
            >
              {isSubmitting ? "Initializing..." : language === "te" ? "ప్రారంభించండి (Start)" : "Begin Intake"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: Question Card */}
      {stage === "interview" && currentQuestion && (
        <div className="space-y-6">
          {/* Progress Tracker */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Question {questionsAnswered + 1}</span>
            <span>Intake in Progress</span>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
            {/* Question Text */}
            <div>
              <span className="rounded-full bg-clinical-100 px-2.5 py-0.5 text-[10px] font-bold text-clinical-800 uppercase tracking-wider">
                Active Question
              </span>
              <h2 className="mt-3 text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                {language === "te" ? currentQuestion.promptTe : currentQuestion.promptEn}
              </h2>
              {language === "te" && (
                <p className="mt-1 text-xs text-slate-400">{currentQuestion.promptEn}</p>
              )}
            </div>

            {/* Modality Selector Bar */}
            <div className="flex gap-2 border-y border-surface-200 py-3">
              <button
                type="button"
                onClick={() => setInputMode("choice")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  inputMode === "choice"
                    ? "bg-clinical-600 text-white"
                    : "bg-surface-100 text-slate-600 hover:bg-surface-200"
                }`}
              >
                Touch Options
              </button>
              <button
                type="button"
                onClick={() => setInputMode("voice")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  inputMode === "voice"
                    ? "bg-clinical-600 text-white"
                    : "bg-surface-100 text-slate-600 hover:bg-surface-200"
                }`}
              >
                <Mic className="h-3.5 w-3.5 text-red-500" />
                Speak Answer
              </button>
              <button
                type="button"
                onClick={() => setInputMode("text")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  inputMode === "text"
                    ? "bg-clinical-600 text-white"
                    : "bg-surface-100 text-slate-600 hover:bg-surface-200"
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Type Instead
              </button>
            </div>

            {/* Option Cards Mode */}
            {inputMode === "choice" && currentQuestion.options && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAnswer(opt.value, "touch")}
                    className="flex items-center justify-between rounded-xl border-2 border-surface-200 p-4 text-left hover:border-clinical-500 hover:bg-clinical-50/50 transition-all group"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-clinical-800">
                        {language === "te" ? opt.labelTe : opt.labelEn}
                      </div>
                      {language === "te" && (
                        <div className="text-xs text-slate-400 mt-0.5">{opt.labelEn}</div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-clinical-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Voice Mode */}
            {inputMode === "voice" && (
              <VoiceRecorder
                language={language}
                intakeToken={intakeToken}
                onTranscriptionConfirmed={(transcript) => handleAnswer(transcript, "voice")}
                onCancel={() => setInputMode("choice")}
              />
            )}

            {/* Text Input Mode */}
            {inputMode === "text" && (
              <div className="space-y-4 pt-2">
                <textarea
                  rows={3}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your response in detail..."
                  className="block w-full rounded-xl border border-surface-200 p-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!textInput.trim() || isSubmitting}
                    onClick={() => handleAnswer(textInput, "text")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-clinical-700 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit Response
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 4: Completed & Handoff */}
      {stage === "completed" && (
        <div className="rounded-3xl border border-surface-200 bg-white p-8 sm:p-12 shadow-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {language === "te" ? "ఇంటేక్ విజయవంతంగా పూర్తయింది" : "Clinical Intake Submitted Successfully"}
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              Your responses have been structured, source-verified, and placed into the Doctor Copilot queue for review.
            </p>
          </div>

          <div className="pt-4 flex flex-wrap justify-center gap-3">
            {createdCaseId && (
              <Link
                href={`/doctor/cases/${createdCaseId}`}
                className="rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700"
              >
                View Structured Case in Doctor Portal &rarr;
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                resetKioskOnboarding();
                setStage("intro");
                setSessionId(null);
                setIntakeToken(null);
                setQuestionsAnswered(0);
                setConsentAcknowledged(false);
              }}
              className="rounded-xl border border-surface-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-50"
            >
              Start Next Patient Intake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
