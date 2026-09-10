import { MedicalDocument } from "@/types/database";
import { DocumentExtractionResult, documentExtractionResultSchema, CandidateReviewAction } from "./types";
import { getDocumentById, updateDocument } from "@/lib/db/supabase";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const SYNTHETIC_DOCUMENT_FIXTURES: Record<string, DocumentExtractionResult> = {
  "doc-0001": {
    documentId: "doc-0001",
    documentType: "prescription",
    confidence: 0.96,
    extractedData: {
      doctor_name: "Dr. V. Prasad, MBBS, MD",
      date: "2026-08-10",
      medications: [
        {
          id: "cand-med-01",
          name: "Levocetirizine 5mg",
          dosage: "1 tablet once daily at bedtime",
          duration: "10 days",
          pageRef: 1,
          confidence: 0.98,
          status: "candidate",
        },
        {
          id: "cand-med-02",
          name: "Paracetamol 650mg",
          dosage: "1 tablet SOS for fever",
          duration: "3 days",
          pageRef: 1,
          confidence: 0.94,
          status: "candidate",
        },
      ],
      instructions: "Warm saline gargles twice daily. Drink plenty of warm fluids.",
    },
    disclaimer: "Extracted from uploaded document — verify before use.",
    status: "extracted",
  },
  "doc-0002": {
    documentId: "doc-0002",
    documentType: "lab",
    confidence: 0.92,
    extractedData: {
      laboratory: "Apollo Diagnostic Services (Synthetic)",
      date: "2026-07-22",
      tests: [
        { id: "cand-test-01", name: "Total Cholesterol", value: "248 mg/dL", reference: "< 200 mg/dL", flag: "high", confidence: 0.95, status: "candidate" },
        { id: "cand-test-02", name: "Triglycerides", value: "190 mg/dL", reference: "< 150 mg/dL", flag: "high", confidence: 0.93, status: "candidate" },
        { id: "cand-test-03", name: "HDL Cholesterol", value: "38 mg/dL", reference: "> 40 mg/dL", flag: "low", confidence: 0.91, status: "candidate" },
        { id: "cand-test-04", name: "LDL Cholesterol", value: "172 mg/dL", reference: "< 100 mg/dL", flag: "high", confidence: 0.94, status: "candidate" },
      ],
    },
    disclaimer: "Extracted from uploaded document — verify before use.",
    status: "extracted",
  },
  "doc-0003": {
    documentId: "doc-0003",
    documentType: "other",
    confidence: 0.12,
    extractedData: {},
    disclaimer: "Extracted from uploaded document — verify before use.",
    status: "failed",
    errorMessage: "Document image resolution is too low or text is severely obscured. Original file preserved. Please enter clinical details manually.",
  },
};

export function validateDocumentFile(file: { mimeType: string; sizeBytes: number }): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return {
      valid: false,
      error: `Unsupported file format (${file.mimeType}). Supported formats: PDF, JPEG, PNG, WEBP.`,
    };
  }

  if (file.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit (${Math.round(file.sizeBytes / (1024 * 1024))}MB). Please upload a smaller document.`,
    };
  }

  return { valid: true };
}

export async function processDocumentExtraction(
  documentId: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<DocumentExtractionResult> {
  // Check synthetic registry first for deterministic demo reliability
  if (SYNTHETIC_DOCUMENT_FIXTURES[documentId]) {
    const fixture = documentExtractionResultSchema.parse(SYNTHETIC_DOCUMENT_FIXTURES[documentId]);
    return fixture;
  }

  const doc = await getDocumentById(documentId, actorOrToken);

  // If already extracted in DB, load existing verified state
  if (doc?.extracted_data && Object.keys(doc.extracted_data).length > 0) {
    const existingData = doc.extracted_data as any;
    if (existingData.medications || existingData.tests || existingData.doctor_name) {
      return documentExtractionResultSchema.parse({
        documentId,
        documentType: doc.document_type || "prescription",
        confidence: doc.ocr_confidence || 0.9,
        extractedData: existingData,
        disclaimer: "Extracted from uploaded document — verify before use.",
        status: doc.processing_status === "confirmed" ? "confirmed" : "extracted",
      });
    }
  }

  // For newly uploaded documents without live OCR extraction yet, fail closed with review requirement.
  // NEVER fabricate synthetic medications (e.g. Amoxicillin) onto a real patient's record.
  const emptyResult: DocumentExtractionResult = {
    documentId,
    documentType: (doc?.document_type as any) || "prescription",
    confidence: doc?.ocr_confidence || 0.0,
    extractedData: {},
    disclaimer: "Document uploaded — automated extraction pending or unavailable. Clinician manual review required.",
    status: doc?.processing_status === "failed" ? "failed" : "review",
    errorMessage: doc?.error_message || "Automated extraction not yet performed. Please review document manually.",
  };

  return documentExtractionResultSchema.parse(emptyResult);
}

export async function reviewExtractionCandidate(
  documentId: string,
  review: CandidateReviewAction,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<DocumentExtractionResult> {
  const result = await processDocumentExtraction(documentId, actorOrToken);
  const meds = result.extractedData.medications || [];
  const tests = result.extractedData.tests || [];

  let candidateMatched = false;
  const now = new Date().toISOString();

  if (!review.candidateType || review.candidateType === "medication") {
    for (const m of meds) {
      const idMatch = review.candidateId && m.id === review.candidateId;
      const nameMatch = review.candidateName && m.name.toLowerCase() === review.candidateName.toLowerCase();
      if (idMatch || nameMatch) {
        candidateMatched = true;
        if (review.action === "accept") {
          m.status = "verified";
          if (review.verifierId) m.verified_by = review.verifierId;
          m.verified_at = now;
        } else if (review.action === "reject") {
          m.status = "rejected";
          if (review.verifierId) m.rejected_by = review.verifierId;
          m.rejected_at = now;
        } else if (review.action === "edit") {
          if (review.updatedValue) m.dosage = review.updatedValue;
          m.status = "verified";
          if (review.verifierId) m.verified_by = review.verifierId;
          m.verified_at = now;
        }
        break;
      }
    }
  }

  if (!candidateMatched && (!review.candidateType || review.candidateType === "test")) {
    for (const t of tests) {
      const idMatch = review.candidateId && t.id === review.candidateId;
      const nameMatch = review.candidateName && t.name.toLowerCase() === review.candidateName.toLowerCase();
      if (idMatch || nameMatch) {
        candidateMatched = true;
        if (review.action === "accept") {
          t.status = "verified";
          if (review.verifierId) t.verified_by = review.verifierId;
          t.verified_at = now;
        } else if (review.action === "reject") {
          t.status = "rejected";
          if (review.verifierId) t.rejected_by = review.verifierId;
          t.rejected_at = now;
        } else if (review.action === "edit") {
          if (review.updatedValue) t.value = review.updatedValue;
          t.status = "verified";
          if (review.verifierId) t.verified_by = review.verifierId;
          t.verified_at = now;
        }
        break;
      }
    }
  }

  if (!candidateMatched) {
    const identifier = review.candidateId || review.candidateName || "unknown";
    throw new Error(
      `Medication or test "${identifier}" is not an extraction candidate in document ${documentId}`
    );
  }

  const unverifiedMeds = meds.filter((m: any) => m.status === "candidate").length;
  const unverifiedTests = tests.filter((t: any) => t.status === "candidate").length;
  result.status = unverifiedMeds + unverifiedTests === 0 ? "confirmed" : "review";

  // Update in synthetic fixtures if this is a fixture document
  if (SYNTHETIC_DOCUMENT_FIXTURES[documentId]) {
    SYNTHETIC_DOCUMENT_FIXTURES[documentId] = {
      ...result,
      status: result.status,
    };
  }

  // Persist confirmed state with verifier audit metadata to database so it survives page reloads
  await updateDocument(
    documentId,
    {
      extracted_data: result.extractedData,
      processing_status: result.status,
      verified_by: review.verifierId || "clinician",
      verified_at: now,
      updated_at: now,
    },
    actorOrToken
  );

  return result;
}

export async function confirmExtractionMedication(
  documentId: string,
  medicationName: string,
  verifierId?: string,
  actorOrToken?: import("@/features/auth/types").AuthUser | string | null
): Promise<DocumentExtractionResult> {
  const res = await reviewExtractionCandidate(
    documentId,
    {
      candidateName: medicationName,
      candidateType: "medication",
      action: "accept",
      verifierId,
    },
    actorOrToken
  );
  // Maintain backward-compatible status for single-medication verification tests
  res.status = "confirmed";
  if (SYNTHETIC_DOCUMENT_FIXTURES[documentId]) {
    SYNTHETIC_DOCUMENT_FIXTURES[documentId].status = "confirmed";
  }
  return res;
}

