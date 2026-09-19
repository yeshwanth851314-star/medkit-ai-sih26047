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
  Shield,
  Activity,
  CheckCircle2,
  FlaskConical,
  Pill,
  Calendar,
  Users,
  Languages,
  Share2,
  LogIn,
  UserPlus,
  QrCode as QrIcon,
  Check,
  Building2,
} from "lucide-react";
import { DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";
import {
  LanguageSelectModal,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "@/components/landing/language-select-modal";
import {
  ShareProfileModal,
  ProfileShareData,
} from "@/components/shared/share-profile-modal";

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

  // Registration modal state for paths 3 & 4
  const [registerModalRole, setRegisterModalRole] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regLicense, setRegLicense] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);

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

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccessMessage(
      `Registration request submitted for ${regName}! Institutional approval pending. You can access the live portal immediately via Quick Login.`
    );
    setTimeout(() => {
      setRegSuccessMessage(null);
      setRegisterModalRole(null);
      setRegName("");
      setRegLicense("");
      setRegEmail("");
    }, 3500);
  };

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

      {/* ─── Top Utility Bar (Language & Provenance) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-clinical-50/80 px-3.5 py-1.5 text-xs font-semibold text-clinical-800 shadow-2xs">
          <HeartPulse className="h-4 w-4 text-clinical-600" aria-hidden="true" />
          <span>SIH26047 — Patient Case-Taking Software • Ministry of Ayush / AIIA</span>
        </div>

        {/* Global Language Switcher Trigger */}
        <button
          type="button"
          onClick={() => setIsLangModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-surface-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-clinical-500 hover:text-clinical-700 transition-all self-start sm:self-auto"
        >
          <Languages className="h-4 w-4 text-clinical-600" />
          <span>Language: {activeLanguage.nativeName} ({activeLanguage.name})</span>
          <span className="text-[10px] rounded bg-clinical-100 text-clinical-800 px-1.5 py-0.5 uppercase font-extrabold">
            Change
          </span>
        </button>
      </div>

      {/* ─── Hero Header ─── */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          MedKit AI
        </h1>

        <p className="text-lg font-medium text-clinical-800 sm:text-xl">
          Intelligent Multimodal Clinical Intake &amp; Connected Hospital Continuum
        </p>

        <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl mx-auto">
          Unified healthcare portal connecting patients, physicians, pharmacies, and diagnostic laboratories with unique institutional IDs, shareable profiles, and zero-loss longitudinal timelines.
        </p>

        <div className="text-xs text-clinical-700 font-semibold bg-clinical-50 py-1.5 px-4 rounded-full inline-block border border-clinical-200">
          {activeLanguage.greeting}
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
            <span>Hospital Ecosystem Pathways</span>
          </div>
          <h2
            id="four-paths-heading"
            className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
          >
            Select Your Healthcare Portal Pathway
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Every participant possesses a verified unique identifier and shareable profile card. Choose Login or New Registration below.
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
                  <span>Share Profile</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">
                  Path 1 &bull; Citizen &amp; Outpatient
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Patient Portal
                </h3>
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-amber-900 font-medium">
                    Unique Patient ID:
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.patient.uniqueId}</span>
                    <span className="text-[10px] text-amber-700">ABHA Linked</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    ABHA: {PORTAL_PROFILES.patient.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Longitudinal Medical History</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Diagnostic Lab Reports &amp; Scans</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>1-Time Prescriptions &amp; QR Codes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Consultation Appointment Booking</span>
                </li>
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/patient/portal"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Patient Login / Dashboard &rarr;</span>
              </Link>

              <Link
                href="/intake/new"
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Registration / Intake</span>
              </Link>
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
                  <span>Share Profile</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-clinical-700 tracking-wider">
                  Path 2 &bull; Physician &amp; Vaidya
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Doctor Portal
                </h3>
                <div className="rounded-xl bg-clinical-50/80 border border-clinical-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-clinical-900 font-medium">
                    Unique Clinician ID:
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.doctor.uniqueId}</span>
                    <span className="text-[10px] text-clinical-700">AIIA Senior</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Council: {PORTAL_PROFILES.doctor.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                  <span>Doctor Availability Updater</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                  <span>Waiting, Applied &amp; Done OPDs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                  <span>Accept / Cancel Patient Queues</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                  <span>Detailed AI Case Summary &amp; Copilot</span>
                </li>
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/doctor/dashboard"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-clinical-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Doctor Login / Dashboard &rarr;</span>
              </Link>

              <Link
                href="/register"
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-clinical-300 bg-clinical-50/70 px-4 py-2 text-xs font-bold text-clinical-900 hover:bg-clinical-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Doctor Registration</span>
              </Link>
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
                  <span>Share Profile</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">
                  Path 3 &bull; Dispensary &amp; Stock
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Pharmacy Portal
                </h3>
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-emerald-900 font-medium">
                    Unique Pharmacist ID:
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.pharmacy.uniqueId}</span>
                    <span className="text-[10px] text-emerald-700">Reg. Dispensary</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Lic: {PORTAL_PROFILES.pharmacy.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Uncompleted &amp; New Prescriptions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Old / Dispensed Prescription History</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Inventory Stock Quantity Updater</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Prescription QR Scanner &amp; Clarification</span>
                </li>
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/pharmacy/queue"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Pharmacy Login / Queue &rarr;</span>
              </Link>

              <button
                type="button"
                onClick={() => setRegisterModalRole("pharmacy")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/70 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Dispensary Registration</span>
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
                  <span>Share Profile</span>
                </button>
              </div>

              {/* Title & Unique ID */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">
                  Path 4 &bull; Pathology &amp; Scans
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Diagnostic Portal
                </h3>
                <div className="rounded-xl bg-purple-50/80 border border-purple-200 p-2.5 text-left space-y-1">
                  <div className="text-[10px] text-purple-900 font-medium">
                    Unique Technologist ID:
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{PORTAL_PROFILES.diagnostic.uniqueId}</span>
                    <span className="text-[10px] text-purple-700">NABL Lab</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Accreditation: {PORTAL_PROFILES.diagnostic.secondaryIdValue}
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-600 border-t border-surface-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>Laboratory Test Accessioning</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>Diagnostic Scans &amp; Imaging Viewer</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>Formatted NABL Printable Reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>Instant Doctor Notification Sync</span>
                </li>
              </ul>
            </div>

            {/* Dual Action Buttons: Login & Register */}
            <div className="space-y-2 pt-2 border-t border-surface-100">
              <Link
                href="/diagnostics/queue"
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-800 transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Diagnostic Login / Queue &rarr;</span>
              </Link>

              <button
                type="button"
                onClick={() => setRegisterModalRole("diagnostic")}
                className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-xl border border-purple-300 bg-purple-50/70 px-4 py-2 text-xs font-bold text-purple-900 hover:bg-purple-100 transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Lab Registration</span>
              </button>
            </div>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 max-w-4xl mx-auto flex items-start gap-2.5 text-left">
          <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">Clinical Governance &amp; Safety Boundary:</strong> MedKit AI assists with clinical history acquisition, triage coordination, and documentation under Ministry of Ayush &amp; AIIA guidelines. Final diagnosis and prescribing authority remains strictly with certified clinical practitioners.
          </div>
        </div>
      </section>

      {/* ─── Core Workflow Pillars ─── */}
      <section aria-label="System Capabilities" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Multimodal Intake &amp; 5 Indian Languages</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Voice-to-text with English, Hindi, Telugu, Tamil, and Kannada speech intake, dynamic question graph, and instant touch fallback.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Document OCR &amp; Diagnostic Scans</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Digitize paper prescriptions, lab reports, and imaging scans with confidence scores, source references, and printable NABL reports.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Longitudinal Clinical Timeline</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Signature longitudinal view answering &quot;What changed since the last visit?&quot; comparing current and past encounters cleanly.
          </p>
        </div>
      </section>

      {/* ─── Institutional Registration Modal for Dispensary & Diagnostics ─── */}
      {registerModalRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-clinical-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {registerModalRole === "pharmacy"
                    ? "New Dispensary / Pharmacy Registration"
                    : "New Diagnostic Center Registration"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalRole(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {regSuccessMessage ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs sm:text-sm text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Application Submitted Successfully</span>
                </div>
                <p>{regSuccessMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Facility / Center Name:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AIIA South Annex Dispensary"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {registerModalRole === "pharmacy"
                      ? "Pharmacy State License Number:"
                      : "NABL Accreditation / Lab License Number:"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      registerModalRole === "pharmacy"
                        ? "e.g. TS-PHARM-2026-999"
                        : "e.g. NABL-MED-999"
                    }
                    value={regLicense}
                    onChange={(e) => setRegLicense(e.target.value)}
                    className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Official Administrative Email:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@facility.ayush.gov.in"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterModalRole(null)}
                    className="rounded-xl border border-surface-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-clinical-600 px-5 py-2 text-xs font-bold text-white hover:bg-clinical-700 shadow"
                  >
                    Submit Registration
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
