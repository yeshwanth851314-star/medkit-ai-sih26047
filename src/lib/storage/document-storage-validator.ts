/**
 * MedKit AI — Canonical Document Storage Validator
 * 
 * Enforces canonical path structure, prevents path traversal / injection,
 * and binds storage paths to patient / case contexts before metadata registration.
 */

export interface ValidatedStoragePath {
  normalizedPath: string;
  cleanRelativePath: string;
  patientId: string;
  caseId: string | null;
  docId: string | null;
  fileName: string;
}

export function validateCanonicalStoragePath(
  rawPath: string,
  expectedPatientId?: string
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
  const caseMatch = cleanRelative.match(/\/cases\/([a-zA-Z0-9_-]+)/);
  if (caseMatch && caseMatch[1] !== "uncategorized") {
    caseId = caseMatch[1];
  }

  const segments = cleanRelative.split("/");
  const fileName = segments[segments.length - 1];
  const docId = segments.length >= 3 ? segments[segments.length - 2] : null;

  return {
    normalizedPath: normalized.startsWith("/") ? normalized : "/" + normalized,
    cleanRelativePath: cleanRelative,
    patientId: pathPatientId,
    caseId,
    docId,
    fileName,
  };
}
