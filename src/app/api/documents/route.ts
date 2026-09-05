import { NextResponse } from "next/server";
import { validateDocumentFile } from "@/features/documents/document-service";
import { getDocumentsByPatientId } from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const documents = await getDocumentsByPatientId(patientId);
    return NextResponse.json({ documents });
  } catch (err: any) {
    console.error("GET /api/documents error:", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const newDoc = {
      id: docId,
      patient_id: patientId,
      case_id: null,
      uploaded_by: "system",
      storage_path: `/private/documents/${patientId}/${docId}`,
      original_filename: fileName,
      mime_type: mimeType,
      file_size: sizeBytes || 1024,
      document_type: documentType || "prescription",
      processing_status: "uploaded" as const,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, document: newDoc }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/documents error:", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
