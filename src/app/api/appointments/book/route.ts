import { NextResponse } from "next/server";
import { bookPatientAppointment } from "@/features/appointments/appointment-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const bookSchema = z.object({
  patientId: z.string().uuid(),
  facilityId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  clinicianId: z.string().optional().nullable(),
  slotId: z.string().optional().nullable(),
  intakeCaseId: z.string().optional().nullable(),
  scheduledAt: z.string().min(1),
  reason: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const parsed = bookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const appointment = await bookPatientAppointment(
      {
        ...parsed.data,
        createdBy: user?.id || "patient",
      },
      user
    );

    return NextResponse.json({
      success: true,
      appointment,
    });
  } catch (err: any) {
    console.error("POST /api/appointments/book error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to book appointment" },
      { status: 500 }
    );
  }
}
