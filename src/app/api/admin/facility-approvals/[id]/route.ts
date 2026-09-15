import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import {
  approveFacilityApplication,
  rejectFacilityApplication,
} from "@/features/onboarding/clinician-onboarding-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth(request, {
    allowedRoles: ["admin", "staff"],
  });

  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { user } = authResult;
  const { id } = await params;

  try {
    const body = await request.json();
    const { action, rejectionReason } = body;

    if (action === "approve") {
      const result = await approveFacilityApplication(id, user);
      return NextResponse.json(result, { status: 200 });
    } else if (action === "reject") {
      const result = await rejectFacilityApplication(
        id,
        rejectionReason || "Application rejected by facility administrator",
        user
      );
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(
        { error: "INVALID_REQUEST: action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Facility application action error:", err);
    const message = err?.message || "Internal server error";
    const status = message.startsWith("FORBIDDEN") ? 403 : message.startsWith("APPLICATION_NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
