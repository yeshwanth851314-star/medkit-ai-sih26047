import { NextResponse } from "next/server";
import { searchPatients, registerPatient, checkDuplicatePatient } from "@/features/patients/patient-service";
import { patientRegistrationSchema } from "@/features/patients/types";

export async function GET(request: Request) {
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
  try {
    const body = await request.json();
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

    return NextResponse.json({ success: true, patient: result.patient }, { status: 201 });
  } catch (err) {
    console.error("POST /api/patients error:", err);
    return NextResponse.json({ error: "Failed to register patient" }, { status: 500 });
  }
}
