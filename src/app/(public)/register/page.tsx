"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Shield,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  Mail,
  User,
  FileCheck,
  KeyRound,
  ArrowRight,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { ProfessionalType } from "@/features/onboarding/types";

export default function ClinicianRegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [professionalType, setProfessionalType] = useState<ProfessionalType>("allopathy");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationAuthority, setRegistrationAuthority] = useState("National Medical Commission (NMC)");
  const [registrationState, setRegistrationState] = useState("Delhi");
  const [requestedFacilityId, setRequestedFacilityId] = useState("fac-aiia-delhi-01");
  const [facilityRole, setFacilityRole] = useState<"doctor" | "staff">("doctor");

  // Onboarding Flow State
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Step 1: Submit Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          professionalType,
          registrationNumber,
          registrationAuthority,
          registrationState,
          requestedFacilityId,
          facilityRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register clinician applicant.");
      }

      setStep(2);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Execute Council Registry Verification
  const handleVerifyRegistry = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/onboarding/verify-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registry verification failed.");
      }

      setVerificationResult(data.verification);

      if (data.verification.verified) {
        // Automatically request MFA enrollment challenge
        const mfaRes = await fetch("/api/auth/onboarding/mfa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "enroll" }),
        });
        const mfaData = await mfaRes.json();
        if (mfaRes.ok) {
          setMfaSecret(mfaData.secret);
          setMfaUri(mfaData.qrCodeUri);
        }
        setStep(3);
      } else if (data.verification.status === "recheck_required") {
        setError(`Authoritative Gateway Notice: ${data.verification.remarks}`);
      } else {
        setError(`Registry Verification Rejected: ${data.verification.remarks}`);
      }
    } catch (err: any) {
      setError(err.message || "Council verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify Cryptographic TOTP Challenge
  const handleEnrollMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/onboarding/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          verificationCode: mfaCode,
          secret: mfaSecret,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "MFA cryptographic challenge verification failed.");
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message || "Invalid authenticator code. Please enter the current 6-digit code from your app.");
    } finally {
      setIsLoading(false);
    }
  };

  const copySecretToClipboard = () => {
    if (mfaSecret) {
      navigator.clipboard.writeText(mfaSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl space-y-6 rounded-2xl border border-surface-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Healthcare Professional Onboarding
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            SIH26047 Institutional Identity &amp; Medical Council Verification
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between border-b border-surface-200 pb-4 text-xs font-medium">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-clinical-600 font-semibold" : "text-slate-400"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">1</span>
            <span>Profile</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-clinical-600 font-semibold" : "text-slate-400"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">2</span>
            <span>Council</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-clinical-600 font-semibold" : "text-slate-400"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">3</span>
            <span>MFA</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
          <div className={`flex items-center gap-1.5 ${step >= 4 ? "text-clinical-600 font-semibold" : "text-slate-400"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">4</span>
            <span>Approval</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Step 1: Practitioner Details */}
        {step === 1 && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute inset-y-0 left-0 pl-3 h-4 w-4 my-auto text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Rajesh Sharma"
                    className="block w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute inset-y-0 left-0 pl-3 h-4 w-4 my-auto text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="r.sharma@aiia.gov.in"
                    className="block w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute inset-y-0 left-0 pl-3 h-4 w-4 my-auto text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Specialty &amp; Council</label>
                <select
                  value={professionalType}
                  onChange={(e) => {
                    const val = e.target.value as ProfessionalType;
                    setProfessionalType(val);
                    if (val.startsWith("ayush")) {
                      if (val === "ayush_homeopathy") {
                        setRegistrationAuthority("National Commission for Homoeopathy (NCH)");
                      } else {
                        setRegistrationAuthority("National Commission for Indian System of Medicine (NCISM)");
                      }
                    } else {
                      setRegistrationAuthority("National Medical Commission (NMC)");
                    }
                  }}
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                >
                  <option value="allopathy">Allopathy (MBBS / MD) — NMC</option>
                  <option value="ayush_ayurveda">AYUSH — Ayurveda (BAMS / MD)</option>
                  <option value="ayush_yoga_naturopathy">AYUSH — Yoga &amp; Naturopathy</option>
                  <option value="ayush_unani">AYUSH — Unani (BUMS)</option>
                  <option value="ayush_siddha">AYUSH — Siddha (BSMS)</option>
                  <option value="ayush_homeopathy">AYUSH — Homoeopathy (BHMS)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registration No.</label>
                <input
                  type="text"
                  required
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="DMC-R-2018-091"
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authority</label>
                <input
                  type="text"
                  required
                  value={registrationAuthority}
                  onChange={(e) => setRegistrationAuthority(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-xs text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State / Council</label>
                <input
                  type="text"
                  required
                  value={registrationState}
                  onChange={(e) => setRegistrationState(e.target.value)}
                  placeholder="Delhi"
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Healthcare Facility</label>
                <select
                  value={requestedFacilityId}
                  onChange={(e) => setRequestedFacilityId(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                >
                  <option value="fac-aiia-delhi-01">All India Institute of Ayurveda (AIIA), New Delhi</option>
                  <option value="fac-safdarjung-01">VMM &amp; Safdarjung Hospital, New Delhi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={facilityRole}
                  onChange={(e) => setFacilityRole(e.target.value as any)}
                  className="block w-full rounded-lg border border-surface-200 py-2 px-3 text-sm text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                >
                  <option value="doctor">Consultant / Attending Physician</option>
                  <option value="staff">Clinical Coordinator / Staff</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinical-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 disabled:opacity-60 transition-colors"
            >
              {isLoading ? "Submitting Application..." : "Submit Practitioner Credentials"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Step 2: Medical Council Registry Verification */}
        {step === 2 && (
          <div className="space-y-5 text-center">
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-6 space-y-3">
              <FileCheck className="h-10 w-10 text-clinical-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">National Council Registry Verification</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Execute authoritative validation against the National Medical Register (NMR) or NCISM / NCH AYUSH Council.
              </p>
              <div className="rounded-lg bg-white border border-surface-200 p-3 text-xs text-left font-mono space-y-1">
                <div><span className="text-slate-400">Practitioner:</span> {fullName}</div>
                <div><span className="text-slate-400">Reg No:</span> {registrationNumber}</div>
                <div><span className="text-slate-400">Council:</span> {registrationAuthority} ({registrationState})</div>
              </div>
            </div>

            <button
              onClick={handleVerifyRegistry}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinical-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 disabled:opacity-60 transition-colors"
            >
              {isLoading ? "Verifying with Council Gateway..." : "Verify Credentials with Council Registry"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 3: Cryptographic MFA Setup */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-xs text-green-800">
                <span className="font-semibold">Medical Registration Confirmed:</span> {verificationResult?.remarks}
                <div className="font-mono text-[11px] text-green-700 mt-0.5">Reference: {verificationResult?.verificationReference}</div>
              </div>
            </div>

            <form onSubmit={handleEnrollMfa} className="space-y-4">
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-6 space-y-3 text-center">
                <KeyRound className="h-10 w-10 text-clinical-600 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">Multi-Factor Authentication (TOTP)</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Configure your authenticator app (Google Authenticator, Microsoft Authenticator, or Aegis) using the shared secret key below.
                </p>

                {mfaSecret && (
                  <div className="rounded-lg bg-white border border-surface-300 p-3 max-w-sm mx-auto text-left space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600">Manual Setup Secret Key:</div>
                    <div className="flex items-center justify-between font-mono text-xs bg-slate-50 p-2 rounded border border-surface-200">
                      <span className="break-all tracking-wider text-slate-800 select-all">{mfaSecret}</span>
                      <button
                        type="button"
                        onClick={copySecretToClipboard}
                        className="ml-2 p-1 text-slate-500 hover:text-clinical-600 shrink-0"
                        title="Copy Secret"
                      >
                        {copiedSecret ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-w-xs mx-auto pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Current 6-Digit Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="block w-full text-center tracking-widest text-xl font-mono rounded-lg border border-surface-300 py-2.5 px-3 text-slate-900 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Real RFC 6238 challenge: only the authentic timed code generated from your secret will pass.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || mfaCode.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinical-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 disabled:opacity-60 transition-colors"
              >
                {isLoading ? "Verifying Authenticator Code..." : "Verify Challenge & Complete Setup"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Facility Approval Status */}
        {step === 4 && (
          <div className="space-y-5 text-center">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
              <Clock className="h-12 w-12 text-amber-600 mx-auto" />
              <h3 className="text-lg font-semibold text-amber-900">Application Queued for Hospital Approval</h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                Your medical council credentials and multi-factor authentication are verified. In accordance with clinical governance, an authorized administrator at your requested hospital facility must grant approval before clinical privileges are unlocked.
              </p>
              <div className="rounded-lg bg-white border border-amber-200 p-3 text-xs text-left font-mono space-y-1 text-slate-700">
                <div><span className="text-slate-400">Account Status:</span> PENDING_FACILITY_APPROVAL</div>
                <div><span className="text-slate-400">Medical Council Status:</span> VERIFIED</div>
                <div><span className="text-slate-400">MFA Verification:</span> CRYPTOGRAPHICALLY VERIFIED</div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
              >
                Return to Clinician Login
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 text-xs text-slate-500 border-t border-surface-200">
          Already have an authorized clinical account?{" "}
          <Link href="/login" className="font-semibold text-clinical-600 hover:text-clinical-700">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
}
