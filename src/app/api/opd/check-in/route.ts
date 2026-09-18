import { NextResponse } from "next/server";
import { checkInPatientToOpd } from "@/features/opd/opd-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const checkInSchema = z.object({
  appointmentId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await checkInPatientToOpd(parsed.data.appointmentId, user);
    return NextResponse.json({
      success: true,
      appointment: result.appointment,
      queueEntry: result.queueEntry,
    });
  } catch (err: any) {
    console.error("POST /api/opd/check-in error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check in patient" },
      { status: 500 }
    );
  }
}
