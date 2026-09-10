"use client";

import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, X, ExternalLink, ShieldCheck } from "lucide-react";

export type HelpTopic =
  | "provenance"
  | "what_changed"
  | "ayush"
  | "fhir"
  | "addendum"
  | "red_flags"
  | "summary";

export interface HelpTopicContent {
  label: string;
  explanation: string;
  examples?: string[];
  note?: string;
}

export const HELP_TOPICS: Record<HelpTopic, HelpTopicContent> = {
  provenance: {
    label: "What is provenance?",
    explanation:
      "Provenance shows where clinical information came from—for example, the patient, clinician, uploaded document, system rule, or AI-assisted process.",
    examples: [
      "Patient-reported",
      "Clinician-entered",
      "Document-extracted",
      "System-derived",
      "AI-generated",
    ],
    note: "Provenance protects the legal audit trail and clarifies evidentiary authority.",
  },
  what_changed: {
    label: "What does “What Changed” mean?",
    explanation:
      "It compares the current visit with previous encounters and highlights important differences such as new symptoms, persistent problems, resolved findings, or medication changes.",
    note: "Signature longitudinal synthesis computed deterministically between consecutive encounters.",
  },
  ayush: {
    label: "About AYUSH Assessment",
    explanation:
      "This section supports structured Ayurvedic case-taking such as Dashavidha Pariksha and Ahara–Vihara documentation while keeping clinician verification central.",
    note: "Aligns with Ministry of Ayush & AIIA documentation guidelines. Non-diagnostic.",
  },
  fhir: {
    label: "What is FHIR?",
    explanation:
      "FHIR is a healthcare interoperability standard used to represent clinical information in a structured format for exchange between compatible systems. MedKit AI provides a FHIR R4-compatible representation with ABDM integration-ready architecture.",
    note: "Conforms to HL7 FHIR Release 4 standard specifications.",
  },
  addendum: {
    label: "What is an addendum?",
    explanation:
      "An addendum records additional information after a case has been finalized without silently changing the original clinical record.",
    note: "Finalized records are immutable to comply with ABDM, HIPAA, and medical ethics mandates.",
  },
  red_flags: {
    label: "Rule-Based Safety Alerts",
    explanation:
      "Potentially urgent findings are highlighted for immediate clinical attention. These alerts are deterministic and non-diagnostic.",
    note: "Rules evaluate vital thresholds and acute symptomatic markers. Non-diagnostic alert.",
  },
  summary: {
    label: "AI-Assisted Clinical Summary",
    explanation:
      "MedKit AI organizes verified case information into a structured summary. Review, edit, and confirm it before use.",
    note: "AI assists. The clinician decides.",
  },
};

interface ContextualHelpProps {
  topic: HelpTopic;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function ContextualHelp({ topic, className = "", side = "bottom" }: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const data = HELP_TOPICS[topic];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        if (!popoverRef.current) return;
        const focusable = popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
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

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!data) return null;

  const sideClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0",
    left: "right-full mr-2 top-0",
    right: "left-full ml-2 top-0",
  }[side] || "top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0";

  return (
    <span className={`inline-flex items-center relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Help: ${data.label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-clinical-700 hover:bg-clinical-50 transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-500"
      >
        <span className="text-[11px] font-bold leading-none font-mono">?</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={data.label}
          className={`absolute z-50 w-72 sm:w-80 rounded-xl border border-surface-200 bg-white p-4 shadow-xl text-left text-xs text-slate-700 space-y-2.5 transition-opacity duration-150 ${sideClasses}`}
        >
          <div className="flex items-center justify-between border-b border-surface-200 pb-2">
            <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-clinical-600" />
              {data.label}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={`Close help for ${data.label}`}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-surface-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="leading-relaxed text-slate-600">{data.explanation}</p>

          {data.examples && data.examples.length > 0 && (
            <div className="rounded-lg bg-surface-50 p-2 border border-surface-200 text-[11px] space-y-1">
              <span className="font-bold text-slate-700 block">Typical Sources / Types:</span>
              <div className="flex flex-wrap gap-1">
                {data.examples.map((ex, i) => (
                  <span
                    key={i}
                    className="rounded bg-white border border-surface-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.note && (
            <div className="text-[10px] text-clinical-800 font-semibold italic bg-clinical-50/70 p-2 rounded border border-clinical-200 flex items-start gap-1.5">
              <ShieldCheck className="h-3 w-3 text-clinical-600 shrink-0 mt-0.5" />
              <span>{data.note}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
