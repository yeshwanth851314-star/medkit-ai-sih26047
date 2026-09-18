import { NextResponse } from "next/server";
import { getAppointmentDetails } from "@/features/appointments/appointment-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);
    const appointment = await getAppointmentDetails(id, user);

    if (!appointment) {
      return NextResponse.json({ error: "APPOINTMENT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (err: any) {
    console.error("GET /api/appointments/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch appointment details" },
      { status: 500 }
    );
  }
}
