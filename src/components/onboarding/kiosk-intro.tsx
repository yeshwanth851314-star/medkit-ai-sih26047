"use client";

import React, { useState } from "react";
import { completeKioskOnboarding } from "@/lib/onboarding/onboarding-state";
import {
  Languages,
  ShieldCheck,
  Mic,
  FileCheck,
  ArrowRight,
  Sparkles,
  HeartPulse,
} from "lucide-react";

interface KioskIntroProps {
  onStart: (language: "en" | "te") => void;
  onSkip: (language: "en" | "te") => void;
}

export function KioskIntro({ onStart, onSkip }: KioskIntroProps) {
  const [selectedLang, setSelectedLang] = useState<"en" | "te">("en");

  const isTelugu = selectedLang === "te";

  const handleStart = () => {
    completeKioskOnboarding();
    onStart(selectedLang);
  };

  const handleSkip = () => {
    completeKioskOnboarding();
    onSkip(selectedLang);
  };

  const steps = isTelugu
    ? [
        {
          num: 1,
          icon: <Languages className="h-5 w-5 text-clinical-600" />,
          title: "భాషను ఎంచుకోండి",
          desc: "మీకు సౌకర్యవంతమైన భాషలో సంభాషించండి (తెలుగు లేదా ఇంగ్లీష్).",
        },
        {
          num: 2,
          icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
          title: "సమ్మతిని సమీక్షించండి",
          desc: "మీ సమాచారం భద్రంగా మరియు కేవలం వైద్య సేవల కోసం మాత్రమే ఉపయోగించబడుతుంది.",
        },
        {
          num: 3,
          icon: <Mic className="h-5 w-5 text-clinical-600" />,
          title: "మాట్లాడండి లేదా సమాధానాలు నొక్కండి",
          desc: "మీ స్వరం లేదా స్క్రీన్‌పై తాకడం ద్వారా మీ లక్షణాలను వివరించండి.",
        },
        {
          num: 4,
          icon: <FileCheck className="h-5 w-5 text-amber-600" />,
          title: "సమర్పించే ముందు సమీక్షించండి",
          desc: "డాక్టర్‌కు వెళ్లే ముందు మీ సమాధానాలను సరిచూసుకోండి.",
        },
      ]
    : [
        {
          num: 1,
          icon: <Languages className="h-5 w-5 text-clinical-600" />,
          title: "Choose your language",
          desc: "Interact comfortably in English or Telugu at your own pace.",
        },
        {
          num: 2,
          icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
          title: "Review and give consent",
          desc: "Your data is encrypted and used exclusively for your consultation.",
        },
        {
          num: 3,
          icon: <Mic className="h-5 w-5 text-clinical-600" />,
          title: "Speak or tap your answers",
          desc: "Describe your symptoms naturally by speaking or tapping the screen.",
        },
        {
          num: 4,
          icon: <FileCheck className="h-5 w-5 text-amber-600" />,
          title: "Review your answers before submitting",
          desc: "Verify and adjust your responses before meeting the doctor.",
        },
      ];

  return (
    <div className="rounded-3xl border border-surface-200 bg-white p-6 sm:p-10 shadow-sm space-y-8 transition-opacity duration-200">
      {/* Top Banner with Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-600 shadow-sm">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <span className="rounded-full bg-clinical-50 border border-clinical-200 px-2.5 py-0.5 text-[11px] font-bold text-clinical-800 uppercase tracking-wider">
              {isTelugu ? "రోగి కియోస్క్ గైడ్" : "Patient Kiosk Guide"}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              {isTelugu ? "MedKit AI కి స్వాగతం" : "Welcome to MedKit AI"}
            </h1>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-100 p-1 border border-surface-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedLang("en")}
            aria-pressed={selectedLang === "en"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedLang === "en"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setSelectedLang("te")}
            aria-pressed={selectedLang === "te"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedLang === "te"
                ? "bg-white text-clinical-800 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            తెలుగు (Telugu)
          </button>
        </div>
      </div>

      {/* Main Tagline */}
      <div className="text-center sm:text-left space-y-1">
        <p className="text-sm sm:text-base font-medium text-slate-800">
          {isTelugu
            ? "మీరు డాక్టర్‌ను కలవడానికి ముందే మీ ఆరోగ్య సమాచారాన్ని సులభంగా అందించడానికి మేము సహాయం చేస్తాము."
            : "We’ll help you share your health information before you meet the doctor."}
        </p>
        <p className="text-xs text-slate-500">
          {isTelugu
            ? "నాలుగు సాధారణ దశల్లో మీ క్లినికల్ వివరాలను నమోదు చేసుకోండి:"
            : "Complete your intake in four straightforward steps:"}
        </p>
      </div>

      {/* 4 Simple Steps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {steps.map((step) => (
          <div
            key={step.num}
            className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50/60 p-4 transition-all hover:bg-white hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-surface-200 shadow-sm">
              {step.icon}
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-clinical-700 uppercase tracking-wider block">
                {isTelugu ? `దశ ${step.num}` : `Step ${step.num}`}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                {step.title}
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Safety Notice */}
      <div className="rounded-xl bg-clinical-50/70 border border-clinical-200 p-3 text-[11px] text-clinical-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-clinical-600 shrink-0 mt-0.5" />
        <span>
          {isTelugu
            ? "MedKit AI డాక్టర్ పర్యవేక్షణలో సహాయకారిగా పనిచేస్తుంది. అన్ని వివరాలు మీ డాక్టర్ ద్వారా పరిశీలించబడతాయి."
            : "MedKit AI acts as an intake assistant. Your consulting physician evaluates and confirms all clinical details."}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-surface-200">
        <button
          type="button"
          onClick={handleSkip}
          className="w-full sm:w-auto text-xs font-semibold text-slate-500 hover:text-slate-800 py-2.5 px-4 rounded-xl transition-colors"
        >
          {isTelugu ? "పరిచయాన్ని దాటవేయి (Skip)" : "Skip introduction"}
        </button>

        <button
          type="button"
          onClick={handleStart}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-clinical-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
        >
          <span>{isTelugu ? "ప్రారంభించండి (Start)" : "Start Intake"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
