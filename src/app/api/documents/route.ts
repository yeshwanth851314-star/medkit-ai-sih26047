import { NextResponse } from "next/server";
import { validateDocumentFile } from "@/features/documents/document-service";
import { getDocumentsByPatientId, createDocument, uploadDocumentToStorage } from "@/lib/db/supabase";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requirePatientAccess, requireCaseBelongsToPatient } from "@/lib/auth/object-guard";
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

    const patientAccess = await requirePatientAccess(auth.user, patientId);
    if (!patientAccess.authorized) {
      return patientAccess.errorResponse;
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
    const body = await request.json().catch(() => ({}));
    const { patientId, fileName, mimeType, sizeBytes, documentType, caseId, fileBase64 } = body;

    if (!patientId || !fileName || !mimeType) {
      return NextResponse.json({ error: "Missing required document metadata" }, { status: 400 });
    }

    const patientAccess = await requirePatientAccess(auth.user, patientId);
    if (!patientAccess.authorized) {
      return patientAccess.errorResponse;
    }

    if (caseId) {
      const caseMatch = await requireCaseBelongsToPatient(caseId, patientId);
      if (!caseMatch.authorized) {
        return caseMatch.errorResponse;
      }
    }

    // Validate file metadata
    const validation = validateDocumentFile({ mimeType, sizeBytes: sizeBytes || 1024 });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const docId = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    // 1. Upload file bytes to private Supabase Storage first
    // If storage upload fails, fail closed — do NOT create an orphaned or fake document record.
    let storagePath = `/private/documents/${patientId}/${docId}/${safeName}`;
    if (fileBase64) {
      try {
        const fileBuffer = Buffer.from(fileBase64, "base64");
        const uploadRes = await uploadDocumentToStorage(
          patientId,
          caseId || null,
          docId,
          fileName,
          fileBuffer,
          mimeType
        );
        storagePath = uploadRes.storagePath;
      } catch (uploadErr: any) {
        console.error("Failed to upload document bytes to private storage:", uploadErr);
        return NextResponse.json(
          { error: `Document storage failure: ${uploadErr.message || "Failed to persist document to private storage."}` },
          { status: 500 }
        );
      }
    }

    // 2. Persist document record referencing the verified storage object
    const newDoc = await createDocument({
      id: docId,
      patient_id: patientId,
      case_id: caseId || null,
      uploaded_by: auth.user.fullName || auth.user.id,
      storage_path: storagePath,
      original_filename: fileName,
      mime_type: mimeType,
      file_size: sizeBytes || (fileBase64 ? Math.ceil((fileBase64.length * 3) / 4) : 1024),
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

