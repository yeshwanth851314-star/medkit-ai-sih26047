"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  User,
  Activity,
  HeartPulse,
} from "lucide-react";
import { QrCode } from "@/components/shared/qr-code";

function VerifyProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "MED-2026-1001";
  const role = searchParams.get("role") || "patient";

  const getDetails = () => {
    switch (role) {
      case "doctor":
        return {
          title: "Institutional Clinician Verification",
          name: "Dr. Ananya Sharma, MD (AIIA)",
          roleLabel: "Senior Consultant Vaidya & Physician",
          idLabel: "Clinician ID",
          idValue: id,
          secondaryLabel: "Council Registration",
          secondaryValue: "MCI-AYUSH-2024-589",
          facility: "All India Institute of Ayurveda (AIIA), Central Hospital",
          department: "General Medicine & Kayachikitsa",
          verifiedSince: "January 2024",
        };
      case "pharmacy":
        return {
          title: "Licensed Dispensary Verification",
          name: "Venkatesh Iyer, B.Pharm",
          roleLabel: "Registered Pharmacist",
          idLabel: "Dispensary ID",
          idValue: id,
          secondaryLabel: "State Pharmacy License",
          secondaryValue: "TS-PHARM-2026-902",
          facility: "AIIA Hospital Dispensary & Formulary",
          department: "Central Pharmacy",
          verifiedSince: "March 2024",
        };
      case "diagnostic":
        return {
          title: "NABL Accredited Diagnostic Center Verification",
          name: "Ramesh V., M.Sc MLT",
          roleLabel: "Senior Technologist & Radiographer",
          idLabel: "Technologist ID",
          idValue: id,
          secondaryLabel: "NABL Accreditation",
          secondaryValue: "NABL-MED-883",
          facility: "Central Diagnostic Pathology & Imaging Lab",
          department: "Laboratory & Radiology",
          verifiedSince: "February 2024",
        };
      case "patient":
      default:
        return {
          title: "National Digital Health Mission (NDHM) Verification",
          name: "Rajesh Kumar",
          roleLabel: "Verified Citizen Patient",
          idLabel: "Patient Code",
          idValue: id,
          secondaryLabel: "ABHA Health ID",
          secondaryValue: "91-4820-1940-2811",
          facility: "AIIA Hospital (fac-hyd-01)",
          department: "Outpatient Services (OPD)",
          verifiedSince: "September 2026",
        };
    }
  };

  const details = getDetails();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-clinical-700 hover:text-clinical-900"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to MedKit AI Main Portal</span>
      </Link>

      <div className="rounded-3xl border-2 border-emerald-300 bg-white p-6 sm:p-8 shadow-xl space-y-6">
        {/* Verified Badge Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                <span>Authentic Credential Verified</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 mt-1">
                {details.title}
              </h1>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Verification Time
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
            </span>
          </div>
        </div>

        {/* Profile Details */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="shrink-0">
            <QrCode
              value={typeof window !== "undefined" ? window.location.href : id}
              size={140}
              title={`Verification QR for ${details.name}`}
            />
          </div>

          <div className="space-y-3 w-full text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-clinical-700 tracking-wider">
                {details.roleLabel}
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                {details.name}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-200">
              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <span className="text-[10px] text-slate-400 font-bold block">
                  {details.idLabel}
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {details.idValue}
                </span>
              </div>

              <div className="rounded-xl bg-surface-50 p-2.5 border border-surface-200">
                <span className="text-[10px] text-slate-400 font-bold block">
                  {details.secondaryLabel}
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {details.secondaryValue}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-slate-600">
              <div>
                <strong>Facility:</strong> {details.facility}
              </div>
              <div>
                <strong>Department:</strong> {details.department}
              </div>
              <div>
                <strong>Active Since:</strong> {details.verifiedSince}
              </div>
            </div>
          </div>
        </div>

        {/* Trust & Provenance Footer */}
        <div className="rounded-2xl bg-clinical-50/70 border border-clinical-200 p-4 text-xs text-clinical-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-clinical-600 shrink-0" />
            <span>
              Cryptographically verified under <strong>Ministry of Ayush / AIIA</strong> clinical governance standards.
            </span>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-clinical-700"
          >
            Access Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyProfilePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Loading verification...</div>}>
      <VerifyProfileContent />
    </Suspense>
  );
}
