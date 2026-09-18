import { NextResponse } from "next/server";
import { dispensePrescription } from "@/features/pharmacy/pharmacy-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { z } from "zod";

const dispenseSchema = z.object({
  prescriptionId: z.string().uuid(),
  facilityId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      prescriptionItemId: z.string().uuid(),
      quantityDispensed: z.number().int().positive(),
      batchNumber: z.string().optional().nullable(),
      expiryDate: z.string().optional().nullable(),
    })
  ).min(1),
});

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);

    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!["pharmacist", "admin", "doctor", "clinician"].includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only authorized pharmacists may record medication dispense" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = dispenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await dispensePrescription(
      {
        ...parsed.data,
        dispensedBy: user.fullName || user.id,
      },
      user
    );

    return NextResponse.json({
      success: true,
      dispenseEvent: result.dispenseEvent,
      prescription: result.prescription,
    });
  } catch (err: any) {
    console.error("POST /api/pharmacy/dispense error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to dispense medication" },
      { status: 500 }
    );
  }
}
