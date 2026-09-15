import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { listPendingFacilityApplications } from "@/features/onboarding/clinician-onboarding-service";

export async function GET(request: Request) {
  const authResult = await requireApiAuth(request, {
    allowedRoles: ["admin", "staff"],
  });

  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { user } = authResult;
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId") || user.facilityId;

  if (!facilityId) {
    return NextResponse.json(
      { error: "INVALID_REQUEST: facilityId is required" },
      { status: 400 }
    );
  }

  if (user.facilityId && user.facilityId !== facilityId) {
    return NextResponse.json(
      { error: "FORBIDDEN: You cannot view applications for another healthcare facility." },
      { status: 403 }
    );
  }

  try {
    const applications = await listPendingFacilityApplications(facilityId, user);
    return NextResponse.json({ applications }, { status: 200 });
  } catch (err: any) {
    console.error("Failed to list facility applications:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
