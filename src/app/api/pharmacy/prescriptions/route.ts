import { NextResponse } from "next/server";
import { getPharmacyPrescriptionQueue } from "@/features/pharmacy/pharmacy-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId") || user?.facilityId || "fac-hyd-01";

    const prescriptions = await getPharmacyPrescriptionQueue(facilityId, user);
    return NextResponse.json({ prescriptions });
  } catch (err: any) {
    console.error("GET /api/pharmacy/prescriptions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch pharmacy prescriptions" },
      { status: 500 }
    );
  }
}
