import { NextResponse } from "next/server";
import { transitionQueueStatus } from "@/features/opd/opd-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { OpdQueueStatus } from "@/types/ecosystem";
import { z } from "zod";

const transitionSchema = z.object({
  status: z.enum(["WAITING", "CALLED", "IN_CONSULTATION", "DONE", "SKIPPED"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticateApiRequest(request);
    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_STATUS_TRANSITION", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await transitionQueueStatus(id, parsed.data.status as OpdQueueStatus, user);
    return NextResponse.json({
      success: true,
      queueEntry: updated,
    });
  } catch (err: any) {
    console.error("POST /api/opd/queue/[id]/transition error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update queue status" },
      { status: 500 }
    );
  }
}
