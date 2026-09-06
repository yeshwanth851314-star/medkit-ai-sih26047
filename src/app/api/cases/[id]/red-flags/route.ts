import { NextResponse } from "next/server";
import { getCaseById, updateCase, getSupabaseClient } from "@/lib/db/supabase";
import { env } from "@/config/env";
import { evaluateClinicalRedFlags } from "@/features/red-flags/rules-engine";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireCaseAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }
    const c = caseCheck.data;

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
  // Only doctors or clinicians can acknowledge clinical red flags
  const auth = await requireApiAuth(request, { allowedRoles: ["doctor", "clinician", "admin"] });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }
    const c = caseCheck.data;
    const body = await request.json();
    const { ruleId } = body;

    const currentRedFlags = c.red_flags || [];
    const updatedRedFlags = currentRedFlags.map((rf) => {
      if (rf.rule_id === ruleId) {
        return {
          ...rf,
          acknowledged_by: auth.user.fullName || "Attending Doctor",
          acknowledged_at: new Date().toISOString(),
        };
      }
      return rf;
    });

    await updateCase(id, { red_flags: updatedRedFlags });

    const supabase = getSupabaseClient();
    if (supabase && !env.isDemoMode) {
      try {
        await supabase
          .from("red_flag_events")
          .update({
            acknowledged_by: auth.user.fullName || auth.user.id,
            acknowledged_at: new Date().toISOString(),
          })
          .eq("case_id", id)
          .eq("rule_id", ruleId);
      } catch (err) {
        console.warn("Failed to update red_flag_events table:", err);
      }
    }

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "ACKNOWLEDGE_RED_FLAG",
      resourceType: "cases",
      resourceId: id,
      metadata: { action: "acknowledge_red_flag", ruleId },
    });

    return NextResponse.json({ success: true, redFlags: updatedRedFlags });
  } catch (err: any) {
    console.error("POST acknowledge red flag error:", err);
    return NextResponse.json({ error: "Failed to acknowledge red flag" }, { status: 500 });
  }
}

