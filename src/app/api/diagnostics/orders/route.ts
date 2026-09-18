import { NextResponse } from "next/server";
import {
  listDiagnosticOrders,
  orderDiagnosticInvestigation,
} from "@/features/diagnostics/diagnostic-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { DiagnosticOrderStatus, DiagnosticPriority } from "@/types/ecosystem";
import { z } from "zod";

const createOrderSchema = z.object({
  patientId: z.string().uuid(),
  caseId: z.string().uuid(),
  facilityId: z.string().min(1),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).optional(),
  clinicalContext: z.string().optional().nullable(),
  items: z.array(
    z.object({
      catalogId: z.string().optional(),
      testName: z.string().min(1),
      testCode: z.string().min(1),
      instructions: z.string().optional().nullable(),
    })
  ).min(1),
});

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId") || user?.facilityId || undefined;
    const patientId = searchParams.get("patientId") || undefined;
    const caseId = searchParams.get("caseId") || undefined;
    const status = (searchParams.get("status") as DiagnosticOrderStatus) || undefined;

    const orders = await listDiagnosticOrders({ facilityId, patientId, caseId, status }, user);
    return NextResponse.json({ orders });
  } catch (err: any) {
    console.error("GET /api/diagnostics/orders error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch diagnostic orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!["doctor", "clinician", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only authorized clinicians may order diagnostic investigations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const order = await orderDiagnosticInvestigation(
      {
        ...parsed.data,
        orderingClinicianId: user.id,
        priority: parsed.data.priority as DiagnosticPriority,
      },
      user
    );

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error("POST /api/diagnostics/orders error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create diagnostic order" },
      { status: 500 }
    );
  }
}
