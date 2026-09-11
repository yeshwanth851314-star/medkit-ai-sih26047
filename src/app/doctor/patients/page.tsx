"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Users,
  ArrowRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { Patient } from "@/types/database";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function PatientsHubPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Male");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("Unknown");
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for accessibility & request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const registerButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalFirstInputRef = useRef<HTMLInputElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Load patients with AbortController to cancel previous in-flight requests
  const fetchPatients = useCallback(async (query = "") => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // If we already have patients, keep them and show subtle searching indicator
    setIsSearching(true);

    try {
      const url = query ? `/api/patients?search=${encodeURIComponent(query)}` : "/api/patients";
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to fetch patients");
      const data = await res.json();
      setPatients(data.patients || []);
      setCurrentPage(1); // Reset to page 1 on new query
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Failed to load patients", err);
      }
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchPatients]);

  // Modal accessibility: focus management & Escape key handling
  useEffect(() => {
    if (isRegisterOpen) {
      setTimeout(() => {
        modalFirstInputRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsRegisterOpen(false);
          registerButtonRef.current?.focus();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    } else {
      registerButtonRef.current?.focus();
    }
  }, [isRegisterOpen]);

  const handleRegisterSubmit = async (e?: React.FormEvent, force = false) => {
    if (e) e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        fullName,
        dateOfBirth: dateOfBirth || null,
        gender,
        phone: phone || null,
        address: address || null,
        bloodGroup,
        ignoreDuplicateWarning: force,
      };

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 && data.duplicateWarning) {
        setDuplicateWarning(data.duplicateWarning);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        setFormError(data.error || "Failed to register patient");
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsRegisterOpen(false);
      setDuplicateWarning(null);
      setFullName("");
      setDateOfBirth("");
      setPhone("");
      setAddress("");
      fetchPatients(searchQuery);
    } catch {
      setFormError("Network error submitting patient registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pagination slicing
  const totalCount = patients.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedPatients = patients.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-clinical-600" aria-hidden="true" />
            Patient Records &amp; Directory
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Search existing clinical records by Patient Code, Full Name, or Phone Number
          </p>
        </div>

        <button
          ref={registerButtonRef}
          type="button"
          onClick={() => {
            setIsRegisterOpen(true);
            setDuplicateWarning(null);
            setFormError(null);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:ring-offset-2 transition-colors"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-6">
        <div className="relative max-w-lg">
          <label htmlFor="patient-search-input" className="sr-only">
            Search patients by code, name, or phone
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin text-clinical-600" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <input
            id="patient-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code (e.g. MED-2026-0001), name, or phone..."
            className="block w-full min-h-[44px] rounded-xl border border-surface-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Search Status & Record Counts */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div>
          {totalCount > 0 ? (
            <span>
              Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span>–
              <span className="font-semibold text-slate-900">{Math.min(startIndex + PAGE_SIZE, totalCount)}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalCount}</span> registered patients
            </span>
          ) : !isLoading ? (
            <span>0 patients found</span>
          ) : null}
        </div>
        {isSearching && (
          <div className="flex items-center gap-1.5 text-clinical-600 font-medium" role="status">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Updating results...</span>
          </div>
        )}
      </div>

      {/* Patients Table / List */}
      <div className="mt-3">
        {isLoading && patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-clinical-600 mb-2" />
            <span className="text-xs">Loading patient registry...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-xl border border-surface-200 bg-white p-12 text-center shadow-sm">
            <Users className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-semibold text-slate-900">No matching patients found</h2>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search terms or register this patient as a new clinical record.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200 text-left">
                <caption className="sr-only">List of registered patients with contact information and actions</caption>
                <thead className="bg-surface-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 sm:pl-6">Patient Identifier</th>
                    <th scope="col" className="px-3 py-3.5">Full Name</th>
                    <th scope="col" className="px-3 py-3.5">Gender / Age</th>
                    <th scope="col" className="px-3 py-3.5">Contact</th>
                    <th scope="col" className="px-3 py-3.5">Blood Group</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 bg-white text-sm">
                  {paginatedPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6 font-mono text-xs font-semibold text-clinical-700">
                        {patient.patient_code}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 font-medium text-slate-900">
                        {patient.full_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-600">
                        {patient.gender} • {patient.date_of_birth ? formatDate(patient.date_of_birth) : "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-600">
                        {patient.phone || "No phone listed"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs">
                        {patient.blood_group ? (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                            {patient.blood_group}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 sm:pr-6 text-right text-xs font-medium">
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2.5 py-1 text-clinical-600 hover:text-clinical-800 hover:bg-clinical-50 font-semibold focus:outline-none focus:ring-2 focus:ring-clinical-500"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3 sm:px-6 bg-surface-50/50">
                <div className="text-xs text-slate-600">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-clinical-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-clinical-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accessible Registration Modal Dialog */}
      {isRegisterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-patient-title"
          aria-describedby="register-patient-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        >
          <div
            ref={modalContainerRef}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto focus:outline-none"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="register-patient-title" className="text-lg font-bold text-slate-900">
                  Register New Clinical Patient
                </h2>
                <p id="register-patient-desc" className="text-xs text-slate-500 mt-0.5">
                  Generates a permanent clinical code and records intake consent
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-surface-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            {/* Duplicate Warning Dialog */}
            {duplicateWarning && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  Possible Duplicate Record Detected
                </div>
                <p>
                  A patient with matching contact information already exists:
                  <br />
                  <strong>{duplicateWarning.matchedName}</strong> (Code: <code>{duplicateWarning.matchedPatientCode}</code>)
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Link
                    href={`/doctor/patients/${duplicateWarning.matchedPatientId}`}
                    className="rounded-md bg-white border border-amber-300 px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    View Existing Patient
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRegisterSubmit(undefined, true)}
                    className="rounded-md bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                  >
                    Register as Distinct Patient
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={modalFirstInputRef}
                  id="reg-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Venkat Ramanujam"
                  className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-dob" className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    id="reg-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-gender" className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    id="reg-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Unknown">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-98765-43210"
                    className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-blood" className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    id="reg-blood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                  >
                    <option value="Unknown">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-address" className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential Address
                </label>
                <input
                  id="reg-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, District, State"
                  className="block w-full min-h-[44px] rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-2 focus:ring-clinical-600/20 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="min-h-[44px] rounded-lg border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-lg bg-clinical-600 px-5 py-2 text-sm font-semibold text-white hover:bg-clinical-700 focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isSubmitting ? "Creating Record..." : "Confirm & Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
