import crypto from "crypto";

/**
 * Deterministically sorts all object keys recursively to produce a canonical
 * representation of any JSON-serializable mutation payload.
 */
export function canonicalizeMutationPayload(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeMutationPayload);
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = canonicalizeMutationPayload(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Computes a deterministic SHA-256 fingerprint of a mutation payload.
 * Used to detect and reject idempotency key payload mismatches across
 * distributed workers and offline replay scenarios.
 */
export function computePayloadHash(payload: any): string {
  const canonical = canonicalizeMutationPayload(payload ?? {});
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}
