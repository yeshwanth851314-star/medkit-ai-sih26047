import Link from "next/link";
import { Stethoscope, Sparkles, ShieldCheck, Clock, FileSearch, HeartPulse } from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="rounded-2xl border border-clinical-200 bg-gradient-to-b from-clinical-50 to-white p-8 shadow-sm sm:p-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-white px-3 py-1 text-xs font-semibold text-clinical-700 shadow-sm mb-4">
          <HeartPulse className="h-3.5 w-3.5 text-clinical-600" />
          SIH26047 — Patient Case-Taking Software
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          MedKit AI
        </h1>
        <p className="mt-3 text-lg font-medium text-clinical-700 max-w-2xl mx-auto">
          Intelligent Multimodal Clinical Intake & Physician Copilot
        </p>
        <p className="mt-4 text-base text-slate-600 max-w-2xl mx-auto">
          Turns patient voice, questionnaire responses, and prior medical documents into a verified, structured clinical history—before the doctor begins the consultation.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/doctor/dashboard"
            className="flex items-center gap-2 rounded-lg bg-clinical-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-clinical-600"
          >
            <Stethoscope className="h-4 w-4" />
            Open Doctor Dashboard
          </Link>
          <Link
            href="/intake/new"
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-surface-50 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Start Patient Kiosk Intake
          </Link>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="mt-8 rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 max-w-2xl mx-auto flex items-start gap-2 text-left">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Non-Autonomous Safety Boundary:</strong> MedKit AI assists with clinical history acquisition and documentation. It never performs autonomous diagnosis, prescribing, or treatment decisions. The clinician remains the final decision-maker.
          </div>
        </div>
      </div>

      {/* Core Workflow Pillars */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-clinical-100 text-clinical-700 mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Multimodal Intake & Voice</h2>
          <p className="mt-2 text-sm text-slate-600">
            Voice-to-text with Telugu/English support, touch question graph, and immediate touch/text fallback for complete accessibility.
          </p>
        </div>

        <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-4">
            <FileSearch className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Document Intelligence</h2>
          <p className="mt-2 text-sm text-slate-600">
            Digitize prescriptions, lab reports, and discharge summaries with OCR extraction, confidence scores, and source page references.
          </p>
        </div>

        <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 mb-4">
            <Clock className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Longitudinal Clinical Timeline</h2>
          <p className="mt-2 text-sm text-slate-600">
            Signature longitudinal view answering &quot;What changed since the last visit?&quot; comparing current and past encounters cleanly.
          </p>
        </div>
      </div>
    </div>
  );
}
