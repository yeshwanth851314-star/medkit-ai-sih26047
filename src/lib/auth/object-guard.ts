import { NextResponse } from "next/server";
import { AuthUser } from "@/features/auth/types";
import { UserRole, Patient, ClinicalCase, MedicalDocument } from "@/types/database";
import { getPatientById, getCaseById, getDocumentById } from "@/lib/db/supabase";
import { authenticateApiRequest } from "./api-guard";

export type ObjectGuardResult<T = any> =
  | { authorized: true; data: T; errorResponse?: never }
  | { authorized: false; data?: never; errorResponse: NextResponse };

/**
 * 1. requireSession: Verifies valid authentication session on incoming API request
 */
export async function requireSession(request: Request): Promise<ObjectGuardResult<AuthUser>> {
  const user = await authenticateApiRequest(request);
  if (!user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED: Missing or invalid clinical authentication session" },
        { status: 401 }
      ),
    };
  }
  return { authorized: true, data: user };
}

/**
 * 2. requireClinicalRole: Enforces role-based permissions
 */
export function requireClinicalRole(
  user: AuthUser,
  allowedRoles: UserRole[] = ["doctor", "clinician"]
): ObjectGuardResult<AuthUser> {
  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: `FORBIDDEN: Role '${user.role}' is not authorized for this clinical operation` },
        { status: 403 }
      ),
    };
  }
  return { authorized: true, data: user };
}

/**
 * 3. requirePatientAccess: Ensures user has facility/clinical access to target patient
 */
export async function requirePatientAccess(
  user: AuthUser,
  patientId: string
): Promise<ObjectGuardResult<Patient>> {
  if (!patientId || typeof patientId !== "string" || patientId.trim().length === 0) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Invalid or missing patient identifier" }, { status: 400 }),
    };
  }

  const patient = await getPatientById(patientId, user);
  if (!patient) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Patient record not found" }, { status: 404 }),
    };
  }

  // Strict facility-level boundary check:
  // Unassigned legacy patient records require administrative reconciliation
  if (!patient.facility_id && user.role !== "admin") {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "FORBIDDEN: Unassigned legacy patient record requires administrative reconciliation" },
        { status: 403 }
      ),
    };
  }

  // Clinician without facility assignment cannot access facility records unless administrator
  if (!user.facilityId && user.role !== "admin") {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "FORBIDDEN: Clinician has no facility assignment" },
        { status: 403 }
      ),
    };
  }

  // Facility-level boundary check: clinician and patient facilities must match
  if (user.facilityId && patient.facility_id && user.facilityId !== patient.facility_id) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "FORBIDDEN: You do not have clinical access to patients outside your facility" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, data: patient };
}

/**
 * 4. requireCaseAccess: Ensures user has clinical access to target case and its parent patient
 */
export async function requireCaseAccess(
  user: AuthUser,
  caseId: string
): Promise<ObjectGuardResult<ClinicalCase>> {
  if (!caseId || typeof caseId !== "string" || caseId.trim().length === 0) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Invalid or missing case identifier" }, { status: 400 }),
    };
  }

  const clinicalCase = await getCaseById(caseId, user);
  if (!clinicalCase) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Clinical case not found" }, { status: 404 }),
    };
  }

  // Verify access to the parent patient
  const patientAccess = await requirePatientAccess(user, clinicalCase.patient_id);
  if (!patientAccess.authorized) {
    return { authorized: false, errorResponse: patientAccess.errorResponse };
  }

  return { authorized: true, data: clinicalCase };
}

/**
 * 5. requireDocumentAccess: Ensures user has clinical access to target document and its parent patient
 */
export async function requireDocumentAccess(
  user: AuthUser,
  documentId: string
): Promise<ObjectGuardResult<MedicalDocument>> {
  if (!documentId || typeof documentId !== "string" || documentId.trim().length === 0) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Invalid or missing document identifier" }, { status: 400 }),
    };
  }

  const doc = await getDocumentById(documentId, user);
  if (!doc) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Clinical document not found" }, { status: 404 }),
    };
  }

  const patientAccess = await requirePatientAccess(user, doc.patient_id);
  if (!patientAccess.authorized) {
    return { authorized: false, errorResponse: patientAccess.errorResponse };
  }

  return { authorized: true, data: doc };
}

/**
 * 6. requireCaseBelongsToPatient: Prevents cross-patient case association tampering
 */
export async function requireCaseBelongsToPatient(
  caseId: string,
  patientId: string,
  actorOrToken?: AuthUser | string | null
): Promise<ObjectGuardResult<ClinicalCase>> {
  const clinicalCase = await getCaseById(caseId, actorOrToken);
  if (!clinicalCase) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Clinical case not found" }, { status: 404 }),
    };
  }

  if (clinicalCase.patient_id !== patientId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "CONFLICT: Clinical case does not belong to the specified patient" },
        { status: 400 }
      ),
    };
  }

  return { authorized: true, data: clinicalCase };
}
