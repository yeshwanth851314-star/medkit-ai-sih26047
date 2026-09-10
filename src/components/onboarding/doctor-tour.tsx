"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  hasCompletedDoctorOnboarding,
  completeDoctorOnboarding,
  REPLAY_TOUR_EVENT,
} from "@/lib/onboarding/onboarding-state";
import {
  Stethoscope,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  HeartPulse,
  Activity,
} from "lucide-react";

interface TourStep {
  id: number;
  title: string;
  subtitle: string;
  copy: string;
  note?: string;
  highlight?: boolean;
  preview: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "Your Clinical Workspace",
    subtitle: "Dashboard & Triage Hub",
    copy: "Review patients, active cases, pending follow-ups, and important clinical alerts from one place.",
    preview: (
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-surface-200 pb-2">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-clinical-600" />
            Triage &amp; Intake Queue
          </span>
          <span className="rounded-full bg-clinical-100 px-2 py-0.5 text-[10px] font-semibold text-clinical-700">
            Live Stream
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-white p-2 border border-surface-200">
            <span className="text-slate-500 block">Active Cases</span>
            <span className="font-bold text-slate-900 text-sm">3 Pending</span>
          </div>
          <div className="rounded-lg bg-white p-2 border border-surface-200">
            <span className="text-slate-500 block">Digitized Documents</span>
            <span className="font-bold text-slate-900 text-sm">2 Records</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: "Rule-Based Safety Alerts",
    subtitle: "Deterministic Emergency Detection",
    copy: "Potentially urgent findings are highlighted for immediate clinical attention. These alerts are deterministic and non-diagnostic.",
    note: "Evaluates vital signs, chest pain severity, and acute symptoms deterministically.",
    preview: (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span>CRITICAL CLINICAL RED FLAG</span>
        </div>
        <p className="text-red-900 text-[11px] font-medium">
          Acute crushing retrosternal chest pain radiating to left shoulder with cold sweating.
        </p>
        <span className="text-[10px] text-red-600 italic block">
          Potential red flag detected — immediate clinical assessment recommended. Non-diagnostic alert.
        </span>
      </div>
    ),
  },
  {
    id: 3,
    title: "See What Changed",
    subtitle: "Signature Feature: Longitudinal Comparison",
    copy: "Compare the current visit with previous encounters to quickly identify new, persistent, resolved, or medication-related changes.",
    highlight: true,
    note: "MedKit AI's primary differentiator: automatically computes clinical deltas between visits.",
    preview: (
      <div className="rounded-xl border-2 border-clinical-400 bg-gradient-to-b from-clinical-50/50 to-white p-4 space-y-2.5 text-xs shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-bold text-clinical-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <TrendingUp className="h-4 w-4 text-clinical-600" />
            What Changed Since the Previous Visit?
          </span>
          <span className="rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
            Cross-Visit Delta
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="rounded bg-emerald-50 border border-emerald-200 p-1.5 text-emerald-800 font-bold">
            + NEW SYMPTOM
          </div>
          <div className="rounded bg-slate-100 border border-slate-200 p-1.5 text-slate-700 font-medium">
            → PERSISTING
          </div>
          <div className="rounded bg-sky-50 border border-sky-200 p-1.5 text-sky-800 font-semibold line-through">
            ✓ RESOLVED
          </div>
        </div>
        <div className="rounded bg-white p-2 border border-surface-200 text-[11px]">
          <span className="text-slate-500 font-medium block">Titration:</span>
          <span className="text-slate-800 font-semibold">+ Paracetamol 650mg SOS added</span>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: "AI-Assisted Clinical Summary",
    subtitle: "Physician Copilot & Provenance",
    copy: "MedKit AI organizes verified case information into a structured summary. Review, edit, and confirm it before use.",
    note: "AI assists. The clinician decides.",
    preview: (
      <div className="rounded-xl border border-surface-200 bg-white p-4 space-y-2 text-xs shadow-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-clinical-100 px-2 py-0.5 text-[10px] font-bold text-clinical-800">
            <Sparkles className="h-3 w-3 text-clinical-600" /> Live Gemini 2.5 Flash
          </span>
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Review Required
          </span>
        </div>
        <p className="text-slate-700 text-[11px] leading-relaxed bg-surface-50 p-2.5 rounded-lg border border-surface-200">
          Patient presents with acute productive cough worsening over 3 days with low-grade fever (100°F).
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span>Source: Patient Reported</span>
          <span className="font-semibold text-emerald-600">✓ Clinician Confirmation Required</span>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: "Finalize the Clinical Record",
    subtitle: "ABDM / HIPAA Immutability",
    copy: "Once finalized, the base record is protected from silent changes. Additional information can be recorded through an addendum.",
    note: "You're ready.",
    preview: (
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileCheck className="h-4 w-4 text-emerald-600" />
            Finalized Clinical Case
          </span>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Locked &amp; Signed
          </span>
        </div>
        <div className="rounded-lg bg-white p-2.5 border border-surface-200 text-[11px] space-y-1">
          <span className="text-slate-500 font-medium block">Subsequent revisions:</span>
          <span className="text-amber-800 font-semibold block">+ Addendum 1: Signed by Dr. Clinician</span>
          <span className="text-slate-400 text-[10px]">FHIR R4 Bundle ready for exchange</span>
        </div>
      </div>
    ),
  },
];

export interface DoctorTourProps {
  doctorId?: string;
}

export function DoctorTour({ doctorId }: DoctorTourProps = {}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"welcome" | "tour">("welcome");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Check if first-time doctor login (only auto-open on doctor home / triage queue)
    const isDoctorHome = pathname === "/doctor/patients" || pathname === "/doctor/dashboard";
    const completed = hasCompletedDoctorOnboarding(doctorId);
    if (!completed && isDoctorHome) {
      setMode("welcome");
      setIsOpen(true);
    }

    // Listen for manual replay triggers from persistent header menu (available anywhere)
    const handleReplay = () => {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setCurrentStepIndex(0);
      setMode("tour");
      setIsOpen(true);
    };

    window.addEventListener(REPLAY_TOUR_EVENT, handleReplay);
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, handleReplay);
  }, [pathname, doctorId]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    completeDoctorOnboarding(doctorId);
    setIsOpen(false);
  }, [doctorId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
        return;
      }

      if (e.key === "Tab") {
        if (!dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === dialogRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mode, currentStepIndex, handleDismiss]);

  const handleStartTour = () => {
    setMode("tour");
    setCurrentStepIndex(0);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed all 5 steps
      completeDoctorOnboarding(doctorId);
      setIsOpen(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 transition-opacity duration-200 motion-reduce:transition-none"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl transition-all focus:outline-none motion-reduce:transition-none ${
          currentStep?.highlight && mode === "tour"
            ? "border-2 border-clinical-500 ring-4 ring-clinical-100"
            : "border border-surface-200"
        }`}
      >
        {/* WELCOME PROMPT */}
        {mode === "welcome" && (
          <div className="text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-600 shadow-sm">
              <Stethoscope className="h-7 w-7" />
            </div>

            <div>
              <span className="rounded-full bg-clinical-50 border border-clinical-200 px-3 py-0.5 text-xs font-bold text-clinical-800 uppercase tracking-wider">
                Clinician Onboarding
              </span>
              <h2 id="tour-dialog-title" className="mt-3 text-xl font-bold text-slate-900">
                Welcome to MedKit AI
              </h2>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                MedKit AI organizes patient speech, structured answers, and prior medical records into a verified clinical history before your consultation begins.
              </p>
            </div>

            <div className="rounded-xl bg-surface-50 border border-surface-200 p-4 text-left text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-clinical-600" />
                Quick 60-Second Overview Covers:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px] pl-1">
                <li>Clinical Workspace &amp; Triage Queue</li>
                <li>Deterministic Rule-Based Red Flag Alerts</li>
                <li><strong>What Changed Since Last Visit?</strong> (Longitudinal Delta)</li>
                <li>AI Summary Review &amp; Provenance Tracking</li>
                <li>Case Finalization &amp; Immutable Addenda</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto rounded-xl border border-surface-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-surface-100 transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleStartTour}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-clinical-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
              >
                <span>Start Quick Tour</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5-STEP GUIDED TOUR */}
        {mode === "tour" && currentStep && (
          <div className="space-y-5">
            {/* Header with Step Tracker */}
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-clinical-100 px-2.5 py-0.5 text-xs font-bold text-clinical-800">
                  Step {currentStep.id} of {TOUR_STEPS.length}
                </span>
                {currentStep.highlight && (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                    ★ Primary Differentiator
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close Quick Tour"
                className="rounded-lg p-1 text-slate-400 hover:bg-surface-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step Content */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-clinical-600">
                {currentStep.subtitle}
              </span>
              <h2 id="tour-dialog-title" className="text-lg font-bold text-slate-900 mt-0.5">
                {currentStep.title}
              </h2>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                {currentStep.copy}
              </p>
            </div>

            {/* Interactive Preview Representation */}
            {currentStep.preview}

            {/* Clinical Note / Safety Contract */}
            {currentStep.note && (
              <div className="text-[11px] text-clinical-900 font-semibold italic bg-clinical-50/70 p-2.5 rounded-lg border border-clinical-200 flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-clinical-600 shrink-0 mt-0.5" />
                <span>{currentStep.note}</span>
              </div>
            )}

            {/* Footer Navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-200">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Skip Tour
              </button>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-clinical-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700"
                >
                  {currentStepIndex === TOUR_STEPS.length - 1 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Start Using MedKit AI
                    </>
                  ) : (
                    <>
                      Next: {TOUR_STEPS[currentStepIndex + 1].title}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
