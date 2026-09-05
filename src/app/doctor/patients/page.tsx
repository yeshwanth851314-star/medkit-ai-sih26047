"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, UserPlus, Users, ArrowRight, Phone, Calendar, AlertTriangle, Check, ShieldCheck, Heart } from "lucide-react";
import { Patient } from "@/types/database";
import { formatDate } from "@/lib/utils";

export default function PatientsHubPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Load patients
  const fetchPatients = async (query = "") => {
    setIsLoading(true);
    try {
      const url = query ? `/api/patients?search=${encodeURIComponent(query)}` : "/api/patients";
      const res = await fetch(url);
      const data = await res.json();
      setPatients(data.patients || []);
    } catch {
      console.error("Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      fetchPatients();
    } catch {
      setFormError("Network error submitting patient registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-clinical-600" />
            Patient Records &amp; Directory
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Search existing clinical records by Patient Code, Full Name, or Phone Number
          </p>
        </div>

        <button
          onClick={() => {
            setIsRegisterOpen(true);
            setDuplicateWarning(null);
            setFormError(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-clinical-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Register New Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-6">
        <div className="relative max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code (e.g. MED-2026-0001), name, or phone..."
            className="block w-full rounded-xl border border-surface-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
          />
        </div>
      </div>

      {/* Patients Table / List */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-clinical-600 border-t-transparent" />
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-xl border border-surface-200 bg-white p-12 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No matching patients found</h3>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search terms or register this patient as a new record.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50 text-left text-xs font-semibold text-slate-600">
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
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-surface-50/60 transition-colors">
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
                        className="inline-flex items-center gap-1 text-clinical-600 hover:text-clinical-800 font-semibold"
                      >
                        View Profile <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration Modal / Drawer */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">Register New Clinical Patient</h2>
            <p className="text-xs text-slate-500 mt-0.5">Generates a permanent clinical code and records intake consent</p>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            {/* Duplicate Warning Dialog */}
            {duplicateWarning && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Possible Duplicate Record Detected
                </div>
                <p>
                  A patient with the matching contact information already exists:
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Venkat Ramanujam"
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Unknown">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-98765-43210"
                    className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, District, State"
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-clinical-600 px-4 py-2 text-sm font-semibold text-white hover:bg-clinical-700 disabled:opacity-60"
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
