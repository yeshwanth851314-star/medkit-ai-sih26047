import { NextResponse } from "next/server";
import { caseInputSchema } from "@/features/cases/types";
import { createCaseDraft } from "@/features/cases/case-service";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requirePatientAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";
import { getCasesByPatientId } from "@/lib/db/supabase";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId query parameter is required" }, { status: 400 });
    }

    const patientCheck = await requirePatientAccess(auth.user, patientId);
    if (!patientCheck.authorized) {
      return patientCheck.errorResponse;
    }

    const cases = await getCasesByPatientId(patientId, auth.user);
    return NextResponse.json({ cases });
  } catch (err) {
    console.error("GET /api/cases error:", err);
    return NextResponse.json({ error: "Failed to retrieve cases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const rawIdempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("X-Idempotency-Key") ||
      null;

    const body = await request.json().catch(() => ({}));
    const idempotencyKey =
      rawIdempotencyKey || (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
    const validated = caseInputSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const patientCheck = await requirePatientAccess(auth.user, validated.data.patientId);
    if (!patientCheck.authorized) {
      return patientCheck.errorResponse;
    }

    const effectiveIdempotencyKey = idempotencyKey?.trim() || `case-create-auto-${crypto.randomUUID()}`;
    const { executeIdempotentMutation, getCaseById } = await import("@/lib/db/supabase");
    const { computePayloadHash } = await import("@/features/security/canonical-hash");
    const payloadHash = computePayloadHash(validated.data);
    const result = await executeIdempotentMutation({
      idempotencyKey: effectiveIdempotencyKey,
      userId: auth.user.id,
      entity: "cases",
      action: "create",
      payloadHash,
      payload: validated.data,
      actorOrToken: auth.user,
    });

    if (result.isReplay) {
      const caseId = result.resourceId || result.summary?.caseId;
      const existingCase = caseId ? await getCaseById(caseId, auth.user) : null;
      return NextResponse.json(
        { success: true, case: existingCase || result.summary, isReplay: true },
        { status: 200, headers: { "Idempotency-Replay": "true" } }
      );
    }

    const createdCaseId = result.resourceId || result.summary?.caseId;
    const createdCase = createdCaseId ? await getCaseById(createdCaseId, auth.user) : null;
    return NextResponse.json(
      { success: true, case: createdCase || result.summary },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/cases error:", err);
    if (err.message && err.message.includes("CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH")) {
      return NextResponse.json(
        { error: "CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency key is already bound to a different payload." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message || "Failed to create case" }, { status: 500 });
  }
}
