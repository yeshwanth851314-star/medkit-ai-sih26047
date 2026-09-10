import { NextResponse } from "next/server";
import { getPatientDetails } from "@/features/patients/patient-service";
import { getCasesByPatientId, getDocumentsByPatientId } from "@/lib/db/supabase";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requirePatientAccess } from "@/lib/auth/object-guard";

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
    const accessCheck = await requirePatientAccess(auth.user, id);
    if (!accessCheck.authorized) {
      return accessCheck.errorResponse;
    }
    const patient = accessCheck.data;

    const [cases, documents] = await Promise.all([
      getCasesByPatientId(id, auth.user),
      getDocumentsByPatientId(id, auth.user),
    ]);

    return NextResponse.json({
      patient,
      cases,
      documents,
    });
  } catch (err) {
    console.error("GET /api/patients/[id] error:", err);
    return NextResponse.json({ error: "Failed to retrieve patient record" }, { status: 500 });
  }
}
