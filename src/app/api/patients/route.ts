import { NextResponse } from "next/server";
import { searchPatients, registerPatient } from "@/features/patients/patient-service";
import { patientRegistrationSchema } from "@/features/patients/types";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("search") || undefined;
    const patients = await searchPatients(q);
    return NextResponse.json({ patients });
  } catch (err) {
    console.error("GET /api/patients error:", err);
    return NextResponse.json({ error: "Failed to retrieve patients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const validated = patientRegistrationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const ignoreDuplicate = Boolean(body.ignoreDuplicateWarning);
    const result = await registerPatient(validated.data, { ignoreDuplicateWarning: ignoreDuplicate });

    if (result.duplicateWarning && !ignoreDuplicate) {
      return NextResponse.json(
        {
          warning: "Duplicate patient suspect detected.",
          duplicateWarning: result.duplicateWarning,
        },
        { status: 409 }
      );
    }

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CREATE_PATIENT",
      resourceType: "patients",
      resourceId: result.patient.id,
      metadata: { patient_code: result.patient.patient_code },
    });

    return NextResponse.json({ success: true, patient: result.patient }, { status: 201 });
  } catch (err) {
    console.error("POST /api/patients error:", err);
    return NextResponse.json({ error: "Failed to register patient" }, { status: 500 });
  }
}
