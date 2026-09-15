"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stethoscope, Lock, Mail, AlertCircle, CheckCircle2, Shield, Activity } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/doctor/patients";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-surface-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Clinician Portal Login
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to access your Clinical Copilot, Patient Queues &amp; Longitudinal Records
          </p>
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
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@medkit.ai"
                className="block w-full rounded-lg border border-surface-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-surface-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
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
              <Stethoscope className="h-4 w-4" />
            )}
            <span>{isLoading ? "Authenticating..." : "Sign In to Copilot"}</span>
          </button>
        </form>

        {/* Institutional Support & Security Notice */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="text-slate-500">Forgot credentials?</span>
            <span className="font-medium text-clinical-600 hover:text-clinical-700 cursor-pointer">
              Contact Hospital IT Desk
            </span>
          </div>

          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
              <Shield className="h-3.5 w-3.5 text-clinical-600" />
              <span>Institutional Healthcare Access</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Authorized clinical personnel only. Access is monitored and protected by facility-isolated Row Level Security. For new physician or staff onboarding, contact your facility administrator.
            </p>
            <div className="mt-3 pt-2 border-t border-surface-200 text-center text-xs">
              <span className="text-slate-500">New healthcare professional? </span>
              <a href="/register" className="font-semibold text-clinical-600 hover:text-clinical-700">
                Register &amp; Verify Credentials &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
