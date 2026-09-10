import { NextResponse } from "next/server";
import { generateDeterministicSummary } from "@/features/summaries/summary-service";
import { getAIProvider } from "@/features/ai/ai-provider";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireCaseAccess } from "@/lib/auth/object-guard";
import { checkRateLimit, createRateLimitResponse, getRateLimitKey } from "@/lib/security/rate-limiter";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }

    const clinicalCase = caseCheck.data;

    // Reload persisted summary from database if present
    if (clinicalCase.ai_summary && Object.keys(clinicalCase.ai_summary).length > 0) {
      return NextResponse.json({ summary: clinicalCase.ai_summary });
    }

    // GET is strictly idempotent: compute deterministic summary without mutating the database
    const summary = await generateDeterministicSummary(id, auth.user);
    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("GET summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const caseCheck = await requireCaseAccess(auth.user, id);
    if (!caseCheck.authorized) {
      return caseCheck.errorResponse;
    }

    const clinicalCase = caseCheck.data;
    const body = await request.json().catch(() => ({}));

    // Protect finalized cases: NEVER overwrite summary or assessment plan in place
    if (clinicalCase.status === "final") {
      // If caller provides an amendment/addendum, route through addCaseAmendment
      if (body.action === "amend" || body.addendum || (body.reason && (body.notes || body.amendment || body.narrative))) {
        const { addCaseAmendment } = await import("@/features/cases/case-service");
        const updatedCase = await addCaseAmendment(
          id,
          {
            actorId: auth.user.id,
            actorName: auth.user.fullName || auth.user.id,
            reason: body.reason || "Clinical addendum to finalized case",
            notes: body.notes || body.amendment || body.narrative || "Addendum notes",
          },
          auth.user
        );
        return NextResponse.json({ success: true, amended: true, case: updatedCase });
      }

      return NextResponse.json(
        {
          error: "Case is finalized and locked. Assessment plan and summary cannot be overwritten in place. Post-finalization notes must be appended as signed addenda.",
        },
        { status: 409 }
      );
    }

    // Handle clinician confirmation action
    if (body.action === "confirm") {
      const now = new Date().toISOString();
      const baseline = body.summary || clinicalCase.ai_summary || (await generateDeterministicSummary(id, auth.user));
      const confirmedSummary = {
        ...baseline,
        hpiNarrative: body.narrative || baseline.hpiNarrative || "",
        status: "confirmed" as const,
        confirmedBy: auth.user.fullName || auth.user.id,
        confirmedAt: now,
        editedByClinician: Boolean(body.editedByClinician),
      };

      const existingPlan = clinicalCase.assessment_plan?.plan || null;
      const preservedPlan = body.plan !== undefined && body.plan !== null && body.plan !== ""
        ? body.plan
        : existingPlan;

      const { updateCase } = await import("@/lib/db/supabase");
      await updateCase(id, {
        ai_summary: confirmedSummary,
        assessment_plan: {
          summary: confirmedSummary.hpiNarrative,
          plan: preservedPlan,
        },
      }, auth.user);

      const { logAuditEvent } = await import("@/features/security/audit-service");
      await logAuditEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "CONFIRM_SUMMARY",
        resourceType: "cases",
        resourceId: id,
        metadata: {
          confirmedBy: confirmedSummary.confirmedBy,
          confirmedAt: confirmedSummary.confirmedAt,
          editedByClinician: confirmedSummary.editedByClinician,
          provider: confirmedSummary.providerMeta?.provider || "deterministic",
          model: confirmedSummary.providerMeta?.model || "rule-engine",
        },
      });

      return NextResponse.json({ success: true, summary: confirmedSummary });
    }

    // Rate limit summary generation calls to prevent LLM quota exhaustion
    const rateLimitKey = getRateLimitKey(request, "summary_gen", auth.user.id);
    const rateCheck = checkRateLimit(rateLimitKey, { windowMs: 60 * 1000, maxRequests: 15 });
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.resetTimeMs, "Summary generation rate limit exceeded. Please wait a moment.");
    }

    const useAI = body.type === "ai_assisted";

    const aiProvider = getAIProvider();
    const summary = useAI
      ? await aiProvider.generateClinicalSummary(id, auth.user)
      : await generateDeterministicSummary(id, auth.user);

    // Persist generated summary into ai_summary column and preserve existing plan
    const { updateCase } = await import("@/lib/db/supabase");
    await updateCase(id, {
      ai_summary: summary,
      assessment_plan: {
        summary: summary.hpiNarrative,
        plan: clinicalCase.assessment_plan?.plan || null,
      },
    }, auth.user);

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("POST summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}
