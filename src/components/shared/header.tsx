"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, Stethoscope, Users, Sparkles, Menu, X } from "lucide-react";
import { ProviderBadge } from "./provider-badge";

const DoctorHelpMenu = dynamic(
  () => import("@/components/help/doctor-help-menu").then((m) => m.DoctorHelpMenu),
  { ssr: false }
);

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstNavLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Focus first link on open; close mobile disclosure on Escape key and return focus
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Mobile disclosure navigation button */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500 md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>

          <Link href="/" className="flex items-center gap-2 text-clinical-900 font-bold text-lg tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-white shadow" aria-hidden="true">
              <Activity className="h-5 w-5" />
            </div>
            <span>MedKit AI</span>
            <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-clinical-100 text-clinical-800 border border-clinical-200">
              SIH26047
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600">
            <Link
              href="/doctor/dashboard"
              className="flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Stethoscope className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
              <span>Doctor</span>
            </Link>
            <Link
              href="/opd/queue"
              className="flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span>OPD Queue</span>
            </Link>
            <Link
              href="/diagnostics/queue"
              className="flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Activity className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />
              <span>Diagnostics</span>
            </Link>
            <Link
              href="/pharmacy/queue"
              className="flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <span className="text-emerald-600 font-bold">Rx</span>
              <span>Pharmacy</span>
            </Link>
            <Link
              href="/patient/portal"
              className="flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              <span>Patient Portal</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <DoctorHelpMenu />
          <ProviderBadge />

          <Link
            href="/intake/new"
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-clinical-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:ring-offset-2"
          >
            New Intake
          </Link>
        </div>
      </div>

      {/* Mobile Disclosure Navigation */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 top-16 z-50 border-b border-surface-200 bg-white p-4 shadow-lg md:hidden animate-in slide-in-from-top-2 duration-150"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
            <Link
              ref={firstNavLinkRef}
              href="/doctor/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Stethoscope className="h-5 w-5 text-clinical-600" aria-hidden="true" />
              <span>Doctor Copilot Dashboard</span>
            </Link>
            <Link
              href="/doctor/patients"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Users className="h-5 w-5 text-slate-500" aria-hidden="true" />
              <span>Patient Directory &amp; Records</span>
            </Link>
            <Link
              href="/opd/queue"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Users className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <span>OPD Triage &amp; Token Queue</span>
            </Link>
            <Link
              href="/diagnostics/queue"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Activity className="h-5 w-5 text-purple-600" aria-hidden="true" />
              <span>Diagnostics Laboratory Queue</span>
            </Link>
            <Link
              href="/pharmacy/queue"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <span className="h-5 w-5 text-emerald-600 font-bold text-center">Rx</span>
              <span>Pharmacy Dispensary Queue</span>
            </Link>
            <Link
              href="/patient/portal"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <span>Patient Portal &amp; Timeline</span>
            </Link>
            <Link
              href="/intake/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-surface-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <span>Patient Self-Intake Kiosk</span>
            </Link>
            <Link
              href="/doctor/cases/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg bg-clinical-50 px-4 py-2.5 text-sm font-semibold text-clinical-700 hover:bg-clinical-100 focus:outline-none focus:ring-2 focus:ring-clinical-500"
            >
              <Activity className="h-5 w-5 text-clinical-600" aria-hidden="true" />
              <span>Start New Clinical Case</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
