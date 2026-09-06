import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-guard";
import { getCaseDetails } from "@/features/cases/case-service";
import { getPatientDetails } from "@/features/patients/patient-service";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Printer, ArrowLeft, Activity } from "lucide-react";

export default async function PrintCaseSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerAuth({ allowedRoles: ["doctor", "clinician", "staff", "admin"] });
  const { id } = await params;
  const c = await getCaseDetails(id);
  if (!c) notFound();

  const patient = await getPatientDetails(c.patient_id);
  if (!patient) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 text-black bg-white min-h-screen">
      {/* Print Action Bar (Hidden on Print) */}
      <div className="no-print mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <Link
          href={`/doctor/cases/${c.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Interactive Case
        </Link>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-clinical-700"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Hospital / Institutional Header */}
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-900 font-bold text-lg uppercase tracking-wide">
          <Activity className="h-6 w-6 text-clinical-700" />
          <span>MedKit AI — Clinical Case Record</span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Ministry of Ayush / All India Institute of Ayurveda • SIH26047 Patient Case-Taking System
        </p>
        <p className="text-[11px] text-slate-500 italic mt-0.5">
          Standard Outpatient Clinical Intake &amp; Examination Record
        </p>
      </div>

      {/* Patient & Encounter Demographics */}
      <div className="mt-4 grid grid-cols-2 border border-slate-300 p-3 text-xs gap-y-1.5">
        <div><strong>Patient Name:</strong> {patient.full_name}</div>
        <div><strong>Patient Code:</strong> <code>{patient.patient_code}</code></div>
        <div><strong>DOB / Age:</strong> {patient.date_of_birth ? formatDate(patient.date_of_birth) : "N/A"}</div>
        <div><strong>Gender:</strong> {patient.gender}</div>
        <div><strong>Contact:</strong> {patient.phone || "Not recorded"}</div>
        <div><strong>Blood Group:</strong> {patient.blood_group || "N/A"}</div>
        <div><strong>Encounter Date:</strong> {formatDateTime(c.created_at)}</div>
        <div><strong>Record Status:</strong> <span className="uppercase font-bold">{c.status}</span></div>
      </div>

      {/* Chief Complaint */}
      <div className="mt-6">
        <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
          1. Chief Complaint
        </h3>
        <p className="mt-2 text-xs leading-relaxed font-medium">
          {c.chief_complaint}
        </p>
        {c.raw_patient_complaint && (
          <p className="mt-1 text-[11px] text-slate-600 italic">
            Patient Statement verbatim: &ldquo;{c.raw_patient_complaint}&rdquo;
          </p>
        )}
      </div>

      {/* HPI */}
      {c.hpi && (
        <div className="mt-4">
          <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            2. History of Present Illness (HPI)
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {c.hpi.onset && <div><strong>Onset:</strong> {c.hpi.onset}</div>}
            {c.hpi.duration && <div><strong>Duration:</strong> {c.hpi.duration}</div>}
            {c.hpi.character && <div><strong>Character:</strong> {c.hpi.character}</div>}
            {c.hpi.severity && <div><strong>Severity:</strong> {c.hpi.severity}</div>}
            {c.hpi.aggravating_factors && (
              <div className="col-span-2">
                <strong>Aggravating:</strong> {Array.isArray(c.hpi.aggravating_factors) ? c.hpi.aggravating_factors.join(", ") : c.hpi.aggravating_factors}
              </div>
            )}
            {c.hpi.relieving_factors && (
              <div className="col-span-2">
                <strong>Relieving:</strong> {Array.isArray(c.hpi.relieving_factors) ? c.hpi.relieving_factors.join(", ") : c.hpi.relieving_factors}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medications & Allergies */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            3. Medications
          </h3>
          {c.medication_history && c.medication_history.length > 0 ? (
            <ul className="mt-2 text-xs list-disc list-inside space-y-0.5">
              {c.medication_history.map((m, i) => (
                <li key={i}><strong>{m.name}</strong> — {m.dose}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500 italic">No medications recorded</p>
          )}
        </div>

        <div>
          <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            4. Allergies
          </h3>
          {c.allergy_history && c.allergy_history.length > 0 ? (
            <ul className="mt-2 text-xs list-disc list-inside space-y-0.5">
              {c.allergy_history.map((a, i) => (
                <li key={i}><strong>{a.substance}</strong> — {a.reaction}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500 italic">No allergies recorded</p>
          )}
        </div>
      </div>

      {/* Examination */}
      {c.examination && (
        <div className="mt-4">
          <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            5. Physical Examination Findings
          </h3>
          <div className="mt-2 flex gap-6 text-xs">
            <div><strong>BP:</strong> {c.examination.blood_pressure || "N/A"}</div>
            <div><strong>Pulse:</strong> {c.examination.pulse ? `${c.examination.pulse} bpm` : "N/A"}</div>
            <div><strong>Temp:</strong> {c.examination.temperature ? `${c.examination.temperature} F` : "N/A"}</div>
            <div><strong>SpO2:</strong> {c.examination.spo2 ? `${c.examination.spo2}%` : "N/A"}</div>
          </div>
          {c.examination.notes && (
            <p className="mt-1 text-xs text-slate-700">{c.examination.notes}</p>
          )}
        </div>
      )}

      {/* Assessment & Plan */}
      {c.assessment_plan && (
        <div className="mt-4">
          <h3 className="border-b border-slate-400 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            6. Clinician Assessment &amp; Management Plan
          </h3>
          {c.assessment_plan.summary && (
            <p className="mt-2 text-xs"><strong>Impression:</strong> {c.assessment_plan.summary}</p>
          )}
          {c.assessment_plan.plan && (
            <p className="mt-1 text-xs whitespace-pre-line"><strong>Plan:</strong> {c.assessment_plan.plan}</p>
          )}
        </div>
      )}

      {/* Clinician Signature & Safety Disclaimer */}
      <div className="mt-12 pt-4 border-t-2 border-slate-900 text-xs flex justify-between items-end">
        <div className="max-w-md text-[10px] text-slate-500">
          <strong>Notice:</strong> MedKit AI is a clinical documentation assistant. Final diagnosis and prescribing decisions are made exclusively by the attending licensed clinician.
        </div>
        <div className="text-right">
          <div className="h-10 border-b border-slate-400 w-48 mb-1" />
          <div className="font-semibold text-xs text-slate-900">Attending Clinician Signature</div>
          <div className="text-[10px] text-slate-500">Reg No: __________________</div>
        </div>
      </div>
    </div>
  );
}
