import Link from "next/link";
import { TimelineMilestone } from "@/features/timeline/types";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  ChevronRight,
  Stethoscope,
  Activity,
  Sparkles,
} from "lucide-react";

export function ClinicalTimelineView({ milestones }: { milestones: TimelineMilestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-slate-300" />
        <h3 className="mt-3 text-sm font-semibold text-slate-900">No timeline entries yet</h3>
        <p className="mt-1 text-xs text-slate-500">
          Once the patient undergoes intake or uploads medical records, their chronological timeline appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-clinical-200 ml-4 pl-6 space-y-8 py-2">
      {milestones.map((item) => (
        <div key={item.id} className="relative group">
          {/* Milestone Bullet Icon */}
          <div
            className={`absolute -left-[35px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
              item.badgeVariant === "danger"
                ? "bg-red-600 text-white"
                : item.badgeVariant === "ayush"
                ? "bg-ayush-700 text-white"
                : item.badgeVariant === "success"
                ? "bg-emerald-600 text-white"
                : "bg-clinical-600 text-white"
            }`}
          >
            {item.type === "encounter" ? (
              <Stethoscope className="h-3.5 w-3.5" />
            ) : item.type === "red_flag" ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
          </div>

          {/* Timeline Card */}
          <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-2xs hover:shadow-xs hover:border-clinical-400 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-surface-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      item.badgeVariant === "danger"
                        ? "bg-red-100 text-red-800"
                        : item.badgeVariant === "ayush"
                        ? "bg-ayush-100 text-ayush-900"
                        : item.badgeVariant === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-clinical-100 text-clinical-800"
                    }`}
                  >
                    {item.badgeText}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDateTime(item.timestamp)}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
                {item.subtitle && <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>}
              </div>

              {item.caseId && (
                <Link
                  href={`/doctor/cases/${item.caseId}`}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-50 hover:bg-surface-100 px-3 py-1.5 text-xs font-semibold text-clinical-700 border border-surface-200 transition-colors shrink-0"
                >
                  View Case Sheet <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {/* Quick Details Preview */}
            {item.details && (
              <div className="mt-3 text-xs text-slate-600 bg-surface-50/70 p-3 rounded-lg border border-surface-100 space-y-1">
                {item.details.hpi?.character && (
                  <div>
                    <strong>Symptom Nature:</strong> {item.details.hpi.character}
                  </div>
                )}
                {item.details.medications && item.details.medications.length > 0 && (
                  <div>
                    <strong>Medications Recorded:</strong>{" "}
                    {item.details.medications.map((m: any) => m.name).join(", ")}
                  </div>
                )}
                {item.details.examination?.blood_pressure && (
                  <div>
                    <strong>Vitals:</strong> BP {item.details.examination.blood_pressure} • Pulse{" "}
                    {item.details.examination.pulse} bpm
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
