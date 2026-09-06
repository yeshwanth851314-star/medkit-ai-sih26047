import { NextResponse } from "next/server";
import { getOCRProvider } from "@/features/documents/ocr-provider";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireDocumentAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

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

    const body = await request.json().catch(() => ({}));
    const ocrProvider = getOCRProvider();
    const extraction = await ocrProvider.extract({
      documentId: id,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      fileName: body.fileName,
      mockId: body.mockId,
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

