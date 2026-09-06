"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DocumentUploader } from "./document-uploader";
import { DocumentExtractionViewer } from "./document-extraction-viewer";
import { DocumentExtractionResult } from "@/features/documents/types";
import { MedicalDocument } from "@/types/database";
import { Upload, Plus, FileText, ChevronRight } from "lucide-react";

interface PatientDocumentsHubProps {
  patientId: string;
  documents: MedicalDocument[];
  activeDocId: string;
  activeExtraction: DocumentExtractionResult;
}

export function PatientDocumentsHub({
  patientId,
  documents,
  activeDocId,
  activeExtraction,
}: PatientDocumentsHubProps) {
  const router = useRouter();
  const [showUploader, setShowUploader] = useState(false);

  const handleDocumentUploaded = (newDocId: string) => {
    setShowUploader(false);
    router.refresh();
    router.push(`/doctor/patients/${patientId}/documents?docId=${newDocId}`);
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);

  return (
    <div className="space-y-6">
      {/* Upload Action Strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-clinical-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Available Records ({documents.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowUploader(!showUploader)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-clinical-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-clinical-700 transition-colors"
        >
          {showUploader ? "Close Upload" : (
            <>
              <Plus className="h-3.5 w-3.5" /> Upload New Record
            </>
          )}
        </button>
      </div>

      {/* Conditional Uploader Section */}
      {showUploader && (
        <DocumentUploader
          patientId={patientId}
          onDocumentUploaded={handleDocumentUploaded}
        />
      )}

      {/* Document Selector Pills */}
      {documents.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-surface-200 pb-3">
          {documents.map((d) => (
            <Link
              key={d.id}
              href={`/doctor/patients/${patientId}/documents?docId=${d.id}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeDocId === d.id
                  ? "bg-clinical-600 text-white shadow-xs"
                  : "bg-white border border-surface-200 text-slate-700 hover:bg-surface-50"
              }`}
            >
              {d.original_filename} ({d.document_type.toUpperCase()})
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-300 p-8 text-center bg-surface-50/50">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-xs font-semibold text-slate-700">No prior medical records digitized yet.</p>
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-clinical-600 hover:text-clinical-700"
          >
            Upload the first prescription or lab report &rarr;
          </button>
        </div>
      )}

      {/* Side-by-Side Verification Component */}
      <DocumentExtractionViewer
        initialExtraction={activeExtraction}
        filename={activeDoc?.original_filename || "prescription.pdf"}
      />
    </div>
  );
}
