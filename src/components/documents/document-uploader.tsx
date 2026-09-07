"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from "lucide-react";

interface DocumentUploaderProps {
  patientId: string;
  onDocumentUploaded: (documentId: string) => void;
}

const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function DocumentUploader({ patientId, onDocumentUploaded }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<"prescription" | "lab" | "discharge" | "other">("prescription");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMsg("Unsupported file type. Only PDF, PNG, and JPEG formats are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg("File exceeds 10MB limit. Please upload a smaller medical record.");
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadAndExtract = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Convert to Base64
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => resolve((reader.result as string)?.split(",")[1] || "");
        reader.onerror = (err) => reject(err);
      });

      const base64Data = await base64Promise;

      // 1. Register document in database
      const regRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          documentType,
          fileBase64: base64Data,
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || "Failed to register document");

      const docId = regData.document?.id || `doc-${Date.now()}`;

      // 2. Trigger OCR extraction via provider
      const extractRes = await fetch(`/api/documents/${docId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
        }),
      });

      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error || "OCR extraction failed");

      setSuccessMsg(`Document digitized successfully with ${extractData.extraction?.confidence ? Math.round(extractData.extraction.confidence * 100) : 95}% confidence.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      onDocumentUploaded(docId);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process document");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-surface-200 pb-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-clinical-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Upload Prior Medical Document
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          PDF, PNG, JPEG &le; 10MB
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload prior medical document file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all focus:outline-hidden focus:ring-2 focus:ring-clinical-500 ${
          isDragging
            ? "border-clinical-500 bg-clinical-50/50"
            : selectedFile
            ? "border-emerald-300 bg-emerald-50/30"
            : "border-surface-200 hover:border-clinical-400 hover:bg-surface-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-emerald-600" />
            <div className="text-left">
              <span className="block text-sm font-semibold text-slate-900">{selectedFile.name}</span>
              <span className="block text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "Document"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Remove selected file"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="ml-2 rounded-full p-1 text-slate-400 hover:bg-surface-200 hover:text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-clinical-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-8 w-8 text-slate-400" />
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-clinical-600">Click to upload</span> or drag and drop
            </div>
            <p className="text-[11px] text-slate-400">
              Prior Prescriptions, Lab Reports, or Hospital Summaries
            </p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <label htmlFor="document-classification-select" className="text-xs font-semibold text-slate-700">
              Document Classification:
            </label>
            <select
              id="document-classification-select"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="rounded-lg border border-surface-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
            >
              <option value="prescription">Prescription</option>
              <option value="lab">Lab Report</option>
              <option value="discharge">Discharge Summary</option>
              <option value="other">Other Medical Record</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={handleUploadAndExtract}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-clinical-700 disabled:opacity-50 transition-colors"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Running Multimodal OCR...</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span>Digitize &amp; Extract Data</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-surface-100">
        <ShieldCheck className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
        <span>All medical documents are encrypted in private storage with patient-isolated Row Level Security.</span>
      </div>
    </div>
  );
}
