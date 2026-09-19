import { NextResponse } from "next/server";
import {
  fetchPharmacyInventory,
  updatePharmacyInventoryStock,
} from "@/features/pharmacy/pharmacy-service";
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

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const { itemId, stockQuantity } = body;

    if (!itemId || typeof stockQuantity !== "number" || stockQuantity < 0) {
      return NextResponse.json(
        { error: "Invalid itemId or stockQuantity provided" },
        { status: 400 }
      );
    }

    const updated = await updatePharmacyInventoryStock(
      itemId,
      stockQuantity,
      user
    );

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("POST /api/pharmacy/inventory error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update inventory stock" },
      { status: 500 }
    );
  }
}
