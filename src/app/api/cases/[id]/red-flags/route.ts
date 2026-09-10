import { NextResponse } from "next/server";
import { getCaseById, updateCase, getAuthorizedSupabaseClient, getServiceSupabaseClient } from "@/lib/db/supabase";
import { mockDb } from "@/lib/db/mock-adapter";
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
    const body = await request.json().catch(() => ({}));
    const { ruleId } = body;

    const currentRedFlags = c.red_flags || [];
    const ackTimestamp = new Date().toISOString();
    const ackAuthor = auth.user.fullName || auth.user.id || "Attending Doctor";

    const updatedRedFlags = currentRedFlags.map((rf) => {
      if (rf.rule_id === ruleId) {
        return {
          ...rf,
          acknowledged_by: ackAuthor,
          acknowledged_at: ackTimestamp,
        };
      }
      return rf;
    });

    if (c.status === "draft") {
      await updateCase(id, { red_flags: updatedRedFlags }, auth.user);
    }

    if (env.isDemoMode) {
      mockDb.updateRedFlagEvent(id, ruleId, ackAuthor, ackTimestamp, auth.user.role, auth.user.facilityId || undefined);
      await logAuditEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "ACKNOWLEDGE_RED_FLAG",
        resourceType: "cases",
        resourceId: id,
        metadata: { action: "acknowledge_red_flag", ruleId },
      });
    } else {
      const supabase = getAuthorizedSupabaseClient(auth.user) || getServiceSupabaseClient();
      if (!supabase) {
        throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
      }
      const { error } = await supabase.rpc("rpc_acknowledge_red_flag_with_audit", {
        p_case_id: id,
        p_rule_id: ruleId,
      });
      if (error) {
        console.error("Supabase rpc_acknowledge_red_flag_with_audit error:", error);
        throw new Error(`Database error acknowledging red flag: ${error.message}`);
      }
    }

    return NextResponse.json({ success: true, redFlags: updatedRedFlags });
  } catch (err: any) {
    console.error("POST acknowledge red flag error:", err);
    if (err.message?.includes("NOT_FOUND_OR_ALREADY_ACKNOWLEDGED")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Failed to acknowledge red flag" }, { status: 500 });
  }
}

