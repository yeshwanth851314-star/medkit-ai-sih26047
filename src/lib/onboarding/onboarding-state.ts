/**
 * MedKit AI — Lightweight Client Onboarding State Utilities
 * Pure client-side preferences stored in localStorage without backend dependencies.
 */

export const DOCTOR_ONBOARDING_KEY = "medkit_doctor_onboarding_completed";
export const KIOSK_ONBOARDING_KEY = "medkit_kiosk_onboarding_completed";
export const REPLAY_TOUR_EVENT = "medkit:replay-doctor-tour";

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__medkit_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Doctor Onboarding State
 */
export function hasCompletedDoctorOnboarding(): boolean {
  if (!isLocalStorageAvailable()) return true; // Fail gracefully to completed if localStorage is unavailable
  try {
    return window.localStorage.getItem(DOCTOR_ONBOARDING_KEY) === "true";
  } catch {
    return true;
  }
}

export function completeDoctorOnboarding(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(DOCTOR_ONBOARDING_KEY, "true");
  } catch (err) {
    console.warn("Failed to persist doctor onboarding completion", err);
  }
}

export function resetDoctorOnboarding(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(DOCTOR_ONBOARDING_KEY);
  } catch (err) {
    console.warn("Failed to reset doctor onboarding", err);
  }
}

/**
 * Patient Kiosk Onboarding State
 */
export function hasCompletedKioskOnboarding(): boolean {
  if (!isLocalStorageAvailable()) return true;
  try {
    return window.localStorage.getItem(KIOSK_ONBOARDING_KEY) === "true";
  } catch {
    return true;
  }
}

export function completeKioskOnboarding(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(KIOSK_ONBOARDING_KEY, "true");
  } catch (err) {
    console.warn("Failed to persist kiosk onboarding completion", err);
  }
}

export function resetKioskOnboarding(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(KIOSK_ONBOARDING_KEY);
  } catch (err) {
    console.warn("Failed to reset kiosk onboarding", err);
  }
}

/**
 * Event-based Replay Trigger for Doctor Quick Tour
 */
export function triggerDoctorTourReplay(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REPLAY_TOUR_EVENT));
}
