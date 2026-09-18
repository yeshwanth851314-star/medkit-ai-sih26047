import { NextResponse } from "next/server";
import { getDiagnosticOrderDetails } from "@/features/diagnostics/diagnostic-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);
    const order = await getDiagnosticOrderDetails(id, user);

    if (!order) {
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error("GET /api/diagnostics/orders/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch order details" },
      { status: 500 }
    );
  }
}
