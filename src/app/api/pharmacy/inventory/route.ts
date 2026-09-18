import { NextResponse } from "next/server";
import { fetchPharmacyInventory } from "@/features/pharmacy/pharmacy-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId") || user?.facilityId || "fac-hyd-01";

    const inventory = await fetchPharmacyInventory(facilityId, user);
    return NextResponse.json({ inventory });
  } catch (err: any) {
    console.error("GET /api/pharmacy/inventory error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch pharmacy inventory" },
      { status: 500 }
    );
  }
}
