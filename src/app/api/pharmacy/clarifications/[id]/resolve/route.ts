import { NextResponse } from "next/server";
import { resolveClarification } from "@/features/pharmacy/pharmacy-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const resolveSchema = z.object({
  responseText: z.string().min(1),
});

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
        { error: "FORBIDDEN: Only clinicians may resolve prescription clarifications" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const clarification = await resolveClarification(
      {
        clarificationId: id,
        responseBy: user.fullName || user.id,
        responseText: parsed.data.responseText,
      },
      user
    );

    return NextResponse.json({
      success: true,
      clarification,
    });
  } catch (err: any) {
    console.error("POST /api/pharmacy/clarifications/[id]/resolve error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to resolve clarification" },
      { status: 500 }
    );
  }
}
