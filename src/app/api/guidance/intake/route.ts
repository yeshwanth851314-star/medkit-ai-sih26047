import { NextResponse } from "next/server";
import { generatePreliminaryIntakeGuidance } from "@/features/guidance/intake-guidance-service";
import { z } from "zod";

const guidanceSchema = z.object({
  chiefComplaint: z.string().min(1),
  rawComplaint: z.string().optional().nullable(),
  redFlags: z.array(z.any()).optional().nullable(),
  caseType: z.enum(["general", "ayush"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = guidanceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const guidance = generatePreliminaryIntakeGuidance(parsed.data);
    return NextResponse.json({
      success: true,
      guidance,
    });
  } catch (err: any) {
    console.error("POST /api/guidance/intake error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate intake guidance" },
      { status: 500 }
    );
  }
}
