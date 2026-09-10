/**
 * MedKit AI — Canonical Document Storage Validator
 *
 * Enforces one exact application-level document path contract and provides a
 * deterministic conversion to the Supabase Storage bucket-relative object name.
 */

const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID_RE = new RegExp(`^${UUID_PATTERN}$`);
const SAFE_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ValidatedStoragePath {
  canonicalPath: string;
  bucketRelativePath: string;
  normalizedPath: string;
  cleanRelativePath: string;
  patientId: string;
  caseId: string | null;
  caseSegment: string;
  docId: string;
  fileName: string;
}

function rejectUnsafeRawPath(trimmed: string): void {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    throw new Error("STORAGE_PATH_INVALID: Protocol schemes are forbidden in storage paths");
  }
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("STORAGE_PATH_INVALID: Query strings or URL fragments are forbidden in storage paths");
  }
  if (/\p{Cc}/u.test(trimmed)) {
    throw new Error("STORAGE_PATH_INVALID: Control characters are forbidden in storage paths");
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    /%2e/i.test(trimmed) ||
    /%2f/i.test(trimmed) ||
    /%5c/i.test(trimmed)
  ) {
    throw new Error("STORAGE_PATH_TRAVERSAL: Encoded or raw traversal sequences are forbidden");
  }
  if (trimmed.includes("//")) {
    throw new Error("STORAGE_PATH_INVALID: Duplicate path separators are forbidden");
  }
  if (trimmed.startsWith("offline-sync/") || trimmed.includes("/offline-sync/")) {
    throw new Error("STORAGE_PATH_REQUIRED: Fake offline-sync placeholder paths are prohibited");
  }
}

export function toBucketRelativePath(path: string): string {
  if (!path || typeof path !== "string") return "";
  const trimmed = path.trim();
  if (trimmed.startsWith("/private/documents/")) {
    return trimmed.slice("/private/documents/".length);
  }
  if (trimmed.startsWith("private/documents/")) {
    return trimmed.slice("private/documents/".length);
  }
  return trimmed.replace(/^\/+/, "");
}

export function toCanonicalStoragePath(path: string): string {
  const bucketRelative = toBucketRelativePath(path);
  return `/private/documents/${bucketRelative}`;
}

export function validateCanonicalStoragePath(
  rawPath: string,
  expectedPatientId?: string,
  expectedCaseId?: string | null
): ValidatedStoragePath {
  if (!rawPath || typeof rawPath !== "string") {
    throw new Error("STORAGE_PATH_REQUIRED: Storage path is missing or invalid");
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new Error("STORAGE_PATH_REQUIRED: Storage path cannot be empty");
  }
  rejectUnsafeRawPath(trimmed);

  const bucketRelative = toBucketRelativePath(trimmed);
  const segments = bucketRelative.split("/");

  // Exact contract:
  // patients/{patientUuid}/cases/{caseUuid|uncategorized}/{documentUuid}/{safeFileName}
  if (segments.length !== 6 || segments[0] !== "patients" || segments[2] !== "cases") {
    throw new Error(
      "STORAGE_PATH_INVALID: Path must exactly match patients/{patientId}/cases/{caseId|uncategorized}/{documentId}/{filename}"
    );
  }

  const [, patientId, , caseSegment, docId, fileName] = segments;

  if (!UUID_RE.test(patientId)) {
    throw new Error("STORAGE_PATH_INVALID: Patient path segment must be a valid UUID");
  }
  if (caseSegment !== "uncategorized" && !UUID_RE.test(caseSegment)) {
    throw new Error("STORAGE_PATH_INVALID: Case path segment must be a valid UUID or 'uncategorized'");
  }
  if (!UUID_RE.test(docId)) {
    throw new Error("STORAGE_PATH_INVALID: Document path segment must be a valid UUID");
  }
  if (!fileName || !SAFE_FILENAME_RE.test(fileName) || fileName === "." || fileName === "..") {
    throw new Error("STORAGE_PATH_INVALID: Filename contains unsupported characters");
  }

  if (expectedPatientId && patientId !== expectedPatientId) {
    throw new Error(
      `STORAGE_PATH_PATIENT_MISMATCH: Path patient '${patientId}' does not match document patient '${expectedPatientId}'`
    );
  }

  const caseId = caseSegment === "uncategorized" ? null : caseSegment;
  if (expectedCaseId !== undefined) {
    if (expectedCaseId && caseId !== expectedCaseId) {
      throw new Error(
        `STORAGE_PATH_CASE_MISMATCH: Storage path case '${caseSegment}' does not match expected case '${expectedCaseId}'`
      );
    }
    if (!expectedCaseId && caseId !== null) {
      throw new Error(
        `STORAGE_PATH_CASE_MISMATCH: Unassociated document must use 'uncategorized', found '${caseSegment}'`
      );
    }
  }

  const canonicalPath = `/private/documents/${bucketRelative}`;
  return {
    canonicalPath,
    bucketRelativePath: bucketRelative,
    normalizedPath: canonicalPath,
    cleanRelativePath: bucketRelative,
    patientId,
    caseId,
    caseSegment,
    docId,
    fileName,
  };
}
