import { NextResponse } from "next/server";
import { getPatientDetails } from "@/features/patients/patient-service";
import { getCasesByPatientId, getDocumentsByPatientId } from "@/lib/db/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patient = await getPatientDetails(id);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const [cases, documents] = await Promise.all([
      getCasesByPatientId(id),
      getDocumentsByPatientId(id),
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
