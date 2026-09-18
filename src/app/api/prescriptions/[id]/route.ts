import { NextResponse } from "next/server";
import { getPrescriptionDetails } from "@/features/prescriptions/prescription-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);
    const prescription = await getPrescriptionDetails(id, user);

    if (!prescription) {
      return NextResponse.json({ error: "PRESCRIPTION_NOT_FOUND" }, { status: 404 });
    }

    // Security invariant: Pharmacists cannot inspect DRAFT prescriptions
    if (user?.role === "pharmacist" && prescription.status === "DRAFT") {
      return NextResponse.json(
        { error: "FORBIDDEN: Pharmacy cannot inspect draft prescriptions prior to clinician finalization" },
        { status: 403 }
      );
    }

    return NextResponse.json({ prescription });
  } catch (err: any) {
    console.error("GET /api/prescriptions/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch prescription details" },
      { status: 500 }
    );
  }
}
