import { NextResponse } from "next/server";
import { validateDocumentFile } from "@/features/documents/document-service";
import { getDocumentsByPatientId, createDocument } from "@/lib/db/supabase";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const documents = await getDocumentsByPatientId(patientId);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "READ_DOCUMENT",
      resourceType: "documents",
      resourceId: patientId,
      metadata: { count: documents.length },
    });

    return NextResponse.json({ documents });
  } catch (err: any) {
    console.error("GET /api/documents error:", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json();
    const { patientId, fileName, mimeType, sizeBytes, documentType } = body;

    if (!patientId || !fileName || !mimeType) {
      return NextResponse.json({ error: "Missing required document metadata" }, { status: 400 });
    }

    // Validate file
    const validation = validateDocumentFile({ mimeType, sizeBytes: sizeBytes || 1024 });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Register document in private storage / database
    const docId = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newDoc = await createDocument({
      id: docId,
      patient_id: patientId,
      case_id: body.caseId || null,
      uploaded_by: auth.user.fullName || auth.user.id,
      storage_path: `/private/documents/${patientId}/${docId}/${safeName}`,
      original_filename: fileName,
      mime_type: mimeType,
      file_size: sizeBytes || 1024,
      document_type: documentType || "prescription",
      processing_status: "uploaded" as const,
      ocr_confidence: null,
      extracted_data: null,
      error_message: null,
    });

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "UPLOAD_DOCUMENT",
      resourceType: "documents",
      resourceId: docId,
      metadata: { fileName, mimeType, patientId },
    });

    return NextResponse.json({ success: true, document: newDoc }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/documents error:", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

