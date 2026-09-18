import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-guard";
import { getCaseDetails } from "@/features/cases/case-service";
import { getPatientDetails } from "@/features/patients/patient-service";
import { getDocumentsByPatientId } from "@/lib/db/supabase";
import { CaseActionsBar } from "@/components/cases/case-actions-bar";
import { AyushCaseDisplay } from "@/components/ayush/ayush-case-display";
import { ClinicalSummaryCard } from "@/components/summary/clinical-summary-card";
import { generateDeterministicSummary } from "@/features/summaries/summary-service";
import { ClinicalSummary } from "@/features/summaries/types";
import { compareConsecutiveVisits } from "@/features/timeline/timeline-service";
import { VisitComparisonView } from "@/components/timeline/visit-comparison";
import { ContextualHelp } from "@/components/help/contextual-help";
import { RedFlagBanner } from "@/components/red-flags/red-flag-banner";
import { RedFlagAlertItem } from "@/features/red-flags/types";
import { DoctorQuickView } from "@/components/cases/doctor-quick-view";
import { DoctorDiagnosticsCard } from "@/components/cases/doctor-diagnostics-card";
import { DoctorPrescriptionCard } from "@/components/cases/doctor-prescription-card";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Stethoscope,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Printer,
  ArrowLeft,
  Calendar,
  Pill,
  Heart,
  CheckCircle2,
  Sparkles,
  History,
} from "lucide-react";

export default async function CaseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerAuth({ allowedRoles: ["doctor", "clinician", "staff", "admin"] });
  const { id } = await params;
  const c = await getCaseDetails(id, user);

  if (!c) {
    notFound();
  }

  const [patient, documents, fallbackSummary, visitComparison] = await Promise.all([
    getPatientDetails(c.patient_id, user),
    getDocumentsByPatientId(c.patient_id, user),
    c.ai_summary ? Promise.resolve(null) : generateDeterministicSummary(c.id, user).catch(() => null),
    compareConsecutiveVisits(c.patient_id, c.id, user).catch(() => null),
  ]);

  // Enforce fail-closed facility boundary check on server-rendered case page
  if (user.role !== "admin") {
    if (!user.facilityId || !patient?.facility_id || user.facilityId !== patient.facility_id) {
      notFound();
    }
  } else if (user.facilityId && patient?.facility_id && user.facilityId !== patient.facility_id) {
    notFound();
  }

  const initialSummary = (c.ai_summary as unknown as ClinicalSummary | null) || fallbackSummary;
  if (initialSummary && c.assessment_plan?.summary && !initialSummary.hpiNarrative) {
    initialSummary.hpiNarrative = c.assessment_plan.summary;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation Breadcrumbs & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/doctor/patients" className="hover:text-slate-800">
            Patients
          </Link>
          <span>/</span>
          {patient ? (
            <Link href={`/doctor/patients/${patient.id}`} className="hover:text-slate-800 font-medium text-clinical-600">
              {patient.full_name} ({patient.patient_code})
            </Link>
          ) : (
            <span>Patient</span>
          )}
          <span>/</span>
          <span>Case Sheet</span>
        </div>

        {patient && (
          <CaseActionsBar clinicalCase={c} patient={patient} documents={documents} />
        )}
      </div>

      {/* Case Header Card */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-surface-200 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  c.status === "final"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {c.status === "final" ? "Finalized Clinical Record" : "Draft Intake Case"}
              </span>
              <span className="rounded-md bg-clinical-50 border border-clinical-200 px-2 py-0.5 text-xs font-semibold text-clinical-700 uppercase font-mono">
                {c.case_type} Stream
              </span>
              <span className="text-xs text-slate-600">
                Language: {c.patient_language.toUpperCase()}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-bold text-slate-900">
              {c.chief_complaint}
            </h1>

            {c.raw_patient_complaint && (
              <div className="mt-1.5 text-xs italic text-slate-500">
                Original patient statement: &ldquo;{c.raw_patient_complaint}&rdquo;
              </div>
            )}
          </div>

          <div className="text-right text-xs text-slate-500 shrink-0 space-y-1">
            <div>Encounter: {formatDateTime(c.created_at)}</div>
            {c.finalized_at && (
              <div className="text-emerald-700 font-medium">
                Finalized: {formatDateTime(c.finalized_at)}
              </div>
            )}
          </div>
        </div>

        {/* Patient Summary Strip */}
        {patient && (
          <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600 bg-surface-50 p-3 rounded-xl border border-surface-200">
            <span>
              <strong>Patient:</strong> {patient.full_name}
            </span>
            <span>
              <strong>ID:</strong> <code>{patient.patient_code}</code>
            </span>
            <span>
              <strong>Gender:</strong> {patient.gender}
            </span>
            {patient.date_of_birth && (
              <span>
                <strong>DOB:</strong> {formatDate(patient.date_of_birth)}
              </span>
            )}
            {patient.blood_group && (
              <span>
                <strong>Blood Group:</strong> {patient.blood_group}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 15-Second Doctor View & Case Readiness Meter */}
      <DoctorQuickView
        clinicalCase={c}
        patientName={patient?.full_name}
        hasChangedSinceLastVisit={visitComparison?.hasPreviousVisit}
        changesSummary={visitComparison?.symptomChanges?.added || []}
      />

      {/* Signature Longitudinal Feature: What Changed Since Previous Visit */}
      {visitComparison && visitComparison.hasPreviousVisit && (
        <div className="no-print">
          <VisitComparisonView comparison={visitComparison} />
        </div>
      )}

      {/* Red Flag Alert Notice if present */}
      {(() => {
        const redFlagAlerts: RedFlagAlertItem[] = (c.red_flags || []).map((rf: any) => ({
          ruleId: rf.ruleId || rf.rule_id || "RED_FLAG_ALERT",
          ruleVersion: rf.ruleVersion || rf.rule_version || "1.0",
          severity: (rf.severity?.toLowerCase() || "critical") as any,
          message: rf.message || "Potential red flag detected — immediate clinical assessment recommended.",
          clinicalRationale: rf.clinicalRationale || rf.clinical_rationale,
          triggeredAt: rf.triggeredAt || rf.triggered_at || c.created_at,
          acknowledgedBy: rf.acknowledgedBy || rf.acknowledged_by,
          acknowledgedAt: rf.acknowledgedAt || rf.acknowledged_at,
        }));

        if (redFlagAlerts.length > 0) {
          return <RedFlagBanner alerts={redFlagAlerts} caseId={c.id} />;
        }

        return (
          <div className="rounded-xl border border-surface-200 bg-surface-50/80 p-3.5 text-xs text-slate-600 flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800">No rule-based red flags detected</span>
              <ContextualHelp topic="red_flags" />
            </div>
            <span className="text-[11px] text-slate-600 hidden sm:inline">Deterministic safety check evaluated</span>
          </div>
        );
      })()}

      {/* AI-Assisted Clinical Summary Section */}
      {initialSummary && (
        <ClinicalSummaryCard initialSummary={initialSummary} caseId={c.id} />
      )}

      {/* Clinical Sections */}
      <div className="space-y-6">
        {/* HPI Section */}
        {c.hpi && (
          <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                History of Present Illness (HPI)
              </h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Source: {c.provenance?.hpi === "patient" || !c.provenance?.hpi ? "Patient reported" : c.provenance.hpi}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {c.hpi.onset && (
                <div>
                  <span className="text-slate-500 font-medium block">Onset</span>
                  <span className="text-slate-900 font-semibold">{c.hpi.onset}</span>
                </div>
              )}
              {c.hpi.duration && (
                <div>
                  <span className="text-slate-500 font-medium block">Duration</span>
                  <span className="text-slate-900 font-semibold">{c.hpi.duration}</span>
                </div>
              )}
              {c.hpi.character && (
                <div>
                  <span className="text-slate-500 font-medium block">Character</span>
                  <span className="text-slate-900 font-semibold">{c.hpi.character}</span>
                </div>
              )}
              {c.hpi.severity && (
                <div>
                  <span className="text-slate-500 font-medium block">Severity</span>
                  <span className="text-slate-900 font-semibold">{c.hpi.severity}</span>
                </div>
              )}
              {c.hpi.aggravating_factors && (
                <div>
                  <span className="text-slate-500 font-medium block">Aggravating Factors</span>
                  <span className="text-slate-900 font-semibold">
                    {Array.isArray(c.hpi.aggravating_factors)
                      ? c.hpi.aggravating_factors.join(", ")
                      : c.hpi.aggravating_factors}
                  </span>
                </div>
              )}
              {c.hpi.relieving_factors && (
                <div>
                  <span className="text-slate-500 font-medium block">Relieving Factors</span>
                  <span className="text-slate-900 font-semibold">
                    {Array.isArray(c.hpi.relieving_factors)
                      ? c.hpi.relieving_factors.join(", ")
                      : c.hpi.relieving_factors}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medications & Allergies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="h-4 w-4 text-clinical-600" /> Home &amp; Extracted Medications
              </h3>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Source: Patient reported
              </span>
            </div>
            {c.medication_history && c.medication_history.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {c.medication_history.map((m, idx) => (
                  <li key={idx} className="rounded-lg bg-surface-50 p-2.5 border border-surface-200">
                    <strong>{m.name}</strong> — <span className="text-slate-600">{m.dose}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600 italic">No medications on record.</p>
            )}
          </div>

          <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Allergies
            </h3>
            {c.allergy_history && c.allergy_history.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {c.allergy_history.map((a, idx) => (
                  <li key={idx} className="rounded-lg bg-rose-50/50 p-2.5 border border-rose-200 text-rose-900">
                    <strong>{a.substance}</strong> — <span>{a.reaction}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600 italic">No known allergies on record.</p>
            )}
          </div>
        </div>

        {/* Physical Examination */}
        {c.examination && (
          <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-surface-200 pb-3">
              Examination Findings
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {c.examination.blood_pressure && (
                <div>
                  <span className="text-slate-500 font-medium block">Blood Pressure</span>
                  <span className="text-slate-900 font-bold">{c.examination.blood_pressure}</span>
                </div>
              )}
              {c.examination.pulse && (
                <div>
                  <span className="text-slate-500 font-medium block">Pulse</span>
                  <span className="text-slate-900 font-bold">{c.examination.pulse} bpm</span>
                </div>
              )}
              {c.examination.temperature && (
                <div>
                  <span className="text-slate-500 font-medium block">Temperature</span>
                  <span className="text-slate-900 font-bold">{c.examination.temperature} &deg;F</span>
                </div>
              )}
              {c.examination.spo2 && (
                <div>
                  <span className="text-slate-500 font-medium block">SpO2</span>
                  <span className="text-slate-900 font-bold">{c.examination.spo2} %</span>
                </div>
              )}
            </div>
            {c.examination.notes && (
              <div className="mt-4 text-xs text-slate-700 bg-surface-50 p-3 rounded-lg border border-surface-200">
                {c.examination.notes}
              </div>
            )}
          </div>
        )}

        {/* Assessment & Plan */}
        {c.assessment_plan && (
          <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-surface-200 pb-3">
              Clinician Assessment &amp; Treatment Plan
            </h2>
            <div className="space-y-4 text-xs">
              {c.assessment_plan.summary && (
                <div>
                  <span className="text-slate-500 font-medium block">Clinical Summary / Impression</span>
                  <p className="mt-1 text-slate-900 font-medium leading-relaxed">
                    {c.assessment_plan.summary}
                  </p>
                </div>
              )}
              {c.assessment_plan.plan && (
                <div className="pt-3 border-t border-surface-200">
                  <span className="text-slate-500 font-medium block">Prescription &amp; Management Plan</span>
                  <p className="mt-1 text-slate-900 font-medium leading-relaxed whitespace-pre-line">
                    {c.assessment_plan.plan}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dedicated AYUSH Assessment Display if AYUSH case */}
        {c.case_type === "ayush" && c.ayush_assessment && (
          <AyushCaseDisplay assessment={c.ayush_assessment} />
        )}

        {/* Diagnostic Orders & Lab Results Section */}
        <DoctorDiagnosticsCard
          caseId={c.id}
          patientId={c.patient_id}
          facilityId={user.facilityId || patient?.facility_id || "fac-hyd-01"}
        />

        {/* Prescription & Ayurvedic Regimen Section */}
        <DoctorPrescriptionCard
          caseId={c.id}
          patientId={c.patient_id}
          facilityId={user.facilityId || patient?.facility_id || "fac-hyd-01"}
          doctorName={user.fullName || "Dr. Attending Physician"}
        />

        {/* Post-finalization Clinical Addenda / Amendments */}
        {c.amendments && c.amendments.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-amber-200 pb-3">
              <History className="h-5 w-5 text-amber-700" />
              <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
                Clinical Addenda &amp; Revisions ({c.amendments.length})
              </h2>
            </div>

            <div className="space-y-3">
              {c.amendments.map((amend) => (
                <div key={amend.id} className="rounded-lg bg-white p-4 border border-amber-200 shadow-sm space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-bold text-slate-900">
                      Addendum #{amend.version} — {amend.reason}
                    </span>
                    <span>{formatDateTime(amend.timestamp)}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {amend.notes}
                  </p>
                  <div className="text-[11px] text-slate-600 font-medium pt-1">
                    Signed by: {amend.actor_name} • Permanent audit record
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
