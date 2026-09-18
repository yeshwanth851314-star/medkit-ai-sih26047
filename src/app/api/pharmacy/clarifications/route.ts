import { NextResponse } from "next/server";
import { raiseClarification } from "@/features/pharmacy/pharmacy-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const clarificationSchema = z.object({
  prescriptionId: z.string().uuid(),
  reason: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);

    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = clarificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const clarification = await raiseClarification(
      {
        prescriptionId: parsed.data.prescriptionId,
        raisedBy: user.fullName || user.id,
        reason: parsed.data.reason,
      },
      user
    );

    return NextResponse.json({
      success: true,
      clarification,
    });
  } catch (err: any) {
    console.error("POST /api/pharmacy/clarifications error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to raise clarification" },
      { status: 500 }
    );
  }
}
