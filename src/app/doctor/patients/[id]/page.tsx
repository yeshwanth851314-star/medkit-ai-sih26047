import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-guard";
import { getPatientDetails } from "@/features/patients/patient-service";
import { getCasesByPatientId, getDocumentsByPatientId } from "@/lib/db/supabase";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  User,
  Calendar,
  Phone,
  MapPin,
  Heart,
  PlusCircle,
  FileText,
  Clock,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerAuth({ allowedRoles: ["doctor", "clinician", "staff", "admin"] });
  const { id } = await params;
  const patient = await getPatientDetails(id);

  if (!patient) {
    notFound();
  }

  const [cases, documents] = await Promise.all([
    getCasesByPatientId(id),
    getDocumentsByPatientId(id),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/doctor/patients" className="flex items-center gap-1 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient Directory
        </Link>
      </div>

      {/* Patient Profile Header Card */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-100 text-clinical-700 font-bold text-xl">
              {patient.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
                <span className="rounded-md bg-clinical-50 border border-clinical-200 px-2.5 py-0.5 font-mono text-xs font-semibold text-clinical-700">
                  {patient.patient_code}
                </span>
                {patient.blood_group && (
                  <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {patient.blood_group}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {patient.gender}
                </span>
                {patient.date_of_birth && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    DOB: {formatDate(patient.date_of_birth)}
                  </span>
                )}
                {patient.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {patient.phone}
                  </span>
                )}
                {patient.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {patient.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/doctor/cases/new?patientId=${patient.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-clinical-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Start New Clinical Case
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Cases & Timeline vs Digitized Documents */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cases Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-clinical-600" />
                Intake History &amp; Consultations ({cases.length})
              </h2>
              <span className="text-xs text-slate-400 font-medium">Longitudinal encounters</span>
            </div>

            {cases.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-600">No clinical cases on file yet.</p>
                <Link
                  href={`/doctor/cases/new?patientId=${patient.id}`}
                  className="mt-3 inline-block text-xs font-semibold text-clinical-600 hover:text-clinical-700"
                >
                  Create this patient&apos;s first clinical case &rarr;
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-surface-200 p-4 hover:border-clinical-400 hover:bg-surface-50/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              c.status === "final"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {c.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {formatDateTime(c.created_at)}
                          </span>
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                            {c.case_type}
                          </span>
                        </div>

                        <h3 className="mt-2 text-sm font-semibold text-slate-900">
                          {c.chief_complaint}
                        </h3>

                        {c.red_flags && c.red_flags.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            <span>{c.red_flags[0].message}</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/doctor/cases/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-50 hover:text-clinical-700"
                      >
                        Open Case <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Digitized Medical Documents */}
        <div className="space-y-6">
          <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-clinical-600" />
                Digitized Prior Records ({documents.length})
              </h2>
            </div>

            {documents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No prior prescriptions or lab reports uploaded yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-surface-200 p-3 bg-surface-50/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {doc.original_filename}
                      </span>
                      <span className="rounded bg-clinical-100 text-clinical-800 px-1.5 py-0.5 text-[10px] uppercase font-bold">
                        {doc.document_type}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Confidence: {doc.ocr_confidence ? `${Math.round(doc.ocr_confidence * 100)}%` : "N/A"}</span>
                      <span className="text-emerald-700 font-medium">Extracted</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
