"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Sparkles,
  ShieldCheck,
  Clock,
  HeartPulse,
  UserCircle,
  ArrowRight,
  Mic,
  FileText,
  Activity,
  CheckCircle2,
  FlaskConical,
  Pill,
  Languages,
  Share2,
  LogIn,
  UserPlus,
  PlayCircle,
} from "lucide-react";
import {
  LanguageSelectModal,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "@/components/landing/language-select-modal";
import {
  ShareProfileModal,
  ProfileShareData,
} from "@/components/shared/share-profile-modal";
import {
  PlatformOnboardingModal,
  OnboardingRole,
} from "@/components/onboarding/platform-onboarding-modal";
import { LANDING_TRANSLATIONS } from "@/lib/i18n/landing-translations";

const PORTAL_PROFILES: Record<string, ProfileShareData> = {
  patient: {
    role: "patient",
    roleTitle: "Verified Citizen Patient Record",
    uniqueId: "MED-2026-1001",
    name: "Rajesh Kumar",
    secondaryIdLabel: "ABHA Health ID",
    secondaryIdValue: "91-4820-1940-2811",
    facility: "AIIA Central Hospital (fac-hyd-01)",
    departmentOrScope: "Outpatient Services (OPD)",
    validity: "Active / Verified",
  },
  doctor: {
    role: "doctor",
    roleTitle: "Institutional Clinician Credential",
    uniqueId: "AIIA-DOC-8921",
    name: "Dr. Ananya Sharma, MD (AIIA)",
    secondaryIdLabel: "Council Registration",
    secondaryIdValue: "MCI-AYUSH-2024-589",
    facility: "All India Institute of Ayurveda",
    departmentOrScope: "General Medicine & Kayachikitsa",
    validity: "NMC / Ayush Council Active",
  },
  pharmacy: {
    role: "pharmacy",
    roleTitle: "Licensed Hospital Dispensary",
    uniqueId: "PHARM-7741",
    name: "Venkatesh Iyer, B.Pharm",
    secondaryIdLabel: "State Pharmacy License",
    secondaryIdValue: "TS-PHARM-2026-902",
    facility: "AIIA Central Dispensary & Formulary",
    departmentOrScope: "Dispensary Unit #1",
    validity: "Valid through 2028",
  },
  diagnostic: {
    role: "diagnostic",
    roleTitle: "NABL Diagnostic Pathology & Radiology",
    uniqueId: "LAB-TECH-4092",
    name: "Ramesh V., M.Sc MLT",
    secondaryIdLabel: "NABL Accreditation",
    secondaryIdValue: "NABL-MED-883",
    facility: "Central Diagnostic Laboratory & Imaging",
    departmentOrScope: "Biochemistry, Hematology & Radiology",
    validity: "ISO 15189 Certified",
  },
};

export default function HomePage() {
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(
    SUPPORTED_LANGUAGES[0]
  );
  const [selectedShareProfile, setSelectedShareProfile] =
    useState<ProfileShareData | null>(null);

  // Platform Onboarding Modal state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingRole, setOnboardingRole] = useState<OnboardingRole>("patient");

  // Sync saved language on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCode = localStorage.getItem("medkit_language");
      if (savedCode) {
        const found = SUPPORTED_LANGUAGES.find((l) => l.code === savedCode);
        if (found) setActiveLanguage(found);
      } else {
        // Automatically ask language on first visit!
        setIsLangModalOpen(true);
      }

      const handler = (e: any) => {
        if (e.detail) setActiveLanguage(e.detail);
      };
      window.addEventListener("medkit:language-change", handler);
      return () =>
        window.removeEventListener("medkit:language-change", handler);
    }
  }, []);

  const openOnboardingForRole = (role: OnboardingRole) => {
    setOnboardingRole(role);
    setIsOnboardingOpen(true);
  };

  // Active translation dictionary
  const t = LANDING_TRANSLATIONS[activeLanguage.code] || LANDING_TRANSLATIONS.en;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* ─── Language Selector Modal ─── */}
      <LanguageSelectModal
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
        onSelectLanguage={(lang) => setActiveLanguage(lang)}
        forceOpenOnFirstVisit={true}
      />

      {/* ─── Share Profile Modal ─── */}
      {selectedShareProfile && (
        <ShareProfileModal
          isOpen={!!selectedShareProfile}
          onClose={() => setSelectedShareProfile(null)}
          profile={selectedShareProfile}
        />
      )}

      {/* ─── Interactive Platform Onboarding & Credential Modal ─── */}
      <PlatformOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        initialRole={onboardingRole}
        languageCode={activeLanguage.code}
      />

      {/* ─── Top Utility Bar (Language, Provenance & Guided Tour) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-clinical-50/80 px-3.5 py-1.5 text-xs font-semibold text-clinical-800 shadow-2xs">
          <HeartPulse className="h-4 w-4 text-clinical-600" aria-hidden="true" />
          <span>{t.topBadge}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Start Guided Platform Tour Button */}
          <button
            type="button"
            onClick={() => openOnboardingForRole("patient")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-all"
          >
            <PlayCircle className="h-4 w-4" />
            <span>{t.tourBtn}</span>
          </button>

          {/* Global Language Switcher Trigger */}
          <button
            type="button"
            onClick={() => setIsLangModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-clinical-500 hover:text-clinical-700 transition-all"
          >
            <Languages className="h-4 w-4 text-clinical-600" />
            <span>
              {t.langLabel}: {activeLanguage.nativeName} ({activeLanguage.name})
            </span>
            <span className="text-[10px] rounded bg-clinical-100 text-clinical-800 px-1.5 py-0.5 uppercase font-extrabold">
              {t.langChange}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Hero Header ─── */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          {t.heroTitle}
        </h1>

        <p className="text-lg font-medium text-clinical-800 sm:text-xl">
          {t.heroTagline}
        </p>

        <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl mx-auto">
          {t.heroDesc}
        </p>

        <div className="text-xs text-clinical-700 font-semibold bg-clinical-50 py-1.5 px-4 rounded-full inline-block border border-clinical-200">
          {activeLanguage.greeting}
        </div>

        {/* Quick Access Action Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/patient/portal"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-sm transition-all"
          >
            <UserCircle className="h-4 w-4" />
            <span>{t.heroQuickPatient} &rarr;</span>
          </Link>

          <Link
            href="/doctor/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-clinical-700 shadow-sm transition-all"
          >
            <Stethoscope className="h-4 w-4" />
            <span>{t.heroQuickDoctor} &rarr;</span>
          </Link>

          <Link
            href="/intake/new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-clinical-300 bg-white px-4 py-2.5 text-xs font-bold text-clinical-800 hover:bg-clinical-50 shadow-sm transition-all"
          >
            <Mic className="h-4 w-4 text-clinical-600" />
            <span>{t.heroQuickIntake}</span>
          </Link>
        </div>
      </section>

      {/* ─── The 4 Interactive Healthcare Paths ─── */}
      <section
        aria-labelledby="four-paths-heading"
        className="rounded-3xl border border-surface-200 bg-surface-50/70 p-6 sm:p-10 shadow-sm space-y-8"
      >
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-clinical-700">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>{t.pathsHeaderTag}</span>
          </div>
          <h2
            id="four-paths-heading"
            className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
          >
            {t.pathsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {t.pathsSubtitle}
          </p>
        </div>

        {/* 4 Responsive Pathway Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* ══════════ PATH 1: PATIENT PORTAL ══════════ */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-amber-300 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-amber-500 transition-all space-y-5">
            <div className="space-y-4">
              {/* Header Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-2xs">
                  <UserCircle className="h-7 w-7" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShareProfile(PORTAL_PROFILES.patient)}
                  title="Share Patient Profile & QR"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>{t.patientCard.shareBtn}</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">
                  {t.patientCard.pathTag}
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {t.patientCard.title}
                </h3>
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-amber-900 font-medium">
                    {t.patientCard.idLabel}
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.patient.uniqueId}</span>
                    <span className="text-[10px] text-amber-700">{t.patientCard.abhaLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    ABHA: {PORTAL_PROFILES.patient.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                {t.patientCard.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register / Onboarding */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/patient/portal"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.patientCard.loginBtn}</span>
              </Link>

              <button
                type="button"
                onClick={() => openOnboardingForRole("patient")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t.patientCard.registerBtn}</span>
              </button>
            </div>
          </div>

          {/* ══════════ PATH 2: DOCTOR PORTAL ══════════ */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-clinical-300 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-clinical-500 transition-all space-y-5">
            <div className="space-y-4">
              {/* Header Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700 shadow-2xs">
                  <Stethoscope className="h-7 w-7" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShareProfile(PORTAL_PROFILES.doctor)}
                  title="Share Clinician Profile & QR"
                  className="inline-flex items-center gap-1 rounded-full bg-clinical-50 px-2.5 py-1 text-[11px] font-bold text-clinical-800 border border-clinical-200 hover:bg-clinical-100 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>{t.doctorCard.shareBtn}</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-clinical-700 tracking-wider">
                  {t.doctorCard.pathTag}
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {t.doctorCard.title}
                </h3>
                <div className="rounded-xl bg-clinical-50/80 border border-clinical-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-clinical-900 font-medium">
                    {t.doctorCard.idLabel}
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.doctor.uniqueId}</span>
                    <span className="text-[10px] text-clinical-700">{t.doctorCard.councilLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Reg: {PORTAL_PROFILES.doctor.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                {t.doctorCard.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register / Onboarding */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/doctor/dashboard"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-clinical-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.doctorCard.loginBtn}</span>
              </Link>

              <button
                type="button"
                onClick={() => openOnboardingForRole("doctor")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-clinical-300 bg-clinical-50/70 px-4 py-2 text-xs font-bold text-clinical-900 hover:bg-clinical-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t.doctorCard.registerBtn}</span>
              </button>
            </div>
          </div>

          {/* ══════════ PATH 3: PHARMACY PORTAL ══════════ */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-300 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all space-y-5">
            <div className="space-y-4">
              {/* Header Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-2xs">
                  <Pill className="h-7 w-7" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShareProfile(PORTAL_PROFILES.pharmacy)}
                  title="Share Pharmacist Profile & QR"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>{t.pharmacyCard.shareBtn}</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">
                  {t.pharmacyCard.pathTag}
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {t.pharmacyCard.title}
                </h3>
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-emerald-900 font-medium">
                    {t.pharmacyCard.idLabel}
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.pharmacy.uniqueId}</span>
                    <span className="text-[10px] text-emerald-700">{t.pharmacyCard.licenseLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Lic: {PORTAL_PROFILES.pharmacy.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                {t.pharmacyCard.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register / Onboarding */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/pharmacy/queue"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.pharmacyCard.loginBtn}</span>
              </Link>

              <button
                type="button"
                onClick={() => openOnboardingForRole("pharmacy")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/70 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t.pharmacyCard.registerBtn}</span>
              </button>
            </div>
          </div>

          {/* ══════════ PATH 4: DIAGNOSTIC / SCAN PORTAL ══════════ */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-purple-300 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-purple-500 transition-all space-y-5">
            <div className="space-y-4">
              {/* Header Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-2xs">
                  <FlaskConical className="h-7 w-7" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShareProfile(PORTAL_PROFILES.diagnostic)}
                  title="Share Diagnostic Profile & QR"
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-800 border border-purple-200 hover:bg-purple-100 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>{t.diagnosticCard.shareBtn}</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">
                  {t.diagnosticCard.pathTag}
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {t.diagnosticCard.title}
                </h3>
                <div className="rounded-xl bg-purple-50/80 border border-purple-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-purple-900 font-medium">
                    {t.diagnosticCard.idLabel}
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.diagnostic.uniqueId}</span>
                    <span className="text-[10px] text-purple-700">{t.diagnosticCard.nablLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Accreditation: {PORTAL_PROFILES.diagnostic.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                {t.diagnosticCard.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register / Onboarding */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/diagnostics/queue"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.diagnosticCard.loginBtn}</span>
              </Link>

              <button
                type="button"
                onClick={() => openOnboardingForRole("diagnostic")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-purple-300 bg-purple-50/70 px-4 py-2 text-xs font-bold text-purple-900 hover:bg-purple-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t.diagnosticCard.registerBtn}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 max-w-4xl mx-auto flex items-start gap-2.5 text-left">
          <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">
              {t.disclaimerTitle}
            </strong>{" "}
            {t.disclaimerText}
          </div>
        </div>
      </section>

      {/* ─── Core Workflow Pillars ─── */}
      <section aria-label="System Capabilities" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t.pillars.p1Title}</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {t.pillars.p1Desc}
          </p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t.pillars.p2Title}</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {t.pillars.p2Desc}
          </p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t.pillars.p3Title}</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {t.pillars.p3Desc}
          </p>
        </div>
      </section>
    </div>
  );
}
