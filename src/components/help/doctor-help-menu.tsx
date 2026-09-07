"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  RotateCcw,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  FileCode,
  Heart,
  History,
  AlertTriangle,
  X,
  ChevronRight,
} from "lucide-react";
import { triggerDoctorTourReplay } from "@/lib/onboarding/onboarding-state";
import { HELP_TOPICS, HelpTopic } from "./contextual-help";

export function DoctorHelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveTopic(null);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveTopic(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleReplayTour = () => {
    setIsOpen(false);
    setActiveTopic(null);
    triggerDoctorTourReplay();
  };

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Clinician Help & Quick Tour Menu"
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 hover:text-clinical-700 transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-500"
      >
        <HelpCircle className="h-4 w-4 text-clinical-600" />
        <span className="hidden sm:inline">Help</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-2 w-72 sm:w-80 origin-top-right rounded-2xl border border-surface-200 bg-white p-3 shadow-xl ring-1 ring-black/5 focus:outline-none animate-in fade-in duration-150"
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between border-b border-surface-100 pb-2.5 px-2">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Clinician Guide &amp; Quick Tour</span>
              <span className="text-[10px] text-slate-400">SIH26047 Patient Case-Taking Software</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Help Menu"
              className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-surface-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Primary Action: Replay Tour */}
          <div className="pt-2 pb-2">
            <button
              type="button"
              role="menuitem"
              onClick={handleReplayTour}
              className="w-full flex items-center justify-between gap-2 rounded-xl bg-clinical-50 border border-clinical-200 p-2.5 text-left text-xs font-semibold text-clinical-800 hover:bg-clinical-100/70 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-clinical-600 group-hover:rotate-180 transition-transform duration-300" />
                <div>
                  <span className="block font-bold">Replay Quick Tour</span>
                  <span className="text-[10px] text-clinical-600 font-normal">5-step overview of workspace &amp; tools</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-clinical-400" />
            </button>
          </div>

          {/* Core Concept Mini-Guides */}
          <div className="border-t border-surface-100 pt-2 space-y-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Core Concepts
            </span>

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "what_changed" ? null : "what_changed")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <TrendingUp className="h-3.5 w-3.5 text-clinical-600" />
                What Changed Since Last Visit?
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "what_changed" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "what_changed" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.what_changed.explanation}</p>
                <span className="text-[10px] font-semibold text-clinical-700 block italic">
                  {HELP_TOPICS.what_changed.note}
                </span>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "provenance" ? null : "provenance")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-clinical-600" />
                Clinical Provenance &amp; Traceability
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "provenance" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "provenance" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.provenance.explanation}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {HELP_TOPICS.provenance.examples?.map((ex, i) => (
                    <span key={i} className="rounded bg-white border border-surface-200 px-1 py-0.5 text-[9px] font-mono text-slate-600">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "summary" ? null : "summary")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-clinical-600" />
                AI Summary &amp; Copilot Boundary
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "summary" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "summary" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.summary.explanation}</p>
                <span className="text-[10px] font-semibold text-clinical-700 block italic">
                  {HELP_TOPICS.summary.note}
                </span>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "fhir" ? null : "fhir")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileCode className="h-3.5 w-3.5 text-clinical-600" />
                FHIR R4 / ABDM Architecture
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "fhir" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "fhir" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.fhir.explanation}</p>
                <span className="text-[10px] font-semibold text-clinical-700 block italic">
                  {HELP_TOPICS.fhir.note}
                </span>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "ayush" ? null : "ayush")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Heart className="h-3.5 w-3.5 text-clinical-600" />
                AYUSH Dashavidha Pariksha
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "ayush" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "ayush" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.ayush.explanation}</p>
                <span className="text-[10px] font-semibold text-clinical-700 block italic">
                  {HELP_TOPICS.ayush.note}
                </span>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setActiveTopic(activeTopic === "addendum" ? null : "addendum")}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-surface-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <History className="h-3.5 w-3.5 text-clinical-600" />
                Case Finalization &amp; Addenda
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeTopic === "addendum" ? "rotate-90" : ""}`} />
            </button>

            {activeTopic === "addendum" && (
              <div className="mx-2 mb-2 rounded-lg bg-surface-50 p-2.5 text-[11px] text-slate-600 border border-surface-200 space-y-1">
                <p>{HELP_TOPICS.addendum.explanation}</p>
                <span className="text-[10px] font-semibold text-clinical-700 block italic">
                  {HELP_TOPICS.addendum.note}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
