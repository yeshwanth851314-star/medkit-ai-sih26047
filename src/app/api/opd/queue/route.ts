import { NextResponse } from "next/server";
import { fetchOpdQueue } from "@/features/opd/opd-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { OpdQueueStatus } from "@/types/ecosystem";

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId") || user?.facilityId || "fac-hyd-01";
    const status = (searchParams.get("status") as OpdQueueStatus) || undefined;

    const queue = await fetchOpdQueue(facilityId, status, user);
    return NextResponse.json({ queue });
  } catch (err: any) {
    console.error("GET /api/opd/queue error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch OPD queue" },
      { status: 500 }
    );
  }
}
