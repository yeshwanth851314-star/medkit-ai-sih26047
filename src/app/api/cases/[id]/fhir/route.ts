import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireCaseAccess } from "@/lib/auth/object-guard";
import { getPatientById, getDocumentsByPatientId } from "@/lib/db/supabase";
import { mapCaseToFhirBundle, ABDM_COMPLIANCE_DISCLAIMER } from "@/features/interoperability/fhir-mapper";
import { validateFhirBundle } from "@/features/interoperability/fhir-validator";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }
    const clinicalCase = caseCheck.data;

    const patient = await getPatientById(clinicalCase.patient_id, auth.user);
    if (!patient) {
      return NextResponse.json({ error: "Patient record associated with this case was not found" }, { status: 404 });
    }

    const documents = await getDocumentsByPatientId(clinicalCase.patient_id, auth.user);

    // Map to standard FHIR R4 Bundle
    const bundle = mapCaseToFhirBundle({
      clinicalCase,
      patient,
      documents,
    });

    // Run NRCES/ABDM Profile Validator
    const validation = validateFhirBundle(bundle);

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "EXPORT_FHIR",
      resourceType: "cases",
      resourceId: id,
      metadata: {
        facilityId: auth.user.facilityId,
        valid: validation.valid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length,
      },
    });

    return NextResponse.json(
      {
        bundle,
        validation,
        abdmComplianceNotice: ABDM_COMPLIANCE_DISCLAIMER,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/fhir+json; charset=utf-8",
        },
      }
    );
  } catch (err: any) {
    console.error("GET /api/cases/[id]/fhir error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate FHIR R4 bundle" }, { status: 500 });
  }
}
