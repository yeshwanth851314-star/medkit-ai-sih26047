"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stethoscope, Lock, Mail, AlertCircle, Shield, Activity, UserCircle, Sparkles } from "lucide-react";
import { DEMO_QUICK_ACCESS } from "@/lib/auth/demo-users";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/doctor/patients";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      // Successful login -> navigate to intended destination
      window.location.href = redirectTo;
    } catch {
      setError("Network error communicating with authentication service.");
      setIsLoading(false);
    }
  };

  const handleDemoDoctor = async () => {
    setError(null);
    setDemoLoading("doctor");
    const { email: demoEmail, password: demoPassword } = DEMO_QUICK_ACCESS.doctor;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Demo doctor login failed.");
        setDemoLoading(null);
        return;
      }

      window.location.href = "/doctor/dashboard";
    } catch {
      setError("Network error. Please try again.");
      setDemoLoading(null);
    }
  };

  const handleDemoPatient = () => {
    setDemoLoading("patient");
    router.push(DEMO_QUICK_ACCESS.patient.href);
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-surface-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Clinician Portal Login
          </h1>
          <p className="mt-1 text-xs text-slate-700">
            Sign in to access your Clinical Copilot, Patient Queues &amp; Longitudinal Records
          </p>
        </div>

        {/* ─── Demo Quick Access Panel ─── */}
        <section
          aria-label="Live Demo Quick Access"
          className="rounded-xl border-2 border-dashed border-clinical-300 bg-clinical-50/60 p-4 space-y-3"
        >
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-clinical-700 px-3 py-1 text-xs font-bold text-white tracking-wide shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              SIH Live Demo Access
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Doctor Demo Button */}
            <button
              type="button"
              onClick={handleDemoDoctor}
              disabled={demoLoading !== null || isLoading}
              aria-label="Demo Doctor: Dr. Ananya Rao, ID doctor@medkit.ai"
              className="flex flex-col items-center gap-2 rounded-xl border border-clinical-200 bg-white p-4 shadow-sm hover:bg-clinical-50 hover:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-600 transition-all disabled:opacity-60 text-center"
            >
              {demoLoading === "doctor" ? (
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-clinical-700 border-t-transparent" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clinical-100 text-clinical-700">
                  <Stethoscope className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {demoLoading === "doctor" ? "Signing In..." : "Doctor Demo"}
                </div>
                <div className="mt-1 inline-block rounded bg-clinical-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-clinical-800">
                  {DEMO_QUICK_ACCESS.doctor.demoId}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1">
                  {DEMO_QUICK_ACCESS.doctor.fullName}
                </div>
                <div className="text-xs font-bold text-clinical-700 mt-1">
                  Clinician Portal &rarr;
                </div>
              </div>
            </button>

            {/* Patient Demo Button */}
            <button
              type="button"
              onClick={handleDemoPatient}
              disabled={demoLoading !== null || isLoading}
              aria-label="Demo Patient: Ramesh Kumar Varma, ID MED-2026-0001"
              className="flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-white p-4 shadow-sm hover:bg-amber-50 hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-600 transition-all disabled:opacity-60 text-center"
            >
              {demoLoading === "patient" ? (
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <UserCircle className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {demoLoading === "patient" ? "Launching..." : "Patient Demo"}
                </div>
                <div className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-amber-900">
                  {DEMO_QUICK_ACCESS.patient.demoId}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1">
                  {DEMO_QUICK_ACCESS.patient.fullName}
                </div>
                <div className="text-xs font-bold text-amber-900 mt-1">
                  Voice Kiosk Intake &rarr;
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-xs font-medium text-slate-700">
            One-click demonstration profiles for live presentation
          </p>
        </section>

        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 font-semibold text-slate-700">
              or sign in with credentials
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-700">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@medkit.ai"
                className="block w-full rounded-lg border border-surface-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-700">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-surface-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinical-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-clinical-600 disabled:opacity-60 transition-colors"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isLoading ? "Authenticating..." : "Sign In to Copilot"}</span>
          </button>
        </form>

        {/* Institutional Support & Security Notice */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="text-slate-700">Forgot credentials?</span>
            <span className="font-semibold text-clinical-700 hover:text-clinical-800 cursor-pointer">
              Contact Hospital IT Desk
            </span>
          </div>

          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1.5">
              <Shield className="h-3.5 w-3.5 text-clinical-700" aria-hidden="true" />
              <span>Institutional Healthcare Access</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Authorized clinical personnel only. Access is monitored and protected by facility-isolated Row Level Security. For new physician or staff onboarding, contact your facility administrator.
            </p>
            <div className="mt-3 pt-2 border-t border-surface-200 text-center text-xs">
              <span className="text-slate-700">New healthcare professional? </span>
              <a href="/register" className="font-semibold text-clinical-700 hover:text-clinical-800">
                Register &amp; Verify Credentials &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
