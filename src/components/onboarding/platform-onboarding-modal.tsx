"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  UserCircle,
  Stethoscope,
  Pill,
  FlaskConical,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Sparkles,
  QrCode as QrIcon,
  Activity,
  HeartPulse,
  Calendar,
  X,
} from "lucide-react";
import { QrCode } from "@/components/shared/qr-code";

export type OnboardingRole = "patient" | "doctor" | "pharmacy" | "diagnostic";

interface PlatformOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: OnboardingRole;
  languageCode?: string;
}

export function PlatformOnboardingModal({
  isOpen,
  onClose,
  initialRole = "patient",
  languageCode = "en",
}: PlatformOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(initialRole);

  // Registration form inputs
  const [fullName, setFullName] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [facility, setFacility] = useState("AIIA Central Hospital");
  const [department, setDepartment] = useState("General Medicine & Kayachikitsa");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [generatedId, setGeneratedId] = useState("");

  if (!isOpen) return null;

  const handleRoleSelect = (role: OnboardingRole) => {
    setSelectedRole(role);
    if (role === "patient") {
      setFullName("Rajesh Kumar");
      setSecondaryId("91-4820-1940-2811");
      setDepartment("Outpatient Services (OPD)");
      setGeneratedId("MED-2026-1001");
    } else if (role === "doctor") {
      setFullName("Dr. Ananya Sharma, MD (AIIA)");
      setSecondaryId("MCI-AYUSH-2024-589");
      setDepartment("General Medicine & Kayachikitsa");
      setGeneratedId("AIIA-DOC-8921");
    } else if (role === "pharmacy") {
      setFullName("Venkatesh Iyer, B.Pharm");
      setSecondaryId("TS-PHARM-2026-902");
      setDepartment("Dispensary Unit #1");
      setGeneratedId("PHARM-7741");
    } else {
      setFullName("Ramesh V., M.Sc MLT");
      setSecondaryId("NABL-MED-883");
      setDepartment("Biochemistry, Hematology & Radiology");
      setGeneratedId("LAB-TECH-4092");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    let newId = "";
    if (selectedRole === "patient") newId = `MED-2026-${randomSuffix}`;
    else if (selectedRole === "doctor") newId = `AIIA-DOC-${randomSuffix}`;
    else if (selectedRole === "pharmacy") newId = `PHARM-${randomSuffix}`;
    else newId = `LAB-TECH-${randomSuffix}`;

    setGeneratedId(newId);
    setIsRegistered(true);
    setStep(3);
  };

  const getPortalUrl = () => {
    if (selectedRole === "patient") return "/patient/portal";
    if (selectedRole === "doctor") return "/doctor/dashboard";
    if (selectedRole === "pharmacy") return "/pharmacy/queue";
    return "/diagnostics/queue";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-surface-100 hover:text-slate-700 transition-colors"
          aria-label="Close onboarding modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-surface-200 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clinical-600 text-white shadow">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-clinical-700">
              <span>MedKit AI • Hospital Continuum Onboarding</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Welcome to MedKit AI Platform
            </h2>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div
            className={`rounded-xl py-2 px-3 border transition-colors ${
              step === 1
                ? "bg-clinical-50 border-clinical-500 text-clinical-800"
                : "bg-surface-50 border-surface-200 text-slate-500"
            }`}
          >
            1. Select Your Role
          </div>
          <div
            className={`rounded-xl py-2 px-3 border transition-colors ${
              step === 2
                ? "bg-clinical-50 border-clinical-500 text-clinical-800"
                : "bg-surface-50 border-surface-200 text-slate-500"
            }`}
          >
            2. Register &amp; ID Card
          </div>
          <div
            className={`rounded-xl py-2 px-3 border transition-colors ${
              step === 3
                ? "bg-clinical-50 border-clinical-500 text-clinical-800"
                : "bg-surface-50 border-surface-200 text-slate-500"
            }`}
          >
            3. Continuum Guide
          </div>
        </div>

        {/* ─── STEP 1: ROLE SELECTION ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center sm:text-left">
              <h3 className="text-base font-bold text-slate-900">
                Choose your participation pathway:
              </h3>
              <p className="text-xs text-slate-600">
                Each role receives a verified institutional credential ID and full access to their connected portal.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Patient */}
              <button
                type="button"
                onClick={() => handleRoleSelect("patient")}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedRole === "patient"
                    ? "border-amber-500 bg-amber-50/60 shadow-sm"
                    : "border-surface-200 hover:border-amber-300 bg-white"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <UserCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">Path 1: Patient</div>
                  <div className="text-[11px] text-slate-600 leading-tight">
                    Medical history, lab reports, scans, 1-time prescriptions with QR, and OPD booking.
                  </div>
                </div>
              </button>

              {/* Doctor */}
              <button
                type="button"
                onClick={() => handleRoleSelect("doctor")}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedRole === "doctor"
                    ? "border-clinical-500 bg-clinical-50/60 shadow-sm"
                    : "border-surface-200 hover:border-clinical-300 bg-white"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">Path 2: Doctor</div>
                  <div className="text-[11px] text-slate-600 leading-tight">
                    Manage availability, handle waiting/applied/completed OPDs, AI case summaries.
                  </div>
                </div>
              </button>

              {/* Pharmacy */}
              <button
                type="button"
                onClick={() => handleRoleSelect("pharmacy")}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedRole === "pharmacy"
                    ? "border-emerald-500 bg-emerald-50/60 shadow-sm"
                    : "border-surface-200 hover:border-emerald-300 bg-white"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Pill className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">Path 3: Pharmacy</div>
                  <div className="text-[11px] text-slate-600 leading-tight">
                    Uncompleted &amp; completed prescriptions, inventory stock updater, dispensary scan.
                  </div>
                </div>
              </button>

              {/* Diagnostics */}
              <button
                type="button"
                onClick={() => handleRoleSelect("diagnostic")}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedRole === "diagnostic"
                    ? "border-purple-500 bg-purple-50/60 shadow-sm"
                    : "border-surface-200 hover:border-purple-300 bg-white"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">Path 4: Diagnostics</div>
                  <div className="text-[11px] text-slate-600 leading-tight">
                    Specimen accessioning, test entry, imaging viewer, printable NABL report.
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  handleRoleSelect(selectedRole);
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-clinical-600 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-clinical-700 transition-colors"
              >
                <span>Continue with {selectedRole.toUpperCase()} &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: REGISTRATION & CREDENTIAL PROVISIONING ─── */}
        {step === 2 && (
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div className="text-center sm:text-left">
              <h3 className="text-base font-bold text-slate-900">
                Register &amp; Generate Institutional Credential
              </h3>
              <p className="text-xs text-slate-600">
                Provide or confirm your details below to generate your unique verified credential ID and QR code.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Legal Name:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {selectedRole === "patient"
                    ? "ABHA Health ID / Aadhaar Ref:"
                    : selectedRole === "doctor"
                    ? "Medical Council Reg. Number:"
                    : selectedRole === "pharmacy"
                    ? "Pharmacy State License Number:"
                    : "NABL Accreditation / Lab ID:"}
                </label>
                <input
                  type="text"
                  required
                  value={secondaryId}
                  onChange={(e) => setSecondaryId(e.target.value)}
                  placeholder="e.g. 91-4820-1940-2811"
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Facility / Institution:</label>
                <input
                  type="text"
                  required
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department / Unit:</label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 p-2.5 text-xs text-slate-900 focus:border-clinical-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-clinical-50 border border-clinical-200 p-3.5 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-clinical-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-clinical-900 leading-relaxed">
                <strong>Government &amp; Ministry of Ayush Compliant:</strong> Your credential will be provably stamped with institutional metadata, enabling seamless interoperability and verification across hospitals and clinics.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-200">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-clinical-600 px-6 py-2 text-xs font-bold text-white hover:bg-clinical-700 shadow"
              >
                <span>Generate ID &amp; Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP 3: ECOSYSTEM CONTINUUM & DIRECT ENTRY ─── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Generated ID Card Preview */}
            <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50/70 via-white to-clinical-50/70 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-extrabold text-sm text-slate-900">
                    Credential Provisioned &amp; Verified
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-extrabold uppercase">
                  Active in System
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1.5 text-xs text-left w-full">
                  <div className="text-base font-black text-slate-900">{fullName}</div>
                  <div className="font-mono text-xs font-bold text-clinical-800">
                    Unique ID: {generatedId}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Authority: {secondaryId} &bull; {facility}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Department: {department}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-surface-200 text-center">
                  <QrCode
                    value={`https://medkit-ai-sih26047.vercel.app/verify/profile?id=${generatedId}&role=${selectedRole}`}
                    size={80}
                    title="Verified Credential QR"
                  />
                  <div className="text-[9px] font-extrabold uppercase text-slate-500 mt-1">
                    Scan to Verify
                  </div>
                </div>
              </div>
            </div>

            {/* The 4-Step Connected Hospital Flow */}
            <div className="space-y-2">
              <div className="font-bold text-xs text-slate-900">
                How Your Role Works in the Connected Continuum:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-1">
                  <div className="font-bold text-clinical-900 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clinical-600 text-white text-[10px]">1</span>
                    Patient Appointment Booking
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Patients select department and apply. The booking immediately syncs to the Doctor&apos;s Applied OPD queue.
                  </p>
                </div>

                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-1">
                  <div className="font-bold text-clinical-900 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clinical-600 text-white text-[10px]">2</span>
                    Doctor OPD &amp; Live Calling
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Doctors update availability and click &quot;Accept &amp; Call Patient&quot;, sending an instant notification to the patient.
                  </p>
                </div>

                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-1">
                  <div className="font-bold text-clinical-900 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clinical-600 text-white text-[10px]">3</span>
                    1-Time QR Prescriptions
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Prescriptions generate a unique dispensary QR. Pharmacists review uncompleted orders and adjust live inventory.
                  </p>
                </div>

                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-1">
                  <div className="font-bold text-clinical-900 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clinical-600 text-white text-[10px]">4</span>
                    Diagnostic Labs &amp; Imaging
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Pathology results (CBC flags, Chest X-Rays) produce printable NABL reports with direct physician notification.
                  </p>
                </div>
              </div>
            </div>

            {/* Launch Workspace Button */}
            <div className="pt-2 flex items-center justify-between border-t border-surface-200">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Edit Details</span>
              </button>

              <Link
                href={getPortalUrl()}
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-clinical-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-clinical-700 shadow-md transition-colors"
              >
                <span>Launch {selectedRole.toUpperCase()} Portal &rarr;</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
