"use client";

import React, { useState, useEffect } from "react";
import { Languages, Check, Globe, Sparkles, X } from "lucide-react";

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  greeting: string;
  script: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    greeting: "Welcome to MedKit AI Clinical Portal",
    script: "Latin",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    greeting: "मेडकिट एआई क्लिनिकल पोर्टल में आपका स्वागत है",
    script: "Devanagari",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    greeting: "మెడ్‌కిట్ AI క్లినికల్ పోర్టల్‌కి స్వాగతం",
    script: "Telugu",
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    greeting: "மெட்கிட் AI மருத்துவ போர்ட்டலுக்கு வரவேற்கிறோம்",
    script: "Tamil",
  },
  {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    greeting: "ಮೆಡ್ಕಿಟ್ AI ಕ್ಲಿನಿಕಲ್ ಪೋರ್ಟಲ್‌ಗೆ ಸುಸ್ವಾಗತ",
    script: "Kannada",
  },
];

interface LanguageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
  forceOpenOnFirstVisit?: boolean;
}

export function LanguageSelectModal({
  isOpen,
  onClose,
  onSelectLanguage,
  forceOpenOnFirstVisit = true,
}: LanguageSelectModalProps) {
  const [selectedCode, setSelectedCode] = useState<string>("en");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("medkit_language");
      if (saved) {
        setSelectedCode(saved);
        if (isOpen) setIsVisible(true);
      } else if (forceOpenOnFirstVisit) {
        setIsVisible(true);
      } else if (isOpen) {
        setIsVisible(true);
      }
    }
  }, [isOpen, forceOpenOnFirstVisit]);

  const handleConfirm = (lang: SupportedLanguage) => {
    setSelectedCode(lang.code);
    if (typeof window !== "undefined") {
      localStorage.setItem("medkit_language", lang.code);
      // Dispatch custom event for reactive UI updates across the page
      window.dispatchEvent(
        new CustomEvent("medkit:language-change", { detail: lang })
      );
    }
    if (onSelectLanguage) {
      onSelectLanguage(lang);
    }
    setIsVisible(false);
    onClose();
  };

  if (!isVisible && !isOpen) return null;

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedCode) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-clinical-200 space-y-6 relative overflow-hidden animate-scaleUp">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-clinical-600 via-amber-500 to-indigo-600" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700 shadow-sm">
              <Languages className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-700">
                SIH26047 Multilingual Interface
              </span>
              <h2
                id="language-modal-title"
                className="text-xl sm:text-2xl font-black text-slate-900"
              >
                Choose Your Language / भाषा चुनें
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            aria-label="Close Language Selector"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Subtitle description */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Please select your preferred language for clinical voice intake, portal navigation, and prescription instructions.
        </p>

        {/* Languages Selection Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedCode === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleConfirm(lang)}
                className={`group flex items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-clinical-600 bg-clinical-50/80 shadow-md ring-2 ring-clinical-600/20"
                    : "border-surface-200 bg-white hover:border-clinical-300 hover:bg-surface-50/70"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900">
                      {lang.nativeName}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      ({lang.name})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">
                    {lang.greeting}
                  </div>
                </div>

                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? "border-clinical-600 bg-clinical-600 text-white"
                      : "border-slate-300 bg-white group-hover:border-clinical-400"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Language Preview Card */}
        <div className="rounded-2xl bg-surface-50 border border-surface-200 p-4 flex items-center gap-3">
          <Globe className="h-5 w-5 text-clinical-600 shrink-0" />
          <div className="text-xs text-slate-700">
            Active: <strong>{currentLang.nativeName} ({currentLang.name})</strong> — {currentLang.greeting}
          </div>
        </div>

        {/* Confirm / Continue Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleConfirm(currentLang)}
            className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-clinical-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-clinical-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>Continue to MedKit AI &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
