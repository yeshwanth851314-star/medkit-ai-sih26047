import Link from "next/link";
import {
  Stethoscope,
  Sparkles,
  ShieldCheck,
  Clock,
  FileSearch,
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
} from "lucide-react";
import { DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* ─── Hero Header & Government Provenance ─── */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-clinical-50 px-3.5 py-1.5 text-xs font-semibold text-clinical-800 shadow-sm">
          <HeartPulse className="h-4 w-4 text-clinical-600" aria-hidden="true" />
          <span>SIH26047 — Patient Case-Taking Software • Ministry of Ayush / AIIA</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          MedKit AI
        </h1>

        <p className="text-lg font-medium text-clinical-800 sm:text-xl">
          Intelligent Multimodal Clinical Intake &amp; Physician Copilot
        </p>

        <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl mx-auto">
          Turns patient voice, bilingual symptom responses, and prior medical documents into a verified, structured clinical history before consultation begins.
        </p>
      </section>

      {/* ─── Primary Role Selection (Doctor vs Patient) ─── */}
      <section
        aria-labelledby="portal-selection-heading"
        className="rounded-3xl border border-surface-200 bg-surface-50/60 p-6 sm:p-10 shadow-sm space-y-8"
      >
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-clinical-700">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>Select Your Portal to Continue</span>
          </div>
          <h2
            id="portal-selection-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Are you a Doctor or a Patient?
          </h2>
          <p className="text-xs sm:text-sm text-slate-700">
            Choose your role below to access the authorized clinician workspace or start patient voice intake.
          </p>
        </div>

        {/* Two High-Impact Interactive Role Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          {/* ─── Card 1: Doctor / Healthcare Professional ─── */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-clinical-300 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md hover:border-clinical-500 transition-all">
            <div className="space-y-6">
              {/* Card Header & Badge */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700 shadow-sm">
                  <Stethoscope className="h-8 w-8" aria-hidden="true" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-clinical-100 px-3 py-1 text-xs font-bold text-clinical-800 border border-clinical-200">
                  <Shield className="h-3 w-3 text-clinical-600" aria-hidden="true" />
                  Institutional Access
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">
                  Doctor &amp; Clinician Portal
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  For Physicians, AYUSH Vaidyas, and Triage Staff to review patient queues, consult with AI copilot, verify document OCR, and manage longitudinal records.
                </p>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-2.5 text-xs text-slate-700 border-t border-surface-200 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-clinical-600 shrink-0" aria-hidden="true" />
                  <span>Clinical Copilot &amp; Triage Queues</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-clinical-600 shrink-0" aria-hidden="true" />
                  <span>Longitudinal Timeline &amp; Visit Delta Analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-clinical-600 shrink-0" aria-hidden="true" />
                  <span>Multimodal OCR Document Verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-clinical-600 shrink-0" aria-hidden="true" />
                  <span>Zero-Trust MFA (AAL2) Security &amp; Facility Isolation</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-8 space-y-3">
              <Link
                href="/login"
                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-clinical-600 px-6 py-3.5 text-sm font-bold text-white shadow hover:bg-clinical-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-clinical-600 transition-colors text-center"
              >
                <span>Doctor Login &rarr;</span>
              </Link>

              {/* Quick demo shortcut */}
              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical-800 hover:text-clinical-950 focus:underline"
                >
                  <Sparkles className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
                  <span>Quick Access: Demo Doctor ({DEMO_QUICK_ACCESS.doctor.demoId})</span>
                </Link>
              </div>
            </div>
          </div>

          {/* ─── Card 2: Patient / Multimodal Kiosk ─── */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-amber-300 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md hover:border-amber-500 transition-all">
            <div className="space-y-6">
              {/* Card Header & Badge */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-sm">
                  <UserCircle className="h-8 w-8" aria-hidden="true" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200">
                  <Sparkles className="h-3 w-3 text-amber-700" aria-hidden="true" />
                  No Password Required
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">
                  Patient Intake Kiosk
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  For Patients arriving at hospital kiosks or scanning QR check-in codes to provide symptoms via speech (Telugu or English), scan prescriptions, and give consent.
                </p>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-2.5 text-xs text-slate-700 border-t border-surface-200 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Multilingual Voice Intake (Telugu &amp; English)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Guided Symptom &amp; Allergy Questionnaire</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Prior Prescription &amp; Lab Report Upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Non-Coercive ABHA &amp; Digital Consent Recording</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-8 space-y-3">
              <Link
                href="/intake/new"
                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-700 px-6 py-3.5 text-sm font-bold text-white shadow hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 transition-colors text-center"
              >
                <span>Start Patient Intake &rarr;</span>
              </Link>

              {/* Quick demo shortcut */}
              <div className="text-center">
                <Link
                  href="/intake/new"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 focus:underline"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                  <span>Quick Access: Demo Patient ({DEMO_QUICK_ACCESS.patient.fullName})</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 max-w-4xl mx-auto flex items-start gap-2.5 text-left">
          <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">Non-Autonomous Safety Boundary:</strong> MedKit AI assists with clinical history acquisition and documentation. It never performs autonomous diagnosis, prescribing, or treatment decisions. The clinician remains the final decision-maker.
          </div>
        </div>
      </section>

      {/* ─── Connected Healthcare Continuum (18-Step Ecosystem) ─── */}
      <section aria-labelledby="ecosystem-heading" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-clinical-700">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>End-to-End Hospital Continuum</span>
          </div>
          <h2 id="ecosystem-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Complete Connected Healthcare Ecosystem
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            From patient self-intake to doctor consultation, diagnostic testing, and pharmacy dispensing with single canonical patient identity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Module 1: Patient Portal */}
          <Link
            href="/patient/portal"
            className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold uppercase text-amber-700 tracking-wider">Step 1 &bull; Patient</div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors">
                Patient Portal &amp; Timeline
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Consultation booking, OPD check-in, live queue token, and longitudinal medical timeline.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 group-hover:translate-x-1 transition-transform">
              <span>Open Portal</span> &rarr;
            </div>
          </Link>

          {/* Module 2: OPD Queue */}
          <Link
            href="/opd/queue"
            className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold uppercase text-blue-700 tracking-wider">Step 2 &bull; Triage</div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-800 transition-colors">
                OPD Queue &amp; Reception
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Token calling display, triage priority, wait-time tracking, and doctor room routing.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 group-hover:translate-x-1 transition-transform">
              <span>View Queue</span> &rarr;
            </div>
          </Link>

          {/* Module 3: Doctor Workspace */}
          <Link
            href="/doctor"
            className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm hover:border-clinical-500 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold uppercase text-clinical-700 tracking-wider">Step 3 &bull; Clinician</div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-clinical-700 transition-colors">
                Doctor Copilot Workspace
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                15-second glance, readiness score, Ayush assessment, diagnostic orders &amp; prescription sign-off.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-clinical-700 group-hover:translate-x-1 transition-transform">
              <span>Doctor Login</span> &rarr;
            </div>
          </Link>

          {/* Module 4: Diagnostics */}
          <Link
            href="/diagnostics/queue"
            className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm hover:border-purple-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold uppercase text-purple-700 tracking-wider">Step 4 &bull; Laboratory</div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                Diagnostic Pathology Lab
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Specimen accessioning, diagnostic test processing, report uploading &amp; instant doctor alert.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 group-hover:translate-x-1 transition-transform">
              <span>Lab Worklist</span> &rarr;
            </div>
          </Link>

          {/* Module 5: Pharmacy */}
          <Link
            href="/pharmacy/queue"
            className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Pill className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold uppercase text-emerald-700 tracking-wider">Step 5 &bull; Pharmacy</div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Dispensary &amp; Stock Formulary
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Strict isolation queue for FINAL prescriptions, batch &amp; expiry tracking, stock decrement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
              <span>Dispensary</span> &rarr;
            </div>
          </Link>
        </div>
      </section>

      {/* ─── Core Workflow Pillars ─── */}
      <section aria-label="System Capabilities" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Multimodal Intake &amp; Voice</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Voice-to-text with Telugu/English support, touch question graph, and immediate touch/text fallback for complete accessibility.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Document Intelligence</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Digitize prescriptions, lab reports, and discharge summaries with OCR extraction, confidence scores, and source page references.
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
    </div>
  );
}
