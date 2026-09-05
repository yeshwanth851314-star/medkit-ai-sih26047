import { NextResponse } from "next/server";
import { caseInputSchema } from "@/features/cases/types";
import { createCaseDraft } from "@/features/cases/case-service";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = caseInputSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    const newCase = await createCaseDraft(validated.data, user?.id);

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (err) {
    console.error("POST /api/cases error:", err);
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
