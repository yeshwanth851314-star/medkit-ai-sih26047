import { NextResponse } from "next/server";
import { confirmExtractionMedication } from "@/features/documents/document-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireDocumentAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, { allowedRoles: ["doctor", "clinician", "admin"] });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const docCheck = await requireDocumentAccess(auth.user, id);
    if (!docCheck.authorized) {
      return docCheck.errorResponse;
    }
    const body = await request.json().catch(() => ({}));
    const { medicationName } = body;

    if (!medicationName) {
      return NextResponse.json({ error: "medicationName is required" }, { status: 400 });
    }

    const updated = await confirmExtractionMedication(id, medicationName);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CONFIRM_DOCUMENT_OCR",
      resourceType: "documents",
      resourceId: id,
      metadata: { action: "confirm_medication", medicationName },
    });

    return NextResponse.json({ success: true, extraction: updated });
  } catch (err: any) {
    console.error("POST confirm error:", err);
    return NextResponse.json({ error: "Failed to confirm extraction field" }, { status: 500 });
  }
}

