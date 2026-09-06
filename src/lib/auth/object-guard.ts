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
  const patient = await getPatientById(patientId);
  if (!patient) {
    return {
      authorized: false,
      errorResponse: NextResponse.json({ error: "Patient record not found" }, { status: 404 }),
    };
  }

  // Facility-level boundary check: if both user and patient have facilityId, they must match
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
  const clinicalCase = await getCaseById(caseId);
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
  const doc = await getDocumentById(documentId);
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
  patientId: string
): Promise<ObjectGuardResult<ClinicalCase>> {
  const clinicalCase = await getCaseById(caseId);
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
