import { NextResponse } from "next/server";
import { approveAndFinalizePrescription } from "@/features/prescriptions/prescription-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);

    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!["doctor", "clinician", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only licensed clinicians may finalize prescriptions" },
        { status: 403 }
      );
    }

    const prescription = await approveAndFinalizePrescription(id, user.id, user);

    return NextResponse.json({
      success: true,
      prescription,
    });
  } catch (err: any) {
    console.error("POST /api/prescriptions/[id]/finalize error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to finalize prescription" },
      { status: 500 }
    );
  }
}
