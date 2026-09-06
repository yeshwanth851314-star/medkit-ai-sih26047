import { NextResponse } from "next/server";
import { getOCRProvider } from "@/features/documents/ocr-provider";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireDocumentAccess } from "@/lib/auth/object-guard";
import { updateDocument } from "@/lib/db/supabase";
import { logAuditEvent } from "@/features/security/audit-service";
import { checkRateLimit, createRateLimitResponse, getRateLimitKey } from "@/lib/security/rate-limiter";

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

    const ocrProvider = getOCRProvider();
    const extraction = await ocrProvider.extract({ documentId: id });

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

    // Rate limiting: 20 extractions per minute per user
    const rateLimitKey = getRateLimitKey(request, "doc_extract", auth.user.id);
    const rateCheck = checkRateLimit(rateLimitKey, { windowMs: 60 * 1000, maxRequests: 20 });
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.resetTimeMs, "Document extraction rate limit exceeded. Please wait a moment.");
    }

    const body = await request.json().catch(() => ({}));

    // Check MIME type if provided
    if (body.mimeType && !ALLOWED_DOCUMENT_MIMES.has(body.mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported document MIME type: ${body.mimeType}. Allowed formats: PDF, JPEG, PNG, WEBP, TIFF` },
        { status: 415 }
      );
    }

    // Check payload size if base64 image provided
    if (body.imageBase64) {
      const approximateBytes = Math.ceil((body.imageBase64.length * 3) / 4);
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
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      fileName: body.fileName,
      mockId: body.mockId,
    });

    // Persist extraction into database record
    await updateDocument(id, {
      extracted_data: extraction.extractedData,
      ocr_confidence: extraction.confidence,
      processing_status: extraction.status === "failed" ? "failed" : "extracted",
    });

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CONFIRM_DOCUMENT_OCR",
      resourceType: "documents",
      resourceId: id,
      metadata: { action: "run_extraction", provider: extraction.providerMeta?.provider },
    });

    return NextResponse.json({ extraction });
  } catch (err: any) {
    console.error("POST extraction error:", err);
    return NextResponse.json({ error: "Failed to run document extraction" }, { status: 500 });
  }
}

