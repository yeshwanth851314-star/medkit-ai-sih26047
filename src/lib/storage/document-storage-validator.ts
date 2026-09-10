/**
 * MedKit AI — Canonical Document Storage Validator
 * 
 * Enforces canonical path structure, prevents path traversal / injection,
 * and binds storage paths to patient / case contexts before metadata registration.
 */

export interface ValidatedStoragePath {
  canonicalPath: string;
  bucketRelativePath: string;
  normalizedPath: string;
  cleanRelativePath: string;
  patientId: string;
  caseId: string | null;
  caseSegment: string;
  docId: string | null;
  fileName: string;
}

export function toBucketRelativePath(path: string): string {
  if (!path || typeof path !== "string") return "";
  return path.trim().replace(/\/+/g, "/").replace(/^\/?(private\/documents\/)?/, "").replace(/^\/+/, "");
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

  // Reject URL schemes (e.g. http://, https://, file://, ftp://)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    throw new Error("STORAGE_PATH_INVALID: Protocol schemes (e.g. http://, file://) are forbidden in storage paths");
  }

  // Reject query strings or URL fragments
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("STORAGE_PATH_INVALID: Query strings or URL fragments are forbidden in storage paths");
  }

  // Reject path traversal attempts (raw and URL-encoded)
  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    /%2e/i.test(trimmed) ||
    /%2f/i.test(trimmed) ||
    /%5c/i.test(trimmed)
  ) {
    throw new Error("STORAGE_PATH_TRAVERSAL: Path traversal sequences (e.g. '..', '\\', '%2e') are strictly forbidden");
  }

  // Reject fake offline paths
  if (trimmed.startsWith("offline-sync/") || trimmed.includes("/offline-sync/")) {
    throw new Error("STORAGE_PATH_REQUIRED: Fake offline-sync placeholder paths are strictly prohibited");
  }

  // Normalize: collapse consecutive slashes
  const normalized = trimmed.replace(/\/+/g, "/");

  // Strip optional /private/documents/ prefix to get path relative to 'clinical-documents' bucket
  const cleanRelative = normalized.replace(/^\/?(private\/documents\/)?/, "").replace(/^\/+/, "");

  if (!cleanRelative) {
    throw new Error("STORAGE_PATH_REQUIRED: Storage path resolves to empty relative path");
  }

  // Match canonical structure: patients/{patientId}/cases/{caseFolder}/{docId}/{safeFileName} or patients/{patientId}/...
  const patientMatch = cleanRelative.match(/^patients\/([a-zA-Z0-9_-]+)/);
  if (!patientMatch) {
    throw new Error("STORAGE_PATH_INVALID: Path must follow canonical structure starting with patients/{patientId}");
  }

  const pathPatientId = patientMatch[1];
  if (expectedPatientId && pathPatientId !== expectedPatientId) {
    throw new Error(`STORAGE_PATH_PATIENT_MISMATCH: Path patient '${pathPatientId}' does not match document patient '${expectedPatientId}'`);
  }

  let caseId: string | null = null;
  let caseSegment = "uncategorized";
  const caseMatch = cleanRelative.match(/\/cases\/([a-zA-Z0-9_-]+)/);
  if (caseMatch) {
    caseSegment = caseMatch[1];
    if (caseMatch[1] !== "uncategorized") {
      caseId = caseMatch[1];
    }
  }

  if (expectedCaseId !== undefined) {
    if (expectedCaseId) {
      if (!caseSegment || caseSegment !== expectedCaseId) {
        throw new Error(
          `STORAGE_PATH_CASE_MISMATCH: Storage path case '${caseSegment || "missing"}' does not match expected case '${expectedCaseId}'`
        );
      }
    } else {
      if (caseSegment && caseSegment !== "uncategorized") {
        throw new Error(
          `STORAGE_PATH_CASE_MISMATCH: Unassociated document must use 'uncategorized' case path segment, found '${caseSegment}'`
        );
      }
    }
  }

  const segments = cleanRelative.split("/");
  const fileName = segments[segments.length - 1];
  const docId = segments.length >= 3 ? segments[segments.length - 2] : null;
  const canonicalPath = `/private/documents/${cleanRelative}`;

  return {
    canonicalPath,
    bucketRelativePath: cleanRelative,
    normalizedPath: normalized.startsWith("/") ? normalized : "/" + normalized,
    cleanRelativePath: cleanRelative,
    patientId: pathPatientId,
    caseId,
    caseSegment,
    docId,
    fileName,
  };
}
