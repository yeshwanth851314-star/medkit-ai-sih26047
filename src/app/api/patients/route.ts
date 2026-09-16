import { NextResponse } from "next/server";
import { searchPatients, getPatientsPage, registerPatient } from "@/features/patients/patient-service";
import { patientRegistrationSchema } from "@/features/patients/types";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "admin", "staff"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  // Unassigned clinicians (non-admin) cannot query patient records
  if (auth.user.role !== "admin" && !auth.user.facilityId) {
    return NextResponse.json(
      { error: "Access denied: Clinician must be assigned to an active facility to access patient records" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("search") || undefined;

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    const parsedPage = pageParam ? parseInt(pageParam, 10) : 1;
    const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

    const parsedPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 25;
    const pageSize = Number.isInteger(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(parsedPageSize, 100)
      : 25;

    const pageResult = await getPatientsPage(
      {
        searchQuery: q,
        page,
        pageSize,
      },
      auth.user
    );

    let patients = pageResult.patients;
    if (auth.user.role !== "admin" && auth.user.facilityId) {
      patients = patients.filter((p) => p.facility_id === auth.user.facilityId);
    }

    return NextResponse.json({
      patients,
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      total: pageResult.total,
      totalPages: pageResult.totalPages,
    });
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

  // Unassigned clinicians (non-admin) cannot register patient records
  if (auth.user.role !== "admin" && !auth.user.facilityId) {
    return NextResponse.json(
      { error: "Access denied: Clinician must be assigned to an active facility to register patients" },
      { status: 403 }
    );
  }

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
    const result = await registerPatient(validated.data, {
      ignoreDuplicateWarning: ignoreDuplicate,
      facilityId: auth.user.facilityId || undefined,
      actor: auth.user,
    });

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
      metadata: { patient_code: result.patient.patient_code, facility_id: auth.user.facilityId },
    });

    return NextResponse.json({ success: true, patient: result.patient }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/patients error:", err);
    if (err.message && err.message.includes("IDENTIFIER_CONFLICT")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || "Failed to register patient" }, { status: 500 });
  }
}
