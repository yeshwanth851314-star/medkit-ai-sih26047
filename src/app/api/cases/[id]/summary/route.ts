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

    const summary = await generateDeterministicSummary(id);
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

    const body = await request.json().catch(() => ({}));

    // Handle clinician confirmation action
    if (body.action === "confirm") {
      const now = new Date().toISOString();
      const baseline = body.summary || (await generateDeterministicSummary(id));
      const confirmedSummary = {
        ...baseline,
        hpiNarrative: body.narrative || baseline.hpiNarrative || "",
        status: "confirmed" as const,
        confirmedBy: auth.user.fullName || auth.user.id,
        confirmedAt: now,
        editedByClinician: Boolean(body.editedByClinician),
      };

      const { updateCase } = await import("@/lib/db/supabase");
      await updateCase(id, {
        assessment_plan: {
          summary: confirmedSummary.hpiNarrative,
          plan: body.plan || null,
        },
      });

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
      ? await aiProvider.generateClinicalSummary(id)
      : await generateDeterministicSummary(id);

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("POST summary error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}
