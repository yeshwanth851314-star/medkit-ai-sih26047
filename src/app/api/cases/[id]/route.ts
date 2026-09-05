import { NextResponse } from "next/server";
import { getCaseDetails, updateCaseDraft, finalizeCase } from "@/features/cases/case-service";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clinicalCase = await getCaseDetails(id);

    if (!clinicalCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    return NextResponse.json({ case: clinicalCase });
  } catch (err) {
    console.error("GET /api/cases/[id] error:", err);
    return NextResponse.json({ error: "Failed to retrieve case details" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const user = await getCurrentUser();

    // Check if user requested finalization
    if (body.action === "finalize") {
      const finalized = await finalizeCase(id, user?.id);
      return NextResponse.json({ success: true, case: finalized });
    }

    // Otherwise standard draft update
    const updated = await updateCaseDraft(id, body);
    return NextResponse.json({ success: true, case: updated });
  } catch (err: any) {
    console.error("PATCH /api/cases/[id] error:", err);
    if (err.message && err.message.includes("CANNOT_MUTATE_FINAL")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Failed to update case" }, { status: 500 });
  }
}
