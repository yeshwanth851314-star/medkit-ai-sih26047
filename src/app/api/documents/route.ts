import { NextResponse } from "next/server";
import { validateDocumentFile } from "@/features/documents/document-service";
import {
  getDocumentsByPatientId,
  createDocument,
  uploadDocumentToStorage,
  deleteDocumentFromStorage,
} from "@/lib/db/supabase";
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

    const documents = await getDocumentsByPatientId(patientId, auth.user);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "READ_DOCUMENT",
      resourceType: "documents",
      resourceId: patientId,
      metadata: { count: documents.length },
      actorOrToken: auth.user,
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

    if (!fileBase64 || typeof fileBase64 !== "string" || fileBase64.trim().length === 0) {
      return NextResponse.json({ error: "fileBase64 (non-empty document file data) is required" }, { status: 400 });
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

    // Decode and calculate actual file buffer size
    const fileBuffer = Buffer.from(fileBase64, "base64");
    if (fileBuffer.length === 0) {
      return NextResponse.json({ error: "Uploaded document file cannot be empty" }, { status: 400 });
    }
    const decodedSize = fileBuffer.length;

    // Validate file metadata against real decoded bytes
    const validation = validateDocumentFile({ mimeType, sizeBytes: decodedSize });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate valid RFC 4122 UUID for database schema compatibility
    const docId = crypto.randomUUID();

    // 1. Upload file bytes to private Storage FIRST
    let storagePath: string;
    try {
      const uploadRes = await uploadDocumentToStorage(
        patientId,
        caseId || null,
        docId,
        fileName,
        fileBuffer,
        mimeType,
        auth.user
      );
      storagePath = uploadRes.storagePath;
    } catch (uploadErr: any) {
      console.error("Failed to upload document bytes to private storage:", uploadErr);
      return NextResponse.json(
        { error: `Document storage failure: ${uploadErr.message || "Failed to persist document to private storage."}` },
        { status: 500 }
      );
    }

    // 2. Persist document record referencing the verified storage object
    // If DB insertion fails, compensate by deleting the uploaded storage object
    let newDoc;
    try {
      newDoc = await createDocument(
        {
          id: docId,
          patient_id: patientId,
          case_id: caseId || null,
          uploaded_by: auth.user.fullName || auth.user.id,
          storage_path: storagePath,
          original_filename: fileName,
          mime_type: mimeType,
          file_size: decodedSize,
          document_type: documentType || "prescription",
          processing_status: "uploaded" as const,
          ocr_confidence: null,
          extracted_data: null,
          error_message: null,
        },
        auth.user
      );
    } catch (dbErr: any) {
      console.error("Failed to persist document row, compensating storage upload:", dbErr);
      await deleteDocumentFromStorage(storagePath, auth.user).catch((cleanupErr) => {
        console.error("Storage compensation cleanup failed:", cleanupErr);
      });
      return NextResponse.json(
        { error: "Failed to persist document metadata. Upload aborted and compensated." },
        { status: 500 }
      );
    }

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "UPLOAD_DOCUMENT",
      resourceType: "documents",
      resourceId: newDoc.id,
      metadata: { patient_id: patientId, file_name: fileName, file_size: decodedSize },
      actorOrToken: auth.user,
    });

    return NextResponse.json({ success: true, document: newDoc }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/documents error:", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

