import { NextResponse } from "next/server";
import { updateDiagnosticOrderStatus } from "@/features/diagnostics/diagnostic-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { DiagnosticOrderStatus } from "@/types/ecosystem";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "ORDERED",
    "ACCEPTED",
    "SAMPLE_COLLECTED",
    "IN_PROGRESS",
    "RESULT_AVAILABLE",
    "REVIEWED",
    "CANCELLED",
  ]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const order = await updateDiagnosticOrderStatus(
      id,
      parsed.data.status as DiagnosticOrderStatus,
      user
    );

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error("POST /api/diagnostics/orders/[id]/status error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update diagnostic order status" },
      { status: 500 }
    );
  }
}
