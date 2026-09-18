import { NextResponse } from "next/server";
import { acknowledgeDiagnosticReview } from "@/features/diagnostics/diagnostic-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);

    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!["doctor", "clinician", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only authorized clinicians may review diagnostic results" },
        { status: 403 }
      );
    }

    const order = await acknowledgeDiagnosticReview(id, user.fullName || user.id, user);

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error("POST /api/diagnostics/orders/[id]/review error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to review diagnostic order" },
      { status: 500 }
    );
  }
}
