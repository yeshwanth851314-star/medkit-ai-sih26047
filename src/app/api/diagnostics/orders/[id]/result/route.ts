import { NextResponse } from "next/server";
import { recordDiagnosticResult } from "@/features/diagnostics/diagnostic-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const resultSchema = z.object({
  orderItemId: z.string().uuid(),
  patientId: z.string().uuid(),
  caseId: z.string().uuid(),
  resultJson: z.record(z.any()),
  resultText: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  performedBy: z.string().min(1),
  verifiedBy: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const parsed = resultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await recordDiagnosticResult(
      {
        ...parsed.data,
        performedBy: user?.fullName || parsed.data.performedBy,
        verifiedBy: parsed.data.verifiedBy || user?.fullName || null,
      },
      user
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("POST /api/diagnostics/orders/[id]/result error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to record diagnostic result" },
      { status: 500 }
    );
  }
}
