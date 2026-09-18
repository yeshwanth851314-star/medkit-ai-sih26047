import { NextResponse } from "next/server";
import { listAppointments } from "@/features/appointments/appointment-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { AppointmentStatus } from "@/types/ecosystem";

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId") || undefined;
    const facilityId = searchParams.get("facilityId") || user?.facilityId || undefined;
    const status = (searchParams.get("status") as AppointmentStatus) || undefined;

    const appointments = await listAppointments({ patientId, facilityId, status }, user);
    return NextResponse.json({ appointments });
  } catch (err: any) {
    console.error("GET /api/appointments error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}
