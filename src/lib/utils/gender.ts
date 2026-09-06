export type CanonicalGender = "Male" | "Female" | "Other" | "Unknown";
export type DatabaseGender = "male" | "female" | "other" | "unknown";

/**
 * Maps domain/UI gender to the database canonical check-constraint representation.
 */
export function genderToDb(gender?: string | null): DatabaseGender {
  if (!gender) return "unknown";
  const normalized = gender.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  if (normalized === "other" || normalized === "o") return "other";
  return "unknown";
}

/**
 * Maps database gender to standard clinical domain presentation representation.
 */
export function genderFromDb(gender?: string | null): CanonicalGender {
  if (!gender) return "Unknown";
  const normalized = gender.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "other") return "Other";
  return "Unknown";
}
