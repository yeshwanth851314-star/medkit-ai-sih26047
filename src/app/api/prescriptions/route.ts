import { NextResponse } from "next/server";
import {
  listPrescriptions,
  createDraftPrescription,
} from "@/features/prescriptions/prescription-service";
import { authenticateApiRequest } from "@/lib/auth/api-guard";
import { PrescriptionStatus } from "@/types/ecosystem";
import { z } from "zod";

const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  caseId: z.string().uuid(),
  facilityId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      medicineName: z.string().min(1),
      genericName: z.string().optional().nullable(),
      strength: z.string().optional().nullable(),
      route: z.string().optional(),
      dose: z.string().min(1),
      frequency: z.string().min(1),
      duration: z.string().min(1),
      quantity: z.number().int().positive().optional(),
      instructions: z.string().optional().nullable(),
    })
  ).min(1),
});

export async function GET(request: Request) {
  try {
    const user = await authenticateApiRequest(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId") || undefined;
    const caseId = searchParams.get("caseId") || undefined;
    const facilityId = searchParams.get("facilityId") || user?.facilityId || undefined;
    const status = (searchParams.get("status") as PrescriptionStatus) || undefined;

    // Pharmacists can ONLY see final/dispensed prescriptions
    const onlyFinalOrDispensed = user?.role === "pharmacist";

    const prescriptions = await listPrescriptions(
      { patientId, caseId, facilityId, status, onlyFinalOrDispensed },
      user
    );

    return NextResponse.json({ prescriptions });
  } catch (err: any) {
    console.error("GET /api/prescriptions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch prescriptions" },
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
        { error: "FORBIDDEN: Only licensed clinicians may author prescriptions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createPrescriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const prescription = await createDraftPrescription(
      {
        ...parsed.data,
        prescriberId: user.id,
      },
      user
    );

    return NextResponse.json({
      success: true,
      prescription,
    });
  } catch (err: any) {
    console.error("POST /api/prescriptions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create draft prescription" },
      { status: 500 }
    );
  }
}
