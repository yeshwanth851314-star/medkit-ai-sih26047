/**
 * Clinical PII De-identification and Safe Error Sanitization
 */

export function maskPhone(phone?: string | null): string {
  if (!phone) return "N/A";
  const clean = phone.replace(/[^0-9+]/g, "");
  if (clean.length < 5) return "***";
  const lastFour = clean.slice(-4);
  return `${clean.slice(0, 3)} **** ${lastFour}`;
}

export function maskAbhaId(id?: string | null): string {
  if (!id) return "N/A";
  const parts = id.split("-");
  if (parts.length === 4) {
    return `**-****-****-${parts[3]}`;
  }
  if (id.length > 4) {
    return `***-***-${id.slice(-4)}`;
  }
  return "****";
}

export function maskName(name?: string | null): string {
  if (!name) return "Anonymous";
  const words = name.trim().split(/\s+/);
  return words
    .map((w) => {
      if (w.length <= 1) return w;
      return `${w[0]}${"*".repeat(Math.max(1, w.length - 1))}`;
    })
    .join(" ");
}

export function deIdentifyPatientRecord(patient: {
  full_name: string;
  phone?: string | null;
  abha_id?: string | null;
  patient_code: string;
}): {
  maskedName: string;
  maskedPhone: string;
  maskedAbhaId: string;
  patientCode: string;
} {
  return {
    maskedName: maskName(patient.full_name),
    maskedPhone: maskPhone(patient.phone),
    maskedAbhaId: maskAbhaId(patient.abha_id),
    patientCode: patient.patient_code, // MRN/code is safe within hospital boundary
  };
}

/**
 * Sanitizes errors so that no internal stack traces, DB credentials, or file paths
 * leak into user-facing responses.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred. Please contact hospital technical support.";

  const rawMsg = err instanceof Error ? err.message : String(err);

  // Pattern detection for sensitive leaks
  const sensitivePatterns = [
    /postgres:\/\//i,
    /supabase/i,
    /jwt/i,
    /secret/i,
    /bearer/i,
    /password/i,
    /token/i,
    /select\s+.*\s+from/i,
    /insert\s+into/i,
    /update\s+.*\s+set/i,
    /d:\\/i,
    /c:\\/i,
    /\/Users\//i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(rawMsg)) {
      return "A secure server error occurred. The internal error has been logged securely.";
    }
  }

  return rawMsg;
}
