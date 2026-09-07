import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-guard";
import { getPatientDetails } from "@/features/patients/patient-service";
import { buildPatientTimeline, compareConsecutiveVisits } from "@/features/timeline/timeline-service";
import { ClinicalTimelineView } from "@/components/timeline/clinical-timeline";
import { VisitComparisonView } from "@/components/timeline/visit-comparison";
import { ArrowLeft, Clock, TrendingUp, Sparkles, User, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function PatientTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerAuth({ allowedRoles: ["doctor", "clinician", "staff", "admin"] });
  const { id } = await params;
  const patient = await getPatientDetails(id);

  if (!patient) {
    notFound();
  }

  // Enforce facility boundary check on server-rendered timeline page
  if (user.facilityId && patient.facility_id && user.facilityId !== patient.facility_id) {
    notFound();
  }

  const [milestones, comparison] = await Promise.all([
    buildPatientTimeline(id),
    compareConsecutiveVisits(id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/doctor/patients/${patient.id}`} className="flex items-center gap-1 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient Profile
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">Longitudinal Clinical Timeline</span>
      </div>

      {/* Patient Header Banner */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{patient.full_name}</h1>
            <span className="rounded-md bg-clinical-50 border border-clinical-200 px-2 py-0.5 font-mono text-xs font-semibold text-clinical-700">
              {patient.patient_code}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Longitudinal Health Journey • {milestones.length} Recorded Milestones
          </p>
        </div>

        <Link
          href={`/doctor/cases/new?patientId=${patient.id}`}
          className="rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
        >
          New Case Intake
        </Link>
      </div>

      {/* Section 1: "What changed since last visit?" Comparison */}
      {comparison && <VisitComparisonView comparison={comparison} />}

      {/* Section 2: Chronological Milestone Timeline */}
      <div className="space-y-4">
        <div className="border-b border-surface-200 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-clinical-600" />
            Chronological Care History &amp; Evidence Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Integrates all physician consultations, patient voice intakes, and uploaded medical documents
          </p>
        </div>

        <ClinicalTimelineView milestones={milestones} />
      </div>
    </div>
  );
}
