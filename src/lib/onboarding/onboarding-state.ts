/**
 * MedKit AI — Lightweight Client Onboarding State Utilities
 * User-scoped and session-scoped preferences without backend dependencies.
 */

export const DOCTOR_ONBOARDING_KEY_PREFIX = "medkit_doctor_onboarding_completed";
export const DOCTOR_ONBOARDING_KEY = DOCTOR_ONBOARDING_KEY_PREFIX;
export const KIOSK_ONBOARDING_KEY = "medkit_kiosk_onboarding_completed";
export const REPLAY_TOUR_EVENT = "medkit:replay-doctor-tour";

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const testKey = "__medkit_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function isSessionStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    const testKey = "__medkit_kiosk_test__";
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getDoctorStorageKey(doctorId?: string): string {
  return doctorId ? `${DOCTOR_ONBOARDING_KEY_PREFIX}:${doctorId}` : DOCTOR_ONBOARDING_KEY_PREFIX;
}

/**
 * Doctor Onboarding State (Scoped per clinician/doctor ID)
 */
export function hasCompletedDoctorOnboarding(doctorId?: string): boolean {
  if (!isLocalStorageAvailable()) return true; // Fail gracefully to completed if localStorage is unavailable
  try {
    const key = getDoctorStorageKey(doctorId);
    const val = window.localStorage.getItem(key);
    if (val === "true") return true;
    if (!doctorId) {
      return window.localStorage.getItem(DOCTOR_ONBOARDING_KEY_PREFIX) === "true";
    }
    return false;
  } catch {
    return true;
  }
}

export function completeDoctorOnboarding(doctorId?: string): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const key = getDoctorStorageKey(doctorId);
    window.localStorage.setItem(key, "true");
    if (!doctorId) {
      window.localStorage.setItem(DOCTOR_ONBOARDING_KEY_PREFIX, "true");
    }
  } catch (err) {
    console.warn("Failed to persist doctor onboarding completion", err);
  }
}

export function resetDoctorOnboarding(doctorId?: string): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const key = getDoctorStorageKey(doctorId);
    window.localStorage.removeItem(key);
    if (!doctorId) {
      window.localStorage.removeItem(DOCTOR_ONBOARDING_KEY_PREFIX);
    }
  } catch (err) {
    console.warn("Failed to reset doctor onboarding", err);
  }
}

/**
 * Patient Kiosk Onboarding State (Session-scoped for privacy and multi-patient kiosk turns)
 */
export function hasCompletedKioskOnboarding(): boolean {
  if (isSessionStorageAvailable()) {
    try {
      return window.sessionStorage.getItem(KIOSK_ONBOARDING_KEY) === "true";
    } catch {
      return false;
    }
  }
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(KIOSK_ONBOARDING_KEY) === "true";
    } catch {
      return false;
    }
  }
  return false;
}

export function completeKioskOnboarding(): void {
  if (isSessionStorageAvailable()) {
    try {
      window.sessionStorage.setItem(KIOSK_ONBOARDING_KEY, "true");
    } catch (err) {
      console.warn("Failed to persist kiosk onboarding completion", err);
    }
  }
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(KIOSK_ONBOARDING_KEY, "true");
    } catch {}
  }
}

export function resetKioskOnboarding(): void {
  if (isSessionStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(KIOSK_ONBOARDING_KEY);
    } catch (err) {
      console.warn("Failed to reset kiosk onboarding", err);
    }
  }
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(KIOSK_ONBOARDING_KEY);
    } catch {}
  }
}

/**
 * Event-based Replay Trigger for Doctor Quick Tour
 */
export function triggerDoctorTourReplay(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REPLAY_TOUR_EVENT));
}
