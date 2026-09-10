import Link from "next/link";
import { notFound } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-guard";
import { getPatientDetails } from "@/features/patients/patient-service";
import { getDocumentsByPatientId } from "@/lib/db/supabase";
import { processDocumentExtraction } from "@/features/documents/document-service";
import { PatientDocumentsHub } from "@/components/documents/patient-documents-hub";
import { ArrowLeft } from "lucide-react";

export default async function PatientDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ docId?: string }>;
}) {
  const user = await requireServerAuth({ allowedRoles: ["doctor", "clinician", "staff", "admin"] });
  const { id } = await params;
  const { docId } = await searchParams;

  const patient = await getPatientDetails(id, user);
  if (!patient) notFound();

  // Enforce facility boundary check on server-rendered documents page
  if (user.role !== "admin") {
    if (!user.facilityId || !patient.facility_id || user.facilityId !== patient.facility_id) {
      notFound();
    }
  } else if (user.facilityId && patient.facility_id && user.facilityId !== patient.facility_id) {
    notFound();
  }

  const documents = await getDocumentsByPatientId(id, user);

  // Validate that requested docId query parameter strictly belongs to this authorized patient
  if (docId) {
    const requestedDoc = documents.find((d) => d.id === docId);
    if (!requestedDoc) {
      notFound(); // Refuse cross-patient document query parameter injection
    }
  }

  const activeDoc = docId
    ? documents.find((d) => d.id === docId)
    : documents.length > 0
    ? documents[0]
    : null;

  const activeDocId = activeDoc ? activeDoc.id : "";
  const activeExtraction = activeDocId
    ? await processDocumentExtraction(activeDocId, user)
    : {
        documentId: "",
        documentType: "prescription" as const,
        confidence: 0,
        extractedData: {},
        disclaimer: "No documents available for verification.",
        status: "review" as const,
      };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/doctor/patients/${patient.id}`} className="flex items-center gap-1 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient Profile
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">Digitized Prior Medical Documents</span>
      </div>

      {/* Patient Header */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{patient.full_name}</h1>
            <span className="rounded-md bg-clinical-50 border border-clinical-200 px-2 py-0.5 font-mono text-xs font-semibold text-clinical-700">
              {patient.patient_code}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {documents.length} Digitized Prior Medical Records on file
          </p>
        </div>
      </div>

      {/* Patient Documents Hub with Upload Dropzone and Extraction Viewer */}
      <PatientDocumentsHub
        patientId={patient.id}
        documents={documents}
        activeDocId={activeDocId}
        activeExtraction={activeExtraction}
      />
    </div>
  );
}
