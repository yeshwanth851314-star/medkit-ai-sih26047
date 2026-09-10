import { NextResponse } from "next/server";
import { getOCRProvider } from "@/features/documents/ocr-provider";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireDocumentAccess } from "@/lib/auth/object-guard";
import { updateDocument, downloadDocumentFromStorage } from "@/lib/db/supabase";
import { logAuditEvent } from "@/features/security/audit-service";
import { checkRateLimit, createRateLimitResponse, getRateLimitKey } from "@/lib/security/rate-limiter";
import { env } from "@/config/env";

const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const docCheck = await requireDocumentAccess(auth.user, id);
    if (!docCheck.authorized) {
      return docCheck.errorResponse;
    }

    const doc = docCheck.data;
    if (!doc || !doc.extracted_data || Object.keys(doc.extracted_data).length === 0) {
      return NextResponse.json({ error: "Document extraction not found" }, { status: 404 });
    }

    const extraction = {
      documentId: doc.id,
      documentType: doc.document_type || "prescription",
      confidence: doc.ocr_confidence ?? 0.9,
      extractedData: doc.extracted_data,
      disclaimer: "Extracted from uploaded document — verify before use.",
      status: doc.processing_status === "confirmed" ? "confirmed" : doc.processing_status === "failed" ? "failed" : "extracted",
    };

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "READ_DOCUMENT",
      resourceType: "documents",
      resourceId: id,
      metadata: { action: "get_extraction" },
    });

    return NextResponse.json({ extraction });
  } catch (err: any) {
    console.error("GET extraction error:", err);
    return NextResponse.json({ error: "Failed to fetch document extraction" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const docCheck = await requireDocumentAccess(auth.user, id);
    if (!docCheck.authorized) {
      return docCheck.errorResponse;
    }

    const doc = docCheck.data;

    // Verify patient clinical consent permits document extraction
    const { verifyPatientConsent } = await import("@/features/consent/consent-service");
    const consentCheck = await verifyPatientConsent(doc.patient_id, "document_extraction");
    if (!consentCheck.valid) {
      return NextResponse.json(
        { error: `Consent violation: ${consentCheck.reason || "Patient consent does not permit document extraction"}` },
        { status: 403 }
      );
    }

    // Rate limiting: 20 extractions per minute per user
    const rateLimitKey = getRateLimitKey(request, "doc_extract", auth.user.id);
    const rateCheck = checkRateLimit(rateLimitKey, { windowMs: 60 * 1000, maxRequests: 20 });
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.resetTimeMs, "Document extraction rate limit exceeded. Please wait a moment.");
    }

    const body = await request.json().catch(() => ({}));

    // In production mode, reject synthetic mockId switches
    if (!env.isDemoMode && body.mockId) {
      return NextResponse.json(
        { error: "Synthetic fixture selection (mockId) is strictly prohibited in production mode" },
        { status: 400 }
      );
    }

    let imageBase64 = body.imageBase64;
    let mimeType = body.mimeType || doc.mime_type;

    // Read stored original file bytes from storage if imageBase64 not directly supplied
    if (!imageBase64 && doc.storage_path) {
      const stored = await downloadDocumentFromStorage(doc.storage_path, auth.user);
      if (stored && stored.buffer && stored.buffer.length > 0) {
        imageBase64 = stored.buffer.toString("base64");
        if (stored.mimeType) mimeType = stored.mimeType;
      }
    }

    // Check MIME type if provided
    if (mimeType && !ALLOWED_DOCUMENT_MIMES.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported document MIME type: ${mimeType}. Allowed formats: PDF, JPEG, PNG, WEBP, TIFF` },
        { status: 415 }
      );
    }

    // Check payload size if base64 image available
    if (imageBase64) {
      const approximateBytes = Math.ceil((imageBase64.length * 3) / 4);
      if (approximateBytes > MAX_DOCUMENT_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Document payload exceeds maximum 15MB limit" },
          { status: 413 }
        );
      }
    }

    const ocrProvider = getOCRProvider();
    const extraction = await ocrProvider.extract({
      documentId: id,
      imageBase64,
      mimeType,
      fileName: doc.original_filename,
      mockId: env.isDemoMode ? body.mockId : undefined,
    });

    // Persist extraction into database record
    await updateDocument(
      id,
      {
        extracted_data: extraction.extractedData,
        ocr_confidence: extraction.confidence,
        processing_status: extraction.status === "failed" ? "failed" : "extracted",
      },
      auth.user
    );

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CONFIRM_DOCUMENT_OCR",
      resourceType: "documents",
      resourceId: id,
      metadata: { action: "run_extraction", provider: extraction.providerMeta?.provider },
      actorOrToken: auth.user,
    });

    return NextResponse.json({ extraction });
  } catch (err: any) {
    console.error("POST extraction error:", err);
    return NextResponse.json({ error: err.message || "Failed to run document extraction" }, { status: 500 });
  }
}

