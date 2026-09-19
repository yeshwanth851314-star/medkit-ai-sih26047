"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Activity,
  Stethoscope,
  Users,
  Sparkles,
  Menu,
  X,
  Languages,
  PlayCircle,
  Share2,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  Clock,
  CheckCircle2,
  PlusCircle,
  ShieldCheck,
  Building2,
  UserCircle,
} from "lucide-react";
import { ProviderBadge } from "./provider-badge";
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
import { PORTAL_PROFILES } from "@/lib/auth/portal-profiles";

const DoctorHelpMenu = dynamic(
  () => import("@/components/help/doctor-help-menu").then((m) => m.DoctorHelpMenu),
  { ssr: false }
);

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstNavLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Global Language Modal state
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(
    SUPPORTED_LANGUAGES[0]
  );

  // Global Profile Share Modal state
  const [shareProfile, setShareProfile] = useState<ProfileShareData | null>(null);

  // Global Onboarding Tour Modal state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingRole, setOnboardingRole] = useState<OnboardingRole>("patient");

  // Sync saved language on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCode = localStorage.getItem("medkit_language");
      if (savedCode) {
        const found = SUPPORTED_LANGUAGES.find((l) => l.code === savedCode);
        if (found) setActiveLanguage(found);
      }
      const handler = (e: any) => {
        if (e.detail) setActiveLanguage(e.detail);
      };
      window.addEventListener("medkit:language-change", handler);
      return () => window.removeEventListener("medkit:language-change", handler);
    }
  }, []);

  // Keyboard accessibility
  useEffect(() => {
    if (mobileMenuOpen) {
      firstNavLinkRef.current?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Active path helpers
  const isDoctorActive = pathname?.startsWith("/doctor");
  const isPatientActive = pathname?.startsWith("/patient");
  const isPharmacyActive = pathname?.startsWith("/pharmacy");
  const isDiagnosticActive = pathname?.startsWith("/diagnostics");
  const isOpdActive = pathname?.startsWith("/opd");
  const isIntakeActive = pathname?.startsWith("/intake");

  const openOnboarding = (role: OnboardingRole = "patient") => {
    setOnboardingRole(role);
    setIsOnboardingOpen(true);
  };

  const triggerPatientBooking = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medkit:open-booking"));
    }
  };

  return (
    <>
      {/* ─── Global Modals Mounted at Root ─── */}
      <LanguageSelectModal
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
        onSelectLanguage={(lang) => setActiveLanguage(lang)}
      />

      {shareProfile && (
        <ShareProfileModal
          isOpen={!!shareProfile}
          onClose={() => setShareProfile(null)}
          profile={shareProfile}
        />
      )}

      <PlatformOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        initialRole={onboardingRole}
        languageCode={activeLanguage.code}
      />

      <header className="sticky top-0 z-40 w-full border-b border-surface-200 bg-white/95 backdrop-blur shadow-sm">
        {/* ─── Primary Navigation Header ─── */}
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Mobile menu toggle */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>

            {/* Platform Brand */}
            <Link
              href="/"
              className="flex items-center gap-2 text-clinical-900 font-bold text-lg tracking-tight shrink-0"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-white shadow"
                aria-hidden="true"
              >
                <Activity className="h-5 w-5" />
              </div>
              <span className="hidden xs:inline">MedKit AI</span>
              <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-clinical-100 text-clinical-800 border border-clinical-200">
                SIH26047
              </span>
            </Link>

            {/* ─── 5 Main Tab Navigation Links with Active Highlighting ─── */}
            <nav
              aria-label="Main navigation"
              className="hidden lg:flex items-center gap-1 text-xs font-bold text-slate-600"
            >
              {/* Tab 1: Doctor */}
              <Link
                href="/doctor/dashboard"
                className={`flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isDoctorActive
                    ? "bg-clinical-50 border border-clinical-300 text-clinical-800 font-extrabold shadow-2xs"
                    : "hover:bg-surface-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <Stethoscope
                  className={`h-4 w-4 ${
                    isDoctorActive ? "text-clinical-700" : "text-clinical-600"
                  }`}
                  aria-hidden="true"
                />
                <span>Doctor</span>
              </Link>

              {/* Tab 2: Patient Portal */}
              <Link
                href="/patient/portal"
                className={`flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isPatientActive
                    ? "bg-amber-50 border border-amber-300 text-amber-900 font-extrabold shadow-2xs"
                    : "hover:bg-surface-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <Sparkles
                  className={`h-4 w-4 ${
                    isPatientActive ? "text-amber-600" : "text-amber-500"
                  }`}
                  aria-hidden="true"
                />
                <span>Patient Portal</span>
              </Link>

              {/* Tab 3: Pharmacy */}
              <Link
                href="/pharmacy/queue"
                className={`flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isPharmacyActive
                    ? "bg-emerald-50 border border-emerald-300 text-emerald-900 font-extrabold shadow-2xs"
                    : "hover:bg-surface-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <Pill
                  className={`h-4 w-4 ${
                    isPharmacyActive ? "text-emerald-700" : "text-emerald-600"
                  }`}
                  aria-hidden="true"
                />
                <span>Pharmacy</span>
              </Link>

              {/* Tab 4: Diagnostics */}
              <Link
                href="/diagnostics/queue"
                className={`flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isDiagnosticActive
                    ? "bg-purple-50 border border-purple-300 text-purple-900 font-extrabold shadow-2xs"
                    : "hover:bg-surface-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <FlaskConical
                  className={`h-4 w-4 ${
                    isDiagnosticActive ? "text-purple-700" : "text-purple-600"
                  }`}
                  aria-hidden="true"
                />
                <span>Diagnostics</span>
              </Link>

              {/* Tab 5: OPD Queue */}
              <Link
                href="/opd/queue"
                className={`flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isOpdActive
                    ? "bg-blue-50 border border-blue-300 text-blue-900 font-extrabold shadow-2xs"
                    : "hover:bg-surface-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <Users
                  className={`h-4 w-4 ${
                    isOpdActive ? "text-blue-700" : "text-blue-600"
                  }`}
                  aria-hidden="true"
                />
                <span>OPD Queue</span>
              </Link>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Global Language Selector Trigger in Header */}
            <button
              type="button"
              onClick={() => setIsLangModalOpen(true)}
              title="Change Platform Language"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-clinical-400 hover:text-clinical-700 shadow-2xs transition-colors"
            >
              <Languages className="h-3.5 w-3.5 text-clinical-600" />
              <span className="hidden sm:inline">{activeLanguage.nativeName}</span>
              <span className="text-[10px] rounded bg-clinical-100 text-clinical-800 px-1 py-0.2 uppercase font-extrabold">
                {activeLanguage.code}
              </span>
            </button>

            {/* Platform Onboarding Tour Trigger */}
            <button
              type="button"
              onClick={() => openOnboarding("patient")}
              title="Start Platform Onboarding & Walkthrough"
              className="hidden sm:inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-clinical-200 bg-clinical-50/70 px-3 py-1.5 text-xs font-bold text-clinical-800 hover:bg-clinical-100 shadow-2xs transition-colors"
            >
              <PlayCircle className="h-3.5 w-3.5 text-clinical-600" />
              <span>Tour</span>
            </button>

            <DoctorHelpMenu />
            <ProviderBadge />

            {/* Primary New Intake Button */}
            <Link
              href="/intake/new"
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-clinical-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors ${
                isIntakeActive ? "ring-2 ring-clinical-400 ring-offset-1" : ""
              }`}
            >
              <span>New Intake</span>
            </Link>
          </div>
        </div>

        {/* ─── Contextual Sub-Menu Bar for Each Tab & Required Requirements ─── */}
        {/* 1. PATIENT PORTAL TAB REQUIREMENTS */}
        {isPatientActive && (
          <div className="border-t border-amber-200 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900 border border-amber-300">
                  <UserCircle className="h-3.5 w-3.5" />
                  <span>Patient • Rajesh Kumar (MED-2026-1001)</span>
                </span>
                <span className="hidden md:inline text-slate-500 text-[11px]">
                  ABHA: 91-4820-1940-2811
                </span>
              </div>

              {/* Contextual Requirements Links */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={triggerPatientBooking}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-800 shadow-2xs transition-colors"
                >
                  <Calendar className="h-3 w-3" />
                  <span>Book OPD Appointment</span>
                </button>

                <Link
                  href="/patient/portal#reports"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50 transition-colors"
                >
                  <FlaskConical className="h-3 w-3 text-amber-600" />
                  <span>Reports &amp; Scans</span>
                </Link>

                <Link
                  href="/patient/portal#prescriptions"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50 transition-colors"
                >
                  <Pill className="h-3 w-3 text-amber-600" />
                  <span>Prescriptions (QR)</span>
                </Link>

                <Link
                  href="/patient/portal#history"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50 transition-colors"
                >
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span>Medical History</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShareProfile(PORTAL_PROFILES.patient)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-100/70 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-200 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Share ID &amp; QR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. DOCTOR WORKSPACE TAB REQUIREMENTS */}
        {isDoctorActive && (
          <div className="border-t border-clinical-200 bg-gradient-to-r from-clinical-50/90 via-clinical-50/50 to-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-clinical-100 px-2.5 py-1 text-[11px] font-black text-clinical-900 border border-clinical-300">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>Doctor • Dr. Ananya Sharma (AIIA-DOC-8921)</span>
                </span>
                <span className="hidden md:inline text-slate-500 text-[11px]">
                  Kayachikitsa &bull; AIIA OPD #4
                </span>
              </div>

              {/* Contextual Requirements Links */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Link
                  href="/doctor/dashboard#waiting"
                  className="inline-flex items-center gap-1 rounded-lg border border-clinical-300 bg-white px-2.5 py-1 text-xs font-bold text-clinical-900 hover:bg-clinical-50 transition-colors"
                >
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span>Waiting Queue</span>
                </Link>

                <Link
                  href="/doctor/dashboard#applied"
                  className="inline-flex items-center gap-1 rounded-lg border border-clinical-300 bg-white px-2.5 py-1 text-xs font-bold text-clinical-900 hover:bg-clinical-50 transition-colors"
                >
                  <Calendar className="h-3 w-3 text-blue-600" />
                  <span>Applied OPDs</span>
                </Link>

                <Link
                  href="/doctor/dashboard#completed"
                  className="inline-flex items-center gap-1 rounded-lg border border-clinical-300 bg-white px-2.5 py-1 text-xs font-bold text-clinical-900 hover:bg-clinical-50 transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Completed</span>
                </Link>

                <Link
                  href="/doctor/cases/new"
                  className="inline-flex items-center gap-1 rounded-lg bg-clinical-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-clinical-700 shadow-2xs transition-colors"
                >
                  <PlusCircle className="h-3 w-3" />
                  <span>New Case</span>
                </Link>

                <Link
                  href="/doctor/patients"
                  className="inline-flex items-center gap-1 rounded-lg border border-clinical-300 bg-white px-2.5 py-1 text-xs font-bold text-clinical-900 hover:bg-clinical-50 transition-colors"
                >
                  <Users className="h-3 w-3 text-clinical-600" />
                  <span>Patient Records</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShareProfile(PORTAL_PROFILES.doctor)}
                  className="inline-flex items-center gap-1 rounded-lg border border-clinical-300 bg-clinical-100/70 px-2.5 py-1 text-xs font-bold text-clinical-900 hover:bg-clinical-200 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Share ID &amp; QR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. PHARMACY TAB REQUIREMENTS */}
        {isPharmacyActive && (
          <div className="border-t border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-emerald-50/50 to-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-900 border border-emerald-300">
                  <Pill className="h-3.5 w-3.5" />
                  <span>Pharmacy • Venkatesh Iyer (PHARM-7741)</span>
                </span>
                <span className="hidden md:inline text-slate-500 text-[11px]">
                  License: TS-PHARM-2026-902 &bull; Unit #1
                </span>
              </div>

              {/* Contextual Requirements Links */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                  Dispensary Requirements:
                </span>

                <Link
                  href="/pharmacy/queue"
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition-colors"
                >
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span>Uncompleted Prescriptions</span>
                </Link>

                <Link
                  href="/pharmacy/queue"
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Dispensed Ledger</span>
                </Link>

                <Link
                  href="/pharmacy/queue"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
                >
                  <Building2 className="h-3 w-3" />
                  <span>Inventory Stock Manager</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShareProfile(PORTAL_PROFILES.pharmacy)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100/70 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-200 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Share ID &amp; QR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. DIAGNOSTICS TAB REQUIREMENTS */}
        {isDiagnosticActive && (
          <div className="border-t border-purple-200 bg-gradient-to-r from-purple-50/90 via-purple-50/50 to-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-purple-100 px-2.5 py-1 text-[11px] font-black text-purple-900 border border-purple-300">
                  <FlaskConical className="h-3.5 w-3.5" />
                  <span>Diagnostics • Ramesh V. (LAB-TECH-4092)</span>
                </span>
                <span className="hidden md:inline text-slate-500 text-[11px]">
                  NABL: NABL-MED-883 &bull; ISO 15189
                </span>
              </div>

              {/* Contextual Requirements Links */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                  Laboratory Requirements:
                </span>

                <Link
                  href="/diagnostics/queue"
                  className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-xs font-bold text-purple-900 hover:bg-purple-50 transition-colors"
                >
                  <Clock className="h-3 w-3 text-purple-600" />
                  <span>Accessioning Queue</span>
                </Link>

                <Link
                  href="/diagnostics/queue"
                  className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-xs font-bold text-purple-900 hover:bg-purple-50 transition-colors"
                >
                  <Activity className="h-3 w-3 text-purple-600" />
                  <span>Enter Results &amp; Scans</span>
                </Link>

                <Link
                  href="/diagnostics/queue"
                  className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-700 shadow-2xs transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  <span>Printable NABL Reports</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShareProfile(PORTAL_PROFILES.diagnostic)}
                  className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-100/70 px-2.5 py-1 text-xs font-bold text-purple-900 hover:bg-purple-200 transition-colors"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Share ID &amp; QR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. OPD QUEUE TAB REQUIREMENTS */}
        {isOpdActive && (
          <div className="border-t border-blue-200 bg-gradient-to-r from-blue-50/90 via-blue-50/50 to-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-900 border border-blue-300">
                  <Users className="h-3.5 w-3.5" />
                  <span>AIIA Central Hospital • Live OPD Triage Stream</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/opd/queue"
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs transition-colors"
                >
                  <Clock className="h-3 w-3" />
                  <span>Live Waiting Tokens</span>
                </Link>
                <Link
                  href="/doctor/dashboard"
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-bold text-blue-900 hover:bg-blue-50 transition-colors"
                >
                  <Stethoscope className="h-3 w-3 text-blue-600" />
                  <span>Doctor Desk Sync</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── Mobile Disclosure Navigation ─── */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 top-16 z-50 border-b border-surface-200 bg-white p-4 shadow-lg md:hidden animate-in slide-in-from-top-2 duration-150 max-h-[85vh] overflow-y-auto space-y-4"
        >
          {/* Quick utility triggers in mobile */}
          <div className="flex items-center justify-between gap-2 border-b border-surface-200 pb-3">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsLangModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              <Languages className="h-4 w-4 text-clinical-600" />
              <span>{activeLanguage.nativeName}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openOnboarding("patient");
              }}
              className="flex items-center gap-1.5 rounded-xl bg-clinical-50 border border-clinical-200 px-3 py-1.5 text-xs font-bold text-clinical-800"
            >
              <PlayCircle className="h-4 w-4 text-clinical-600" />
              <span>Platform Tour</span>
            </button>
          </div>

          <nav aria-label="Mobile navigation" className="flex flex-col gap-2 text-xs">
            {/* Doctor */}
            <div className="rounded-xl border border-clinical-200 p-2 space-y-1">
              <Link
                ref={firstNavLinkRef}
                href="/doctor/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between font-bold text-clinical-900 p-1.5 rounded-lg hover:bg-clinical-50"
              >
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-clinical-600" />
                  <span>Doctor Portal</span>
                </div>
                <span className="text-[10px] text-clinical-700 font-mono">AIIA-DOC-8921</span>
              </Link>
              <div className="pl-6 flex flex-wrap gap-1 pt-1 text-[11px]">
                <Link
                  href="/doctor/dashboard#waiting"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  Waiting OPDs
                </Link>
                <Link
                  href="/doctor/dashboard#applied"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  Applied OPDs
                </Link>
                <Link
                  href="/doctor/cases/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-clinical-100 text-clinical-800 font-bold px-2 py-0.5"
                >
                  + New Case
                </Link>
              </div>
            </div>

            {/* Patient Portal */}
            <div className="rounded-xl border border-amber-200 p-2 space-y-1">
              <Link
                href="/patient/portal"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between font-bold text-amber-900 p-1.5 rounded-lg hover:bg-amber-50"
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-amber-600" />
                  <span>Patient Portal</span>
                </div>
                <span className="text-[10px] text-amber-700 font-mono">MED-2026-1001</span>
              </Link>
              <div className="pl-6 flex flex-wrap gap-1 pt-1 text-[11px]">
                <Link
                  href="/patient/portal?book=true"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-amber-100 text-amber-900 font-bold px-2 py-0.5"
                >
                  Book Appointment
                </Link>
                <Link
                  href="/patient/portal#reports"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  Reports &amp; Scans
                </Link>
                <Link
                  href="/patient/portal#prescriptions"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  1-Time QR Prescriptions
                </Link>
              </div>
            </div>

            {/* Pharmacy */}
            <div className="rounded-xl border border-emerald-200 p-2 space-y-1">
              <Link
                href="/pharmacy/queue"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between font-bold text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-50"
              >
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  <span>Pharmacy Portal</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-mono">PHARM-7741</span>
              </Link>
              <div className="pl-6 flex flex-wrap gap-1 pt-1 text-[11px]">
                <Link
                  href="/pharmacy/queue"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  Uncompleted List
                </Link>
                <Link
                  href="/pharmacy/queue"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5"
                >
                  Update Inventory Stock
                </Link>
              </div>
            </div>

            {/* Diagnostics */}
            <div className="rounded-xl border border-purple-200 p-2 space-y-1">
              <Link
                href="/diagnostics/queue"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between font-bold text-purple-900 p-1.5 rounded-lg hover:bg-purple-50"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-purple-600" />
                  <span>Diagnostic Lab</span>
                </div>
                <span className="text-[10px] text-purple-700 font-mono">LAB-TECH-4092</span>
              </Link>
              <div className="pl-6 flex flex-wrap gap-1 pt-1 text-[11px]">
                <Link
                  href="/diagnostics/queue"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-surface-100 px-2 py-0.5 text-slate-700"
                >
                  Accessioning
                </Link>
                <Link
                  href="/diagnostics/queue"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded bg-purple-100 text-purple-800 font-bold px-2 py-0.5"
                >
                  Printable NABL Report
                </Link>
              </div>
            </div>

            {/* OPD Queue */}
            <Link
              href="/opd/queue"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-surface-200 p-2.5 font-bold text-slate-800 hover:bg-surface-50"
            >
              <Users className="h-4 w-4 text-blue-600" />
              <span>Live OPD Triage Queue</span>
            </Link>

            {/* New Intake */}
            <Link
              href="/intake/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-clinical-600 p-3 font-bold text-white shadow hover:bg-clinical-700 text-center"
            >
              <Activity className="h-4 w-4" />
              <span>Start New Clinical Intake</span>
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
