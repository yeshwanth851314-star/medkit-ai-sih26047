import Link from "next/link";
import { Activity, Stethoscope, Users, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { ProviderBadge } from "./provider-badge";
import { DoctorHelpMenu } from "@/components/help/doctor-help-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-clinical-900 font-bold text-lg tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-white shadow">
              <Activity className="h-5 w-5" />
            </div>
            <span>MedKit AI</span>
            <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-clinical-100 text-clinical-800 border border-clinical-200">
              SIH26047
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
            <Link
              href="/doctor/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Stethoscope className="h-4 w-4 text-clinical-600" />
              <span>Doctor Copilot</span>
            </Link>
            <Link
              href="/doctor/patients"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Users className="h-4 w-4 text-slate-500" />
              <span>Patients</span>
            </Link>
            <Link
              href="/intake/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-surface-100 hover:text-slate-900 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Patient Kiosk</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <DoctorHelpMenu />
          <ProviderBadge />

          <Link
            href="/intake/new"
            className="inline-flex items-center justify-center rounded-md bg-clinical-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600"
          >
            New Intake
          </Link>
        </div>
      </div>
    </header>
  );
}
