import { NextResponse } from "next/server";
import { getCaseById, updateCase } from "@/lib/db/supabase";
import { evaluateClinicalRedFlags } from "@/features/red-flags/rules-engine";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const c = await getCaseById(id);
    if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const redFlags = evaluateClinicalRedFlags({
      chiefComplaint: c.chief_complaint,
      rawPatientComplaint: c.raw_patient_complaint,
      hpi: c.hpi,
    });

    return NextResponse.json({ redFlags });
  } catch (err: any) {
    console.error("GET red flags error:", err);
    return NextResponse.json({ error: "Failed to evaluate red flags" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const user = await getCurrentUser();
    const { ruleId } = body;

    const c = await getCaseById(id);
    if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const currentRedFlags = c.red_flags || [];
    const updatedRedFlags = currentRedFlags.map((rf) => {
      if (rf.rule_id === ruleId) {
        return {
          ...rf,
          acknowledged_by: user?.fullName || "Attending Doctor",
          acknowledged_at: new Date().toISOString(),
        };
      }
      return rf;
    });

    await updateCase(id, { red_flags: updatedRedFlags });

    return NextResponse.json({ success: true, redFlags: updatedRedFlags });
  } catch (err: any) {
    console.error("POST acknowledge red flag error:", err);
    return NextResponse.json({ error: "Failed to acknowledge red flag" }, { status: 500 });
  }
}
