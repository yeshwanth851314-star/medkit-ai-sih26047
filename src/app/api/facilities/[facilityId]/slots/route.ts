import { NextResponse } from "next/server";
import { listAvailableSlots } from "@/features/appointments/appointment-service";
import { extractBearerOrCookieToken } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const { facilityId } = await params;
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const token = extractBearerOrCookieToken(request);

    const slots = await listAvailableSlots(facilityId, departmentId, token);
    return NextResponse.json({ slots });
  } catch (err: any) {
    console.error("GET /api/facilities/[facilityId]/slots error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch slots" }, { status: 500 });
  }
}
