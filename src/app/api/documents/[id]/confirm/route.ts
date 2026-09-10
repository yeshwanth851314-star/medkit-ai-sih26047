import { NextResponse } from "next/server";
import { reviewExtractionCandidate, confirmExtractionMedication } from "@/features/documents/document-service";
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
    const {
      medicationName,
      candidateId,
      candidateName,
      candidateType,
      action = "accept",
      updatedValue,
    } = body;

    const targetIdentifier = candidateId || candidateName || medicationName;
    if (!targetIdentifier) {
      return NextResponse.json(
        { error: "A candidate identifier (candidateId, candidateName, or medicationName) is required" },
        { status: 400 }
      );
    }

    if (!["accept", "reject", "edit"].includes(action)) {
      return NextResponse.json(
        { error: `Invalid review action '${action}'. Must be 'accept', 'reject', or 'edit'.` },
        { status: 400 }
      );
    }

    const priorDoc = docCheck.data;
    const priorExtractedData = JSON.parse(JSON.stringify(priorDoc.extracted_data || {}));
    const priorStatus = priorDoc.processing_status;

    let updated;
    if (candidateId || candidateType || action !== "accept" || updatedValue) {
      updated = await reviewExtractionCandidate(id, {
        candidateId,
        candidateName: candidateName || medicationName,
        candidateType: candidateType || (medicationName ? "medication" : undefined),
        action,
        updatedValue,
        verifierId: auth.user.id,
      });
    } else {
      updated = await confirmExtractionMedication(id, medicationName, auth.user.id);
    }

    try {
      await logAuditEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "CONFIRM_DOCUMENT_OCR",
        resourceType: "documents",
        resourceId: id,
        metadata: {
          action: `candidate_${action}`,
          targetIdentifier,
          candidateType: candidateType || "medication",
          updatedValue,
        },
        actorOrToken: auth.user,
      });
    } catch (auditErr) {
      // Revert document extracted_data and status to restore atomic consistency
      const { updateDocument } = await import("@/lib/db/supabase");
      await updateDocument(
        id,
        {
          extracted_data: priorExtractedData,
          processing_status: priorStatus,
        },
        auth.user
      ).catch((revertErr) => {
        console.error("Failed to revert document state after audit failure:", revertErr);
      });
      throw auditErr;
    }

    return NextResponse.json({ success: true, extraction: updated });
  } catch (err: any) {
    console.error("POST confirm error:", err);
    if (err.message && (err.message.includes("not an extraction candidate") || err.message.includes("is not an extraction candidate"))) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to confirm extraction field" }, { status: 500 });
  }
}

