import { NextResponse } from "next/server";
import { listFacilityDepartments } from "@/features/appointments/appointment-service";
import { extractBearerOrCookieToken } from "@/lib/auth/api-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const { facilityId } = await params;
    const token = extractBearerOrCookieToken(request);
    const departments = await listFacilityDepartments(facilityId, token);
    return NextResponse.json({ departments });
  } catch (err: any) {
    console.error("GET /api/facilities/[facilityId]/departments error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch departments" }, { status: 500 });
  }
}
